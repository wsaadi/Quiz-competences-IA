"""Quiz Compétences IA — FastAPI application entry point."""

import logging
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
from app.routers import auth, evaluation, admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Quiz Compétences IA...")
    await init_db()
    await _seed_admin()
    yield
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


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


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
