"""Quiz Compétences IA — FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings
from app.core.database import init_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
import app.models.config  # noqa: F401 — register models for table creation
from app.routers import auth, evaluation, admin, tts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Rate limiter: use Redis when configured (multi-worker safe), else in-memory
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.REDIS_URL or None,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Quiz Compétences IA...")
    os.makedirs("data", exist_ok=True)
    await init_db()
    await _seed_admin()
    await _seed_defaults()
    yield
    # Cleanup shared httpx client for TTS/STT
    from app.routers.tts import _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
    logger.info("Shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Cache-Control"] = "no-store"
    return response

# Routers
app.include_router(auth.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(tts.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/branding")
async def get_branding():
    """Public endpoint returning branding config (app name, logo/favicon URLs)."""
    from sqlalchemy import select
    from app.core.database import async_session as _async_session
    from app.models.config import AppConfig

    result = {}
    try:
        async with _async_session() as session:
            rows = await session.execute(select(AppConfig))
            for row in rows.scalars().all():
                result[row.key] = row.value
    except Exception:
        pass

    return {
        "app_name": result.get("app_name", settings.APP_NAME),
        "has_logo": bool(result.get("logo_path")),
        "has_favicon": bool(result.get("favicon_path")),
    }


async def _seed_admin():
    """Create default admin user if none exists."""
    from sqlalchemy import select
    from app.core.database import async_session

    async with async_session() as session:
        result = await session.execute(select(User).where(User.role == UserRole.ADMIN))
        if result.scalar_one_or_none() is None:
            admin_user = User(
                email="admin@company.com",
                username="admin",
                full_name="Administrateur",
                hashed_password=get_password_hash("Admin@2024!"),
                role=UserRole.ADMIN,
            )
            session.add(admin_user)
            await session.commit()
            logger.info("Default admin user created (admin / Admin@2024!)")


async def _seed_defaults():
    """Seed default AppConfig and CostConfig entries if missing."""
    from sqlalchemy import select
    from app.core.database import async_session
    from app.models.config import AppConfig, CostConfig

    async with async_session() as session:
        # Default app config
        defaults = {
            "app_name": settings.APP_NAME,
            "elevenlabs_voice_id": settings.ELEVENLABS_VOICE_ID,
        }
        for key, val in defaults.items():
            existing = await session.execute(select(AppConfig).where(AppConfig.key == key))
            if not existing.scalar_one_or_none():
                session.add(AppConfig(key=key, value=val))

        # Default cost config
        cost_defaults = [
            ("mistral_cost_per_1m_tokens_in", 2.0, "Mistral - coût / 1M tokens IN (EUR)"),
            ("mistral_cost_per_1m_tokens_out", 6.0, "Mistral - coût / 1M tokens OUT (EUR)"),
            ("elevenlabs_cost_per_1k_chars", 0.30, "ElevenLabs - coût / 1000 caractères (EUR)"),
        ]
        for key, val, label in cost_defaults:
            existing = await session.execute(select(CostConfig).where(CostConfig.key == key))
            if not existing.scalar_one_or_none():
                session.add(CostConfig(key=key, value=val, label=label))

        await session.commit()
