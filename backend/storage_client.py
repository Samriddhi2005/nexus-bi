import logging
from functools import lru_cache

from firebase_admin import storage
from google.cloud.storage import Bucket

from backend.firestore_client import ensure_firebase_initialized

logger = logging.getLogger("nexusbi.storage")


@lru_cache
def get_storage_bucket() -> Bucket:
    ensure_firebase_initialized()
    return storage.bucket()


def _blob_path(uid: str) -> str:
    return f"users/{uid}/nexus_bi.db"


def download_user_db(uid: str, local_path: str) -> bool:
    """
    Pulls a user's durable SQLite file down from Cloud Storage to local_path.
    Returns True if a remote copy existed and was downloaded, False if this
    is a brand-new user with nothing in Storage yet (not an error — the
    caller falls through to DatabaseManager's normal bundled-CSV seeding).

    Failures (bucket unreachable, misconfigured, etc.) are logged and treated
    the same as "nothing to download" — durability is a nice-to-have, not a
    new way for a request to fail outright.
    """
    try:
        blob = get_storage_bucket().blob(_blob_path(uid))
        if not blob.exists():
            return False
        blob.download_to_filename(local_path)
        return True
    except Exception as exc:
        logger.warning("Could not download dataset from Cloud Storage for %s: %s", uid, exc)
        return False


def upload_user_db(uid: str, local_path: str) -> None:
    """
    Pushes the current local SQLite file up to Cloud Storage as the durable
    copy. Called after any operation that mutates it (dataset upload/delete)
    — read-only chat queries never need this. Failures are logged, not
    raised: a failed sync shouldn't fail the request that triggered it, since
    the local file (this process's cache) already has the correct data.
    """
    try:
        blob = get_storage_bucket().blob(_blob_path(uid))
        blob.upload_from_filename(local_path)
    except Exception as exc:
        logger.warning("Could not sync dataset to Cloud Storage for %s: %s", uid, exc)
