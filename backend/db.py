import os
from motor.motor_asyncio import AsyncIOMotorClient

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]


def clean(doc):
    """Strip Mongo _id, return plain dict."""
    if doc is None:
        return None
    doc = dict(doc)
    doc.pop("_id", None)
    return doc
