"""Unit: LocalDiskStorage round trip, key sanitising and provider selection. No server, no Mongo."""
import asyncio
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # backend/, so `providers` imports without PYTHONPATH
import providers.storage as mod  # noqa: E402
from providers.storage import LocalDiskStorage, StorageError, safe_key, get_storage, storage_status  # noqa: E402


def run(coro):
    return asyncio.run(coro)


def test_put_get_delete_round_trip(tmp_path):
    st = LocalDiskStorage(tmp_path / "att")
    assert (tmp_path / "att").is_dir(), "root is created on init"
    run(st.init())
    assert st.ready is True
    key = "bots/o-northwind/init-nw-1/0123abcd.png"
    data = bytes(range(256)) * 4
    assert run(st.put(key, data, "image/png")) == key
    assert (tmp_path / "att" / key).read_bytes() == data
    assert not (tmp_path / "att" / key).with_name("0123abcd.png.part").exists(), "temp file renamed away"
    assert run(st.get(key)) == data
    run(st.delete(key))
    assert not (tmp_path / "att" / key).exists()
    with pytest.raises(StorageError) as ei:
        run(st.get(key))
    assert ei.value.kind == "not_found"
    run(st.delete(key))  # deleting twice is not an error


@pytest.mark.parametrize("bad", [
    "../escape.txt", "bots/../../etc/passwd", "/etc/passwd", "bots/o1/./x.txt", "bots//x.txt",
    "bots\\o1\\x.txt", "", "bots/o1/.hidden", "bots/o1/x\0.txt", "bots/o1/a b.txt", "x" * 600,
])
def test_traversal_and_odd_keys_rejected(tmp_path, bad):
    st = LocalDiskStorage(tmp_path / "att")
    with pytest.raises(StorageError) as ei:
        run(st.put(bad, b"x", "text/plain"))
    assert ei.value.kind == "bad_key"
    with pytest.raises(StorageError):
        safe_key(bad)
    outside = [p for p in tmp_path.rglob("*") if p.is_file()]
    assert outside == [], f"nothing may be written for a rejected key, found {outside}"


def test_safe_key_accepts_real_keys():
    for k in ("bots/o-northwind/init-nw-1/ab12cd34ef56ab12cd34.pdf", "bots/1f2e3d4c5b6a7f8e9d0c1b2a/x/y.docx", "f.txt"):
        assert safe_key(k) == k


