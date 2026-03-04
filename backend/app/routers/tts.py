"""Text-to-Speech router — ElevenLabs proxy."""

import logging
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.config import settings
from app.models.user import User
from app.routers.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str


def _clean_for_tts(text: str) -> str:
    """Strip markdown formatting and emojis for cleaner speech."""
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"\*(.*?)\*", r"\1", text)
    text = re.sub(r"[^\w\s.,;:!?'\"()\-\u2013\u2014/\n]", "", text, flags=re.UNICODE)
    return text.strip()


@router.post("/speak")
async def text_to_speech(
    body: TTSRequest,
    _user: User = Depends(get_current_user),
):
    """Convert text to speech using ElevenLabs API. Returns audio/mpeg stream."""
    if not settings.ELEVENLABS_API_KEY:
        raise HTTPException(
            status_code=501,
            detail="ElevenLabs API key not configured",
        )

    clean_text = _clean_for_tts(body.text)
    if not clean_text:
        raise HTTPException(status_code=400, detail="Texte vide après nettoyage")

    if len(clean_text) > 5000:
        clean_text = clean_text[:5000]

    voice_id = settings.ELEVENLABS_VOICE_ID

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                headers={
                    "xi-api-key": settings.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
                json={
                    "text": clean_text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.4,
                        "use_speaker_boost": True,
                    },
                },
            )

        if response.status_code != 200:
            logger.error("ElevenLabs API error %s: %s", response.status_code, response.text[:200])
            raise HTTPException(
                status_code=502,
                detail="Erreur du service de synthèse vocale",
            )

        return StreamingResponse(
            iter([response.content]),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline"},
        )

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Timeout du service de synthèse vocale")
    except httpx.HTTPError as e:
        logger.error("ElevenLabs connection error: %s", e)
        raise HTTPException(status_code=502, detail="Erreur de connexion au service de synthèse vocale")
