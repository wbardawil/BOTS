"""Object storage for attachments behind one small interface.

The rest of the backend only calls `put`, `get` and `delete` on the object returned by `get_storage()`.
Swapping providers is a one-file change here. Selection (env):
  BOTS_STORAGE_PROVIDER = local | s3 | emergent   (default: emergent when EMERGENT_LLM_KEY is set, else local)
  BOTS_STORAGE_DIR      = local: directory for the files (default: backend/data/attachments)
  BOTS_S3_BUCKET        = s3: bucket name; BOTS_S3_ENDPOINT_URL for S3-compatible stores (MinIO, R2)
  AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION   (s3: read by boto3 itself; never logged)
  EMERGENT_LLM_KEY, INTEGRATION_PROXY_URL                  (emergent: the hosted object store, unchanged)
Every provider does its blocking I/O inside `asyncio.to_thread`, so handlers never stall the event loop.
boto3 and requests are imported lazily so the server starts without them when another provider is selected.
"""
import asyncio
import logging
import os
import re
from pathlib import Path
from typing import Optional

logger = logging.getLogger("bots.storage")

APP_NAME = "bots"
DEFAULT_LOCAL_DIR = Path(__file__).resolve().parent.parent / "data" / "attachments"

_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
MAX_KEY_LENGTH = 512


class StorageError(Exception):
    """kind: not_configured | bad_key | not_found | provider"""

    def __init__(self, kind: str, message: str):
        self.kind = kind
        super().__init__(message)


def safe_key(key: str) -> str:
    """Validates an object key: relative, slash-separated, plain segments. Rejects traversal and odd bytes."""
    if not isinstance(key, str) or not key or len(key) > MAX_KEY_LENGTH:
        raise StorageError("bad_key", "Invalid storage key")
    if key.startswith("/") or "\\" in key or "\0" in key:
        raise StorageError("bad_key", "Invalid storage key")
    for seg in key.split("/"):  # the regex also rejects "", "." and ".." (first char must be alphanumeric)
        if not _SEGMENT.match(seg):
            raise StorageError("bad_key", "Invalid storage key")
    return key


class Storage:
    """Interface. `put` returns the key the object was stored under; `get` returns the raw bytes."""
    name = "none"
    ready = False

    async def init(self) -> None:
        """Called once at startup. Raises when the backend is unreachable or misconfigured."""
        self.ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        raise StorageError("not_configured", "No storage provider configured")

    async def get(self, key: str) -> bytes:
        raise StorageError("not_configured", "No storage provider configured")

    async def delete(self, key: str) -> None:
        raise StorageError("not_configured", "No storage provider configured")


class LocalDiskStorage(Storage):
    """Files under one directory (docker compose mounts a volume there). Keys map to relative paths."""
    name = "local"

    def __init__(self, root: Optional[str | Path] = None):
        self.root = Path(root or DEFAULT_LOCAL_DIR).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / safe_key(key)).resolve()
        if self.root not in p.parents:  # belt and braces on top of safe_key
            raise StorageError("bad_key", "Invalid storage key")
        return p

    def _put_sync(self, key: str, data: bytes) -> str:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_name(p.name + ".part")
        tmp.write_bytes(data)
        os.replace(tmp, p)  # atomic: a reader never sees a half-written file
        return key

    def _get_sync(self, key: str) -> bytes:
        p = self._path(key)
        try:
            return p.read_bytes()
        except FileNotFoundError:
            raise StorageError("not_found", "Object not found")

    def _delete_sync(self, key: str) -> None:
        p = self._path(key)
        try:
            p.unlink()
        except FileNotFoundError:
            pass

    async def init(self) -> None:
        def check():
            self.root.mkdir(parents=True, exist_ok=True)
            if not os.access(self.root, os.W_OK):
                raise StorageError("provider", f"Attachment directory is not writable: {self.root}")
        await asyncio.to_thread(check)
        self.ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        return await asyncio.to_thread(self._put_sync, key, data)

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(self._get_sync, key)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._delete_sync, key)