def test_get_storage_selects_local_from_env(tmp_path, monkeypatch):
    monkeypatch.setattr(mod, "_storage", None)
    monkeypatch.setenv("BOTS_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("BOTS_STORAGE_DIR", str(tmp_path / "root"))
    st = get_storage()
    assert isinstance(st, LocalDiskStorage) and st.root == (tmp_path / "root").resolve()
    assert get_storage() is st, "singleton"
    assert storage_status() == {"provider": "local", "ready": False}
    run(st.init())
    assert storage_status() == {"provider": "local", "ready": True}


def test_default_provider_depends_on_emergent_key(monkeypatch):
    monkeypatch.delenv("BOTS_STORAGE_PROVIDER", raising=False)
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    assert mod.selected_provider() == "local"
    monkeypatch.setenv("EMERGENT_LLM_KEY", "x")
    assert mod.selected_provider() == "emergent"
    monkeypatch.setattr(mod, "_storage", None)
    st = get_storage()
    assert isinstance(st, mod.EmergentStorage) and st.ready is False  # construction makes no network call


def test_unknown_or_misconfigured_provider_reported_not_raised(monkeypatch):
    monkeypatch.setattr(mod, "_storage", None)
    monkeypatch.setenv("BOTS_STORAGE_PROVIDER", "ftp")
    with pytest.raises(StorageError):
        get_storage()
    assert storage_status()["provider"] == "ftp" and storage_status()["ready"] is False
    monkeypatch.setenv("BOTS_STORAGE_PROVIDER", "s3")
    monkeypatch.delenv("BOTS_S3_BUCKET", raising=False)
    status = storage_status()
    assert status["provider"] == "s3" and status["ready"] is False and "BOTS_S3_BUCKET" in status["error"]


def test_s3_provider_maps_calls_and_missing_keys(monkeypatch):
    """Exercises S3Storage over a fake client (boto3 itself needs an account); no skip, no network."""
    calls = []

    class FakeBody:
        def __init__(self, b): self.b = b
        def read(self): return self.b

    class NoSuchKey(Exception):
        pass

    class FakeClient:
        exceptions = type("E", (), {"NoSuchKey": NoSuchKey})
        store = {}
        def head_bucket(self, Bucket): calls.append(("head", Bucket))
        def put_object(self, Bucket, Key, Body, ContentType):
            calls.append(("put", Bucket, Key, ContentType)); self.store[Key] = Body
        def get_object(self, Bucket, Key):
            if Key not in self.store: raise NoSuchKey()
            return {"Body": FakeBody(self.store[Key])}
        def delete_object(self, Bucket, Key): self.store.pop(Key, None)

    fake = FakeClient()
    monkeypatch.setattr(mod.S3Storage, "_c", lambda self: fake)
    st = mod.S3Storage("bkt", "us-east-1", None)
    with pytest.raises(StorageError):
        mod.S3Storage("", None, None)  # bucket is mandatory
    run(st.init())
    assert st.ready and calls == [("head", "bkt")]
    assert run(st.put("bots/o/e/k.txt", b"hi", "text/plain")) == "bots/o/e/k.txt"
    assert run(st.get("bots/o/e/k.txt")) == b"hi"
    run(st.delete("bots/o/e/k.txt"))
    with pytest.raises(StorageError) as ei:
        run(st.get("bots/o/e/k.txt"))
    assert ei.value.kind == "not_found"


def assert_no_path(text: str, *fragments: str):
    """The status endpoint is read by any logged-in user: no directory, path separator or OS error text."""
    for leak in (*fragments, "/", "\\", "Errno"):
        assert leak not in text, f"{leak!r} leaked into {text!r}"


def test_status_error_never_carries_the_server_path(tmp_path, monkeypatch):
    """Construction and init failures of the local provider are reported without the directory (M8 review)."""
    blocker = tmp_path / "blocker"
    blocker.write_text("a file where the parent directory should be")
    monkeypatch.setattr(mod, "_storage", None)
    monkeypatch.setenv("BOTS_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("BOTS_STORAGE_DIR", str(blocker / "attachments"))
    with pytest.raises(StorageError) as ei:
        get_storage()  # mkdir fails: the parent is a file
    assert ei.value.kind == "provider"
    status = storage_status()
    assert status["provider"] == "local" and status["ready"] is False and status["error"]
    assert_no_path(status["error"], str(tmp_path), "blocker")
    # init() after a good construction: the root was replaced by a file in the meantime
    st = LocalDiskStorage(tmp_path / "broken")
    (tmp_path / "broken").rmdir()
    (tmp_path / "broken").write_text("x")
    with pytest.raises(StorageError) as ei:
        run(st.init())
    assert ei.value.kind == "provider" and st.ready is False
    assert_no_path(str(ei.value), str(tmp_path), "broken")


def test_status_maps_foreign_exceptions_to_a_fixed_message(monkeypatch):
    """Anything that is not a StorageError (a library or OS error, which may quote a path) is never echoed."""
    class Boom(mod.LocalDiskStorage):
        def __init__(self, root=None):
            raise RuntimeError("PermissionError: [Errno 13] /srv/private/attachments")
    monkeypatch.setattr(mod, "_storage", None)
    monkeypatch.setattr(mod, "LocalDiskStorage", Boom)
    monkeypatch.setenv("BOTS_STORAGE_PROVIDER", "local")
    with pytest.raises(RuntimeError):
        get_storage()
    status = storage_status()
    assert status == {"provider": "local", "ready": False, "error": "construction failed"}
    assert_no_path(status["error"], "/srv/private/attachments")
