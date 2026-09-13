import os
import threading

from core.database import DatabaseManager
from backend.config import get_settings
from backend.storage_client import download_user_db, upload_user_db

_managers: dict[str, DatabaseManager] = {}
_lock = threading.Lock()


def _local_db_path(uid: str) -> str:
    settings = get_settings()
    user_dir = os.path.join(settings.data_store_dir, uid)
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, "nexus_bi.db")


def get_db_manager_for_user(uid: str) -> DatabaseManager:
    """
    Returns a per-user DatabaseManager backed by an isolated SQLite file at
    data_store/<uid>/nexus_bi.db, so uploads and queries never cross tenants.

    On a platform with an ephemeral disk (e.g. Render), that local file is a
    *cache*, not the source of truth: if it isn't already present, this pulls
    the durable copy down from Cloud Storage first (see storage_client.py)
    before constructing the manager. A brand-new user has nothing in Storage
    either, so DatabaseManager's own bundled-CSV seeding still runs exactly
    as before — no changes to core/ are needed for tenancy.
    """
    if uid in _managers:
        return _managers[uid]

    with _lock:
        if uid in _managers:
            return _managers[uid]

        db_path = _local_db_path(uid)
        if not os.path.exists(db_path):
            download_user_db(uid, db_path)

        manager = DatabaseManager(db_path=db_path)
        _managers[uid] = manager
        return manager


def sync_user_db_to_storage(uid: str) -> None:
    """Call after any operation that mutates a user's SQLite file (dataset
    upload/delete) to push the durable copy to Cloud Storage. Chat queries
    are read-only by the guardrail's own construction, so they never call this."""
    db_path = _local_db_path(uid)
    if os.path.exists(db_path):
        upload_user_db(uid, db_path)
