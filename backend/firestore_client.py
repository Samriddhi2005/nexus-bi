import json
from functools import lru_cache

import firebase_admin
from firebase_admin import credentials, firestore

from backend.config import get_settings


def ensure_firebase_initialized() -> None:
    """
    Call once at server startup. `firebase_auth.verify_id_token()` (used by
    every authenticated request, in backend/auth.py) requires the default
    Firebase app to already exist — but every route that would otherwise
    trigger that lazily, via get_firestore_client() below, sits *behind*
    verify_id_token() in the request flow. Left unfixed, that's a deadlock:
    nothing ever initializes the app, so every authenticated request fails
    with "Invalid or expired token" forever, regardless of how valid the
    token actually is.
    """
    _init_firebase_app()


def _init_firebase_app() -> firebase_admin.App:
    if firebase_admin._apps:
        return firebase_admin.get_app()

    settings = get_settings()

    if settings.firebase_service_account_json:
        cred = credentials.Certificate(json.loads(settings.firebase_service_account_json))
    elif settings.firebase_service_account_path:
        cred = credentials.Certificate(settings.firebase_service_account_path)
    else:
        raise RuntimeError(
            "Firebase credentials missing. Set FIREBASE_SERVICE_ACCOUNT_PATH "
            "(path to the service account JSON) or FIREBASE_SERVICE_ACCOUNT_JSON "
            "(inline JSON) in your backend .env file."
        )

    options = {}
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id
    if settings.firebase_storage_bucket:
        options["storageBucket"] = settings.firebase_storage_bucket

    return firebase_admin.initialize_app(cred, options or None)


@lru_cache
def get_firestore_client() -> firestore.Client:
    _init_firebase_app()
    return firestore.client()
