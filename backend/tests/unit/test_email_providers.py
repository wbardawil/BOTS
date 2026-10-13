"""Unit: email provider selection, the SMTP message path (fake smtplib) and the guard in send_email."""
import asyncio
import smtplib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # backend/, so `providers` imports without PYTHONPATH
import providers.email as mod  # noqa: E402
from providers.email import NoEmail, SmtpEmail, get_email, html_to_text  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def test_html_to_text_keeps_lines_and_unescapes():
    t = html_to_text("<h2>Due &amp; soon</h2><p>One</p><ul><li>a</li><li>b</li></ul><style>p{}</style>")
    assert t == "Due & soon\nOne\na\nb"


def test_no_email_logs_and_returns_false(caplog):
    with caplog.at_level("WARNING", logger="bots.email"):
        assert run(NoEmail().send("a@b.c", "Hi", "text")) is False
    assert "No email provider configured" in caplog.text


def test_default_selection(monkeypatch):
    monkeypatch.setattr(mod, "_email", None)
    monkeypatch.delenv("BOTS_EMAIL_PROVIDER", raising=False)
    monkeypatch.delenv("EMERGENT_EMAIL_KEY", raising=False)
    assert isinstance(get_email(), NoEmail)
    assert mod.email_status() == {"enabled": False, "provider": None}
    monkeypatch.setattr(mod, "_email", None)
    monkeypatch.setenv("EMERGENT_EMAIL_KEY", "k")
    assert isinstance(get_email(), mod.EmergentEmail)
    assert mod.email_status() == {"enabled": True, "provider": "emergent"}


def test_smtp_missing_host_falls_back_to_none(monkeypatch, caplog):
    monkeypatch.setattr(mod, "_email", None)
    monkeypatch.setenv("BOTS_EMAIL_PROVIDER", "smtp")
    monkeypatch.delenv("BOTS_SMTP_HOST", raising=False)
    with caplog.at_level("ERROR", logger="bots.email"):
        assert isinstance(get_email(), NoEmail)
    assert "Email disabled" in caplog.text


def test_smtp_builds_alternative_message_and_uses_starttls(monkeypatch):
    events = []

    class FakeSMTP:
        def __init__(self, host, port, timeout=None):
            events.append(("connect", host, port))
        def __enter__(self): return self
        def __exit__(self, *a): events.append(("quit",))
        def ehlo(self): events.append(("ehlo",))
        def starttls(self, context=None): events.append(("starttls", context is not None))
        def login(self, u, p): events.append(("login", u, p))
        def send_message(self, msg): events.append(("send", msg))

    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", lambda *a, **k: pytest.fail("port 587 must not use implicit TLS"))
    em = SmtpEmail("mail.example.test", 587, "user", "pw", "no-reply@example.test", "BOTS", "owner@example.test")
    assert run(em.send("to@example.test", "Subject", "plain", html="<p>rich</p>", reply_to=None)) is True
    assert [e[0] for e in events] == ["connect", "ehlo", "starttls", "ehlo", "login", "send", "quit"]
    assert events[2] == ("starttls", True) and events[4] == ("login", "user", "pw")
    msg = events[5][1]
    assert msg["From"] == "BOTS <no-reply@example.test>" and msg["To"] == "to@example.test"
    assert msg["Subject"] == "Subject" and msg["Reply-To"] == "owner@example.test"
    parts = {p.get_content_type(): p.get_content() for p in msg.iter_parts()}
    assert parts["text/plain"].strip() == "plain" and parts["text/html"].strip() == "<p>rich</p>"


def test_smtp_port_465_uses_implicit_tls_and_no_login_without_user(monkeypatch):
    events = []

    class FakeSSL:
        def __init__(self, host, port, timeout=None, context=None): events.append(("ssl", host, port))
        def __enter__(self): return self
        def __exit__(self, *a): pass
        def ehlo(self): pass
        def starttls(self, context=None): pytest.fail("no STARTTLS on 465")
        def login(self, u, p): pytest.fail("no login without a user")
        def send_message(self, msg): events.append(("send",))

    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSSL)
    monkeypatch.setattr(smtplib, "SMTP", lambda *a, **k: pytest.fail("port 465 must not use plain SMTP"))
    em = SmtpEmail("mail.example.test", 465, "", "", "no-reply@example.test", "")
    assert run(em.send("to@example.test", "S", "t")) is True
    assert events == [("ssl", "mail.example.test", 465), ("send",)]


def test_send_email_keeps_guard_and_delegates(monkeypatch):
    import email_util
    sent = []

    class Spy(mod.Email):
        name, enabled = "spy", True
        async def send(self, to, subject, text, *, html=None, reply_to=None):
            sent.append((to, subject, text, html, reply_to)); return True

    monkeypatch.setattr(mod, "_email", Spy())
    with pytest.raises(ValueError, match="G2"):
        run(email_util.send_email(to="a@b.c", subject="x", html="<form><input></form>"))
    with pytest.raises(ValueError, match="G3"):
        run(email_util.send_email(to="a@b.c", subject="x", html='<a href="http://bit.ly/x">go</a>'))
    assert sent == []
    assert run(email_util.send_email(to="a@b.c", subject="Due", html="<p>Hello &amp; bye</p>", reply_to="r@b.c")) is True
    assert sent == [("a@b.c", "Due", "Hello & bye", "<p>Hello &amp; bye</p>", "r@b.c")]
