from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.auth import get_current_user
from backend.config import get_settings
from backend.firestore_client import ensure_firebase_initialized
from backend.routers import admin, chat, datasets
from backend.schemas.user import CurrentUser

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Must happen before the app accepts its first request: verify_id_token()
    # (used by every authenticated route) requires the Firebase app to
    # already exist, and nothing else in this codebase initializes it early
    # enough on its own. See ensure_firebase_initialized()'s docstring.
    ensure_firebase_initialized()
    yield


app = FastAPI(title="NexusBI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(datasets.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/me", response_model=CurrentUser)
def me(current_user: CurrentUser = Depends(get_current_user)):
    """Lets the Next.js frontend bootstrap the logged-in user's profile + role + quota after sign-in."""
    return current_user
