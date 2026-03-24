"""Utility for logging API usage to the database."""

import asyncio
import logging
from app.core.database import async_session
from app.models.config import ApiUsageLog

logger = logging.getLogger(__name__)

_MAX_RETRIES = 4
_RETRY_DELAYS = [0.5, 1.0, 2.0, 4.0]


async def log_api_usage(
    service: str,
    endpoint: str,
    tokens_in: int = 0,
    tokens_out: int = 0,
    characters: int = 0,
    evaluation_id: int | None = None,
    user_id: int | None = None,
):
    """Fire-and-forget usage logging with retry on transient DB errors."""
    for attempt in range(_MAX_RETRIES + 1):
        try:
            async with async_session() as session:
                session.add(ApiUsageLog(
                    service=service,
                    endpoint=endpoint,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    characters=characters,
                    evaluation_id=evaluation_id,
                    user_id=user_id,
                ))
                await session.commit()
            return
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(_RETRY_DELAYS[attempt])
            else:
                logger.warning("Failed to log API usage after %d retries: %s", _MAX_RETRIES, exc)
