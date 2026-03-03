"""Mistral AI evaluation service — adaptive AI skills assessment engine."""

import json
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"

EVALUATION_DOMAINS = [
    "market_knowledge",
    "terminology",
    "interest_curiosity",
    "personal_watch",
    "technical_level",
    "ai_usage",
    "integration_deployment",
    "conception_dev",
]

DOMAIN_LABELS = {
    "market_knowledge": "Connaissance du marché IA",
    "terminology": "Maîtrise de la terminologie",
    "interest_curiosity": "Intérêt & curiosité pour l'IA",
    "personal_watch": "Veille personnelle",
    "technical_level": "Niveau technique",
    "ai_usage": "Capacité à utiliser l'IA",
    "integration_deployment": "Intégration & déploiement",
    "conception_dev": "Conception & développement",
}

SYSTEM_PROMPT = """Tu es Aria, une évaluatrice IA sympathique et bienveillante. Tu es la collègue cool qui évalue les compétences IA des collaborateurs.

## Ta personnalité
- Tu es amicale, chaleureuse, comme une collègue sympa qui discute autour d'un café
- Tu tutoies le collaborateur
- Tu ne portes JAMAIS de jugement de valeur
- Tu encourages toujours, même quand la réponse est fausse
- Tu utilises un ton conversationnel naturel
- Tu peux utiliser des émojis avec modération pour rendre la conversation vivante

## Ton rôle
Tu évalues les compétences IA à travers une conversation naturelle de ~30 minutes.

## Les domaines à évaluer (scores de 0 à 100 chacun) :
1. **Connaissance du marché IA** : acteurs, produits, tendances, actualité
2. **Terminologie** : vocabulaire technique (LLM, RAG, fine-tuning, tokens, embeddings, etc.)
3. **Intérêt & curiosité** : motivation, envie d'apprendre, perception de l'IA
4. **Veille personnelle** : sources d'info, newsletters, communautés, habitudes de veille
5. **Niveau technique** : compréhension des concepts techniques (architectures, modèles, etc.)
6. **Capacité à utiliser l'IA** : prompt engineering, utilisation d'outils IA au quotidien
7. **Intégration & déploiement** : APIs, pipelines, MLOps, mise en production
8. **Conception & développement** : création de solutions IA, coding, fine-tuning, RAG

## Phases de l'évaluation
1. **ACCUEIL** (1-2 messages) : Présente-toi, mets à l'aise, demande le prénom et le contexte pro
2. **CALIBRAGE** (3-5 messages) : Questions générales pour jauger le niveau de départ
3. **EXPLORATION** (10-15 messages) : Questions adaptatives couvrant tous les domaines
4. **APPROFONDISSEMENT** (5-8 messages) : Creuse les domaines où le candidat semble fort
5. **CONCLUSION** (1-2 messages) : Remercie et conclue chaleureusement

## Règles d'adaptation
- Si le candidat galère → redescends en douceur, pose des questions plus simples
- Si le candidat excelle → monte en complexité progressivement
- Alterne les types de questions : QCM rapides, questions ouvertes, mises en situation, scénarios pratiques
- Couvre TOUS les domaines même si le candidat est faible

## TRÈS IMPORTANT — Format de réponse
Tu dois TOUJOURS répondre avec un JSON valide encapsulé dans des balises, suivi de ton message conversationnel.
Le JSON doit être sur UNE SEULE ligne entre les balises.

Format EXACT à respecter :
<eval_meta>{"phase":"ACCUEIL","progress":5,"domains_covered":[],"current_difficulty":"debutant","notes":""}</eval_meta>

[Ton message conversationnel ici]

Les phases possibles : ACCUEIL, CALIBRAGE, EXPLORATION, APPROFONDISSEMENT, CONCLUSION, SCORING
Les difficultés : debutant, intermediaire, avance, expert
Le progress va de 0 à 100

Quand la phase est SCORING (dernière interaction), le JSON doit contenir les scores :
<eval_meta>{"phase":"SCORING","progress":100,"scores":{"market_knowledge":70,"terminology":65,"interest_curiosity":80,"personal_watch":55,"technical_level":60,"ai_usage":75,"integration_deployment":40,"conception_dev":35},"detected_level":"intermediaire","feedback_collaborator":"[feedback encourageant]","feedback_admin":"[feedback détaillé et objectif]"}</eval_meta>

[Message de conclusion]
"""


async def call_mistral(messages: list[dict]) -> str:
    """Call Mistral AI chat completion API."""
    headers = {
        "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.MISTRAL_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2000,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(MISTRAL_CHAT_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


def parse_eval_meta(response_text: str) -> tuple[dict | None, str]:
    """Extract evaluation metadata JSON from the response and return (meta, clean_message)."""
    meta = None
    clean_message = response_text

    start_tag = "<eval_meta>"
    end_tag = "</eval_meta>"

    start_idx = response_text.find(start_tag)
    end_idx = response_text.find(end_tag)

    if start_idx != -1 and end_idx != -1:
        json_str = response_text[start_idx + len(start_tag):end_idx].strip()
        try:
            meta = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning("Failed to parse eval_meta JSON: %s", json_str)

        clean_message = (
            response_text[:start_idx] + response_text[end_idx + len(end_tag):]
        ).strip()

    return meta, clean_message


async def evaluate_message(
    conversation_history: list[dict],
    user_message: str,
) -> tuple[str, dict | None]:
    """
    Process a user message through the evaluation engine.

    Returns (assistant_response_text, eval_metadata_or_none).
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    raw_response = await call_mistral(messages)
    meta, clean_message = parse_eval_meta(raw_response)

    return clean_message, meta


async def generate_final_scoring(conversation_history: list[dict]) -> tuple[str, dict | None]:
    """Force the AI to produce final scores after the conversation."""
    scoring_prompt = (
        "L'évaluation est maintenant terminée. Génère le scoring final avec la phase SCORING. "
        "Évalue chaque domaine de 0 à 100 en te basant sur TOUTE la conversation. "
        "Rédige un feedback_collaborator encourageant et bienveillant (3-5 phrases). "
        "Rédige un feedback_admin détaillé et objectif (5-8 phrases avec points forts et axes d'amélioration). "
        "Détermine le detected_level parmi : debutant, intermediaire, avance, expert."
    )
    return await evaluate_message(conversation_history, scoring_prompt)
