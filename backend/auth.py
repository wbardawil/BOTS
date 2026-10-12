import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
from db import db, clean

JWT_ALGORITHM = "HS256"
auth_router = APIRouter(prefix="/api/auth")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user = clean(user)
    user.pop("password_hash", None)
    return user


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


def _issue(user: dict):
    token = create_access_token(user["id"], user["email"])
    u = clean(user)
    u.pop("password_hash", None)
    return {"token": token, "user": u}


@auth_router.post("/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": secrets.token_hex(12),
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "global_role": "company_viewer",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    return _issue(user)


@auth_router.post("/login")
async def login(body: LoginIn, request: Request):
    email = body.email.lower()
    ip = request.client.host if request.client else "x"
    ident = f"{ip}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    now = datetime.now(timezone.utc)
    if att and att.get("count", 0) >= 5:
        locked_until = datetime.fromisoformat(att["locked_until"])
        if now < locked_until:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        count = (att.get("count", 0) if att else 0) + 1
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$set": {"identifier": ident, "count": count,
                      "locked_until": (now + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await db.login_attempts.delete_one({"identifier": ident})
    return _issue(user)


@auth_router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return user
