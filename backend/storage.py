"""Thin shim: attachment storage lives in providers/storage.py. Kept so `import storage` keeps working.

Select a provider with BOTS_STORAGE_PROVIDER (local | s3 | emergent); see providers/storage.py.
"""
from providers.storage import (  # noqa: F401
    APP_NAME, Storage, StorageError, LocalDiskStorage, S3Storage, EmergentStorage,
    get_storage, storage_status, safe_key,
)

__all__ = ["APP_NAME", "Storage", "StorageError", "LocalDiskStorage", "S3Storage", "EmergentStorage",
           "get_storage", "storage_status", "safe_key"]
