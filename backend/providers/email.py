"""Transactional email behind one small interface.

The rest of the backend calls `email_util.send_email`, which runs the safety guard and then delegates to the
object returned by `get_email()`. Selection (env):
  BOTS_EMAIL_PROVIDER = smtp | emergent | none   (default: emergent when EMERGENT_EMAIL_KEY is set, else none)
  BOTS_SMTP_HOST / BOTS_SMTP_PORT (587) / BOTS_SMTP_USER / BOTS_SMTP_PASSWORD / BOTS_SMTP_FROM
  BOTS_SMTP_STARTTLS = true | false              (default true; port 465 uses implicit TLS instead)
  EMAIL_FROM_NAME (BOTS), EMAIL_REPLY_TO          (display name and default Reply-To for every provider)
  EMERGENT_EMAIL_KEY                              (the hosted sender, unchanged)
`send` returns True when the provider accepted the message. Blocking SMTP runs inside `asyncio.to_thread`;
httpx is imported lazily so the server starts without it when the provider is smtp or none.
"""
import asyncio
import html as html_mod
import logging
import os
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional

logger = logging.getLogger("bots.email")


def html_to_text(html: str) -> str:
    """Plain-text alternative for an HTML body: drops tags, keeps line breaks for block elements."""
    t = re.sub(r"(?is)<(script|style).*?</\1>", "", html or "")
    t = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h[1-6])>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = html_mod.unescape(t)
    return re.sub(r"\n{3,}", "\n\n", t).strip()


class Email:
    """Interface. `text` is the plain body; `html` the rich alternative when the caller has one."""
    name = "none"
    enabled = False

    async def send(self, to: str, subject: str, text: str, *, html: Optional[str] = None,
                   reply_to: Optional[str] = None) -> bool:
        raise NotImplementedError


class NoEmail(Email):
    """No sender configured: logs and reports the message as not sent."""
    name = "none"

    async def send(self, to: str, subject: str, text: str, *, html: Optional[str] = None,
                   reply_to: Optional[str] = None) -> bool:
        logger.warning("No email provider configured — not sending %r to %s", subject, to)
        return False


class SmtpEmail(Email):
    """Any SMTP relay with STARTTLS (587) or implicit TLS (465). Credentials never leave this object."""
    name = "smtp"
    enabled = True

    def __init__(self, host: str, port: int = 587, user: str = "", password: str = "", sender: str = "",
                 from_name: str = "BOTS", reply_to: Optional[str] = None, starttls: bool = True, timeout: float = 30):
        if not host or not sender:
            raise ValueError("BOTS_SMTP_HOST and BOTS_SMTP_FROM are required for the smtp provider")
        self.host, self.port = host, int(port or 587)
        self._user, self._password = user or "", password or ""
        self.sender, self.from_name, self.reply_to = sender, from_name, reply_to
        self.starttls, self.timeout = starttls, timeout

    def build(self, to: str, subject: str, text: str, html: Optional[str], reply_to: Optional[str]) -> EmailMessage:
        msg = EmailMessage()
        msg["From"] = formataddr((self.from_name, self.sender)) if self.from_name else self.sender
        msg["To"] = to
        msg["Subject"] = subject
        if reply_to or self.reply_to:
            msg["Reply-To"] = reply_to or self.reply_to
        msg.set_content(text or html_to_text(html or ""))
        if html:
            msg.add_alternative(html, subtype="html")
        return msg

    def _send_sync(self, msg: EmailMessage) -> None:
        ctx = ssl.create_default_context()
        if self.port == 465:
            server = smtplib.SMTP_SSL(self.host, self.port, timeout=self.timeout, context=ctx)
        else:
            server = smtplib.SMTP(self.host, self.port, timeout=self.timeout)
        with server:
            server.ehlo()
            if self.port != 465 and self.starttls:
                server.starttls(context=ctx)
                server.ehlo()
            if self._user:
                server.login(self._user, self._password)
            server.send_message(msg)

    async def send(self, to: str, subject: str, text: str, *, html: Optional[str] = None,
                   reply_to: Optional[str] = None) -> bool:
        msg = self.build(to, subject, text, html, reply_to)
        await asyncio.to_thread(self._send_sync, msg)
        return True


class EmergentEmail(Email):
    """Transitional: the Emergent-managed sender (Resend behind the integrations proxy)."""
    name = "emergent"
    enabled = True

    def __init__(self, email_key: str, from_name: str = "BOTS", reply_to: Optional[str] = None,
                 base_url: str = "https://integrations.emergentagent.com"):
        if not email_key:
            raise ValueError("EMERGENT_EMAIL_KEY is required for the emergent provider")
        self._email_key = email_key
        self.from_name, self.reply_to = from_name, reply_to
        self.url = base_url.rstrip("/") + "/api/v1/email/send"

    async def send(self, to: str, subject: str, text: str, *, html: Optional[str] = None,
                   reply_to: Optional[str] = None) -> bool:
        import httpx  # lazy: only this provider needs it
        body = html or "<pre>" + html_mod.escape(text or "") + "</pre>"
        payload = {"to": [to], "subject": subject, "html": body, "from_name": self.from_name}
        if reply_to or self.reply_to:
            payload["contact_email"] = reply_to or self.reply_to
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(self.url, headers={"X-Email-Key": self._email_key}, json=payload)
        resp.raise_for_status()
        return True


_email: Optional[Email] = None


def selected_provider() -> str:
    return (os.environ.get("BOTS_EMAIL_PROVIDER") or ("emergent" if os.environ.get("EMERGENT_EMAIL_KEY") else "none")).strip().lower()


def get_email() -> Email:
    global _email
    if _email is None:
        provider = selected_provider()
        from_name = os.environ.get("EMAIL_FROM_NAME", "BOTS")
        reply_to = os.environ.get("EMAIL_REPLY_TO") or None
        try:
            if provider == "smtp":
                _email = SmtpEmail(os.environ.get("BOTS_SMTP_HOST") or "", int(os.environ.get("BOTS_SMTP_PORT") or 587),
                                   os.environ.get("BOTS_SMTP_USER") or "", os.environ.get("BOTS_SMTP_PASSWORD") or "",
                                   os.environ.get("BOTS_SMTP_FROM") or "", from_name, reply_to,
                                   (os.environ.get("BOTS_SMTP_STARTTLS") or "true").strip().lower() not in ("0", "false", "no"))
            elif provider == "emergent":
                _email = EmergentEmail(os.environ.get("EMERGENT_EMAIL_KEY") or "", from_name, reply_to)
            elif provider == "none":
                _email = NoEmail()
            else:
                raise ValueError(f"Unknown BOTS_EMAIL_PROVIDER: {provider!r}")
        except ValueError as e:  # misconfiguration keeps the server up with email disabled
            logger.error("Email disabled: %s", e)
            _email = NoEmail()
    return _email


def email_status() -> dict:
    e = get_email()
    return {"enabled": e.enabled, "provider": e.name if e.enabled else None}