class S3Storage(Storage):
    """An S3 bucket (or an S3-compatible endpoint). Credentials come from the standard AWS environment."""
    name = "s3"

    def __init__(self, bucket: str, region: Optional[str] = None, endpoint_url: Optional[str] = None):
        if not bucket:
            raise StorageError("not_configured", "BOTS_S3_BUCKET is not set")
        self.bucket = bucket
        self.region = region or None
        self.endpoint_url = endpoint_url or None
        self._client = None

    def _c(self):
        if self._client is None:
            import boto3  # lazy: optional dependency
            self._client = boto3.client("s3", region_name=self.region, endpoint_url=self.endpoint_url)
        return self._client

    async def init(self) -> None:
        await asyncio.to_thread(lambda: self._c().head_bucket(Bucket=self.bucket))
        self.ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        safe_key(key)
        await asyncio.to_thread(lambda: self._c().put_object(
            Bucket=self.bucket, Key=key, Body=data, ContentType=content_type or "application/octet-stream"))
        return key

    async def get(self, key: str) -> bytes:
        def read():
            try:
                return self._c().get_object(Bucket=self.bucket, Key=key)["Body"].read()
            except self._c().exceptions.NoSuchKey:
                raise StorageError("not_found", "Object not found")
        return await asyncio.to_thread(read)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(lambda: self._c().delete_object(Bucket=self.bucket, Key=key))


class EmergentStorage(Storage):
    """Transitional: the Emergent private object store. Files are private per company; access goes via the API."""
    name = "emergent"

    def __init__(self, emergent_key: Optional[str] = None, base_url: Optional[str] = None):
        base = (base_url or os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
        self.url = base.rstrip("/") + "/objstore/api/v1/storage"
        self._emergent_key = emergent_key if emergent_key is not None else os.environ.get("EMERGENT_LLM_KEY")
        self._storage_key = None

    def _init_sync(self, force: bool = False) -> str:
        import requests  # lazy: only this provider needs it
        if self._storage_key and not force:
            return self._storage_key
        resp = requests.post(f"{self.url}/init", json={"emergent_key": self._emergent_key}, timeout=30)
        resp.raise_for_status()
        self._storage_key = resp.json()["storage_key"]
        return self._storage_key

    def _request(self, method: str, path: str, headers: Optional[dict] = None, **kw):
        import requests
        extra = headers or {}
        key = self._init_sync()
        resp = requests.request(method, f"{self.url}/objects/{path}", headers={"X-Storage-Key": key, **extra}, **kw)
        if resp.status_code == 404:  # storage key rotated: re-init once and retry
            key = self._init_sync(force=True)
            resp = requests.request(method, f"{self.url}/objects/{path}", headers={"X-Storage-Key": key, **extra}, **kw)
        resp.raise_for_status()
        return resp

    def _put_sync(self, key: str, data: bytes, content_type: str) -> str:
        resp = self._request("PUT", key, headers={"Content-Type": content_type}, data=data, timeout=120)
        return resp.json().get("path") or key

    def _get_sync(self, key: str) -> bytes:
        return self._request("GET", key, timeout=60).content

    def _delete_sync(self, key: str) -> None:
        self._request("DELETE", key, timeout=60)

    async def init(self) -> None:
        await asyncio.to_thread(self._init_sync)
        self.ready = True

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        return await asyncio.to_thread(self._put_sync, key, data, content_type)

    async def get(self, key: str) -> bytes:
        return await asyncio.to_thread(self._get_sync, key)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._delete_sync, key)


_storage: Optional[Storage] = None


def selected_provider() -> str:
    return (os.environ.get("BOTS_STORAGE_PROVIDER") or ("emergent" if os.environ.get("EMERGENT_LLM_KEY") else "local")).strip().lower()


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        provider = selected_provider()
        if provider == "s3":
            _storage = S3Storage(os.environ.get("BOTS_S3_BUCKET") or "",
                                 os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION"),
                                 os.environ.get("BOTS_S3_ENDPOINT_URL"))
        elif provider == "emergent":
            _storage = EmergentStorage()
        elif provider == "local":
            _storage = LocalDiskStorage(os.environ.get("BOTS_STORAGE_DIR") or None)
        else:
            raise StorageError("not_configured", f"Unknown BOTS_STORAGE_PROVIDER: {provider!r}")
    return _storage


def storage_status() -> dict:
    """Read-only summary for the status endpoint: which provider is selected and whether init succeeded."""
    try:
        s = get_storage()
    except Exception as e:  # misconfiguration: say which provider was asked for, never a credential
        return {"provider": selected_provider(), "ready": False, "error": str(e)[:200]}
    return {"provider": s.name, "ready": bool(s.ready)}
