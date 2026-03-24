import secrets
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Quiz Compétences IA"
    DEBUG: bool = False

    # Database — default SQLite for dev, PostgreSQL for production
    # Production example: "postgresql+asyncpg://user:pass@db:5432/quiz_ia"
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/quiz_ia.db"
    DB_POOL_SIZE: int = 10  # Connection pool size (PostgreSQL only)
    DB_MAX_OVERFLOW: int = 20  # Extra connections above pool_size

    # JWT
    SECRET_KEY: str = secrets.token_urlsafe(64)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Mistral AI
    MISTRAL_API_KEY: str = ""
    MISTRAL_MODEL: str = "mistral-large-latest"

    # ElevenLabs TTS & STT
    ELEVENLABS_API_KEY: str = ""
    ELEVENLABS_VOICE_ID: str = "21m00Tcm4TlvDq8ikWAM"  # "Rachel" — warm, friendly female voice
    ELEVENLABS_MODEL: str = "eleven_turbo_v2_5"  # Low-latency model (~2x faster than multilingual_v2)
    ELEVENLABS_OPTIMIZE_LATENCY: int = 3  # 0-4, higher = lower latency (slight quality tradeoff)

    # Scaleway Generative API (pseudonymization)
    SCW_ACCESS_KEY: str = ""
    SCW_SECRET_KEY: str = ""
    SCW_GENERATIVE_API_URL: str = "https://api.scaleway.ai/v1/chat/completions"
    SCW_MODEL: str = "mistral-small-3.2-24b-instruct-2506"

    # Security
    BCRYPT_ROUNDS: int = 12
    MAX_LOGIN_ATTEMPTS: int = 5
    LOGIN_LOCKOUT_MINUTES: int = 15
    RATE_LIMIT: str = "30/minute"

    # Redis — for rate limiting & shared state across workers
    # Leave empty to use in-memory (single-worker dev mode)
    REDIS_URL: str = ""

    # CORS
    CORS_ORIGINS: str = "http://localhost:4200"

    # Uvicorn workers (used by Docker entrypoint)
    UVICORN_WORKERS: int = 1

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
