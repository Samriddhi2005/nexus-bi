import os
from functools import lru_cache
from typing import List, Optional

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()


class Settings(BaseSettings):
    """
    Central backend configuration, sourced from environment variables / .env.
    Mirrors the naming already used by core/llm_factory.py for LLM keys so the
    same .env file can serve both the legacy Streamlit app and this API.
    """

    # Firebase Admin SDK credentials (either a path to the service account
    # JSON file, or the JSON content itself as a single env var).
    firebase_service_account_path: Optional[str] = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    firebase_service_account_json: Optional[str] = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    firebase_project_id: Optional[str] = os.getenv("FIREBASE_PROJECT_ID")
    # Firebase Cloud Storage bucket holding the durable copy of each user's
    # SQLite file (see backend/storage_client.py) — same value as the
    # frontend's NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, e.g. "nexus-bl.firebasestorage.app".
    firebase_storage_bucket: Optional[str] = os.getenv("FIREBASE_STORAGE_BUCKET")

    # Product-managed LLM provider keys (server-side; never sent to the client).
    groq_api_key: Optional[str] = os.getenv("GROQ_API_KEY")
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")

    default_llm_provider: str = os.getenv("DEFAULT_LLM_PROVIDER", "groq")
    default_llm_model: str = os.getenv("DEFAULT_LLM_MODEL", "openai/gpt-oss-120b")

    # Per-user isolated SQLite databases live here: data_store/<uid>/nexus_bi.db
    data_store_dir: str = os.getenv("DATA_STORE_DIR", "data_store")

    # Free-tier daily query quota (product-managed key usage metering).
    daily_query_quota_free: int = int(os.getenv("DAILY_QUERY_QUOTA_FREE", "50"))
    daily_query_quota_pro: int = int(os.getenv("DAILY_QUERY_QUOTA_PRO", "1000"))

    # CORS: comma-separated list of allowed origins for the Next.js frontend.
    # Kept as a plain str field, not List[str]: pydantic-settings treats any
    # list-typed field as "complex" and tries to json.loads() the raw env var
    # before validation ever runs. That's invisible with .env files (an unset
    # var never reaches the decoder — it just falls back to the Python-level
    # default), but crashes immediately the moment a real environment
    # variable is set, e.g. on Render, since "http://localhost:3000" isn't
    # valid JSON. Splitting it ourselves in a property sidesteps that source
    # entirely.
    cors_origins_raw: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
