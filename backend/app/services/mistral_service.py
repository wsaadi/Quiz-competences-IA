"""Mistral AI evaluation service — adaptive AI skills assessment engine."""

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"

# Retry configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds — exponential backoff: 2s, 4s, 8s
RETRY_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.RemoteProtocolError,
)

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

## IMPORTANT — Tes réponses sont lues à voix haute par synthèse vocale
Tes messages seront convertis en parole via synthèse vocale. Tu DOIS donc :
- NE JAMAIS utiliser d'émojis ni de symboles spéciaux (pas de ✅, ❌, 🎯, 💡, etc.)
- NE JAMAIS utiliser de listes à puces (pas de tirets -, ni de *, ni de •, ni de numérotation 1. 2. 3.)
- NE JAMAIS utiliser de mise en forme markdown (pas de **gras**, pas de *italique*, pas de `code`)
- Écrire uniquement en phrases complètes, fluides et naturelles, comme si tu parlais vraiment
- Utiliser des phrases courtes à moyennes, séparées par des virgules et des points pour un rythme naturel
- Enchaîner les idées avec des connecteurs oraux naturels : "alors", "du coup", "en fait", "par exemple", "et puis", "d'ailleurs"
- Quand tu veux énumérer des éléments, les intégrer dans une phrase fluide : "il y a d'abord X, ensuite Y, et enfin Z"
- Épeler les sigles lettre par lettre en les séparant par des points : I.A., L.L.M., R.A.G., A.P.I.
- Éviter les parenthèses longues, préférer des phrases séparées

## Ton rôle
Tu évalues les compétences IA à travers une conversation naturelle de ~30 minutes.
Tu es UNIQUEMENT une évaluatrice. Tu ne dois JAMAIS :
- Proposer de créer du contenu, des prompts, des documents, des emails ou quoi que ce soit pour l'utilisateur
- Donner des cours ou faire du tutorat détaillé
- Résoudre des problèmes techniques pour le candidat
- Fournir des ressources, tutoriels ou formations
Tu restes 100% dans ton rôle d'évaluation. Si le candidat te demande de l'aide, rappelle gentiment que tu es là pour évaluer ses compétences et propose de continuer l'évaluation.

## ÉTAPE OBLIGATOIRE — Première question
Dès le tout début de la conversation (phase ACCUEIL), tu DOIS impérativement demander au collaborateur :
1. Son **poste / rôle** dans l'entreprise (ex: développeur, chef de projet, commercial, manager, RH, designer, etc.)
2. Son **métier / domaine d'activité** (ex: IT, marketing, finance, logistique, etc.)
3. Son **usage actuel de l'IA** au quotidien (ex: aucun, ChatGPT occasionnel, Copilot, outils spécialisés, etc.)

Ces informations sont ESSENTIELLES pour adapter toute la suite de l'évaluation.

## Adaptation au profil métier
En fonction du poste/métier déclaré, adapte tes questions :
- **Profils techniques** (dev, data, DevOps, IT) : tu peux poser des questions poussées sur l'architecture, le code, les APIs, le fine-tuning, RAG, MLOps
- **Profils fonctionnels** (chef de projet, product owner, consultant) : oriente vers la gestion de projet IA, les cas d'usage métier, la compréhension des capacités/limites, la conduite du changement
- **Profils commerciaux** (commercial, business dev, account manager) : évalue la capacité à comprendre et vendre des solutions IA, la connaissance du marché, le discours client
- **Profils managériaux** (manager, directeur, C-level) : évalue la vision stratégique, la compréhension des enjeux, la capacité à piloter des projets IA, les aspects éthiques/réglementaires
- **Profils créatifs/communication** (marketing, design, communication) : évalue l'usage d'outils IA créatifs, la compréhension des capacités génératives, l'intégration dans les workflows créatifs

IMPORTANT : Quel que soit le profil, continue TOUJOURS à augmenter la complexité si le candidat répond bien. On ne limite pas un profil fonctionnel aux questions faciles — si quelqu'un excelle, on pousse plus loin pour trouver les pépites cachées.

## Les domaines à évaluer (scores de 0 à 100 chacun) :
1. **Connaissance du marché IA** : acteurs, produits, tendances, actualité
2. **Terminologie** : vocabulaire technique (LLM, RAG, fine-tuning, tokens, embeddings, etc.)
3. **Intérêt & curiosité** : motivation, envie d'apprendre, perception de l'IA
4. **Veille personnelle** : sources d'info, newsletters, communautés, habitudes de veille
5. **Niveau technique** : compréhension des concepts techniques (architectures, modèles, etc.)
6. **Capacité à utiliser l'IA** : prompt engineering, utilisation d'outils IA au quotidien
7. **Intégration & déploiement** : APIs, pipelines, MLOps, mise en production
8. **Conception & développement** : création de solutions IA, coding, fine-tuning, RAG

## GRILLE DE NOTATION STRICTE — Être objectif et exigeant
Le scoring doit être réaliste et discriminant. Voici les critères de niveau :

### Débutant (score global 0-25) :
- Connaît quelques mots (IA, ChatGPT) sans pouvoir les expliquer
- N'utilise pas ou très peu d'outils IA
- Ne suit aucune actualité IA
- Aucune compréhension technique

### Intermédiaire (score global 26-50) :
- Utilise des outils IA (ChatGPT, Copilot) de façon basique
- Connaît les termes courants (LLM, prompt, token) MAIS ne sait pas les expliquer en profondeur
- Suit l'actualité IA de façon passive (articles occasionnels)
- Comprend le concept général sans maîtrise technique
- ATTENTION : Connaître les mots LLM/prompt/token et avoir utilisé Copilot = INTERMÉDIAIRE, PAS avancé

### Avancé (score global 51-75) :
- Sait expliquer comment fonctionne un LLM (transformer, attention, tokenization)
- Maîtrise le prompt engineering avancé (few-shot, chain-of-thought, system prompts)
- A déjà intégré des APIs IA dans des projets (OpenAI API, Mistral, etc.)
- Comprend les concepts de RAG, fine-tuning, embeddings ET sait les appliquer
- Fait de la veille active et structurée (newsletters spécialisées, communautés, expérimentation)
- Peut concevoir une architecture technique impliquant de l'IA

### Expert (score global 76-100) :
- A conçu et déployé des solutions IA en production
- Maîtrise le fine-tuning, le RAG, les pipelines ML de bout en bout
- Comprend en profondeur les architectures transformer, les stratégies d'entraînement
- Contribue à l'écosystème IA (open source, articles, conférences, formation)
- Vision stratégique claire sur l'impact de l'IA dans son domaine
- Capable d'évaluer et choisir des modèles/solutions adaptées à des besoins métier complexes

### Règles de scoring par domaine :
- **0-10** : Ne connaît pas le domaine, aucune réponse pertinente
- **11-25** : A entendu parler, réponses très vagues ou incorrectes
- **26-40** : Connaissances superficielles, sait citer des noms/termes sans comprendre
- **41-55** : Compréhension correcte des bases, quelques applications concrètes
- **56-70** : Bonne maîtrise, capable d'expliquer et d'appliquer
- **71-85** : Très bonne maîtrise, expertise démontrée avec des exemples concrets
- **86-100** : Excellence, expertise pointue avec réalisations concrètes et vision

RAPPEL : Un responsable qui connaît les mots "LLM", "prompt", "token" et a utilisé Copilot obtient maximum 40-45/100, PAS 80/100. Connaître du vocabulaire ne signifie pas maîtriser. Il faut des preuves concrètes d'application et de compréhension.

## Phases de l'évaluation
1. **ACCUEIL** (2-3 messages) : Présente-toi, mets à l'aise, et pose OBLIGATOIREMENT la question sur le poste, le métier et l'usage actuel de l'IA
2. **CALIBRAGE** (3-5 messages) : Questions générales pour jauger le niveau de départ, adaptées au profil déclaré
3. **EXPLORATION** (10-15 messages) : Questions adaptatives couvrant tous les domaines, orientées métier
4. **APPROFONDISSEMENT** (5-8 messages) : Creuse les domaines où le candidat semble fort — pousse la complexité sans limite
5. **CONCLUSION** (1-2 messages) : Remercie et conclue chaleureusement

## Règles d'adaptation
- Si le candidat galère → redescends en douceur, pose des questions plus simples
- Si le candidat excelle → monte en complexité progressivement, SANS LIMITE — on cherche les pépites
- Alterne les types de questions : QCM rapides, questions ouvertes, mises en situation, scénarios pratiques
- Couvre TOUS les domaines même si le candidat est faible
- Demande TOUJOURS des exemples concrets et des preuves d'application avant de donner un score élevé
- Ne te contente pas de réponses théoriques : valide par des mises en situation

## TRÈS IMPORTANT — Format de réponse
Tu dois TOUJOURS répondre avec un JSON valide encapsulé dans des balises, suivi de ton message conversationnel.
Le JSON doit être sur UNE SEULE ligne entre les balises.

Format EXACT à respecter :
<eval_meta>{"phase":"ACCUEIL","progress":5,"domains_covered":[],"current_difficulty":"debutant","notes":"","job_role":"","job_domain":""}</eval_meta>

[Ton message conversationnel ici]

Les phases possibles : ACCUEIL, CALIBRAGE, EXPLORATION, APPROFONDISSEMENT, CONCLUSION, SCORING
Les difficultés : debutant, intermediaire, avance, expert
Le progress va de 0 à 100
job_role et job_domain doivent être remplis dès que le candidat les communique.

Quand la phase est SCORING (dernière interaction), le JSON doit contenir les scores :
<eval_meta>{"phase":"SCORING","progress":100,"scores":{"market_knowledge":70,"terminology":65,"interest_curiosity":80,"personal_watch":55,"technical_level":60,"ai_usage":75,"integration_deployment":40,"conception_dev":35},"detected_level":"intermediaire","feedback_collaborator":"[feedback encourageant 3-5 phrases]","feedback_admin":"[feedback détaillé et objectif 5-8 phrases incluant le profil métier évalué, les points forts, les axes d'amélioration et des recommandations de formation]","job_role":"[poste du candidat]","job_domain":"[domaine métier]"}</eval_meta>

[Message de conclusion]
"""


async def call_mistral(messages: list[dict]) -> tuple[str, dict]:
    """Call Mistral AI chat completion API with retry and exponential backoff.

    Returns (content, usage_dict) where usage_dict has prompt_tokens and completion_tokens.
    """
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

    last_exception: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(MISTRAL_CHAT_URL, json=payload, headers=headers)

                # Retry on 429 (rate limit) and 5xx (server errors)
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < MAX_RETRIES:
                        delay = RETRY_BASE_DELAY * (2 ** attempt)
                        logger.warning(
                            "Mistral API returned %s, retrying in %ss (attempt %d/%d)",
                            response.status_code, delay, attempt + 1, MAX_RETRIES,
                        )
                        await asyncio.sleep(delay)
                        continue
                    response.raise_for_status()

                response.raise_for_status()
                data = response.json()
                usage = data.get("usage", {})
                return data["choices"][0]["message"]["content"], usage

        except RETRY_EXCEPTIONS as exc:
            last_exception = exc
            if attempt < MAX_RETRIES:
                delay = RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Mistral connection error (%s), retrying in %ss (attempt %d/%d)",
                    type(exc).__name__, delay, attempt + 1, MAX_RETRIES,
                )
                await asyncio.sleep(delay)
            else:
                logger.error("Mistral API failed after %d retries: %s", MAX_RETRIES, exc)
                raise

    # Should not reach here, but just in case
    raise last_exception or httpx.ConnectError("Mistral API unreachable after retries")


# Mutable container to capture streaming usage from the last SSE chunk
_last_stream_usage: dict = {}


def get_last_stream_usage() -> dict:
    """Return usage dict captured from the last stream_mistral call."""
    return dict(_last_stream_usage)


async def stream_mistral(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream Mistral AI chat completion, yielding text chunks as they arrive."""
    global _last_stream_usage
    _last_stream_usage = {}

    headers = {
        "Authorization": f"Bearer {settings.MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.MISTRAL_MODEL,
        "messages": messages,
        "temperature": 0.7,
        "max_tokens": 2000,
        "stream": True,
        "stream_options": {"include_usage": True},
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(connect=10.0, read=60.0, write=10.0, pool=5.0)) as client:
        async with client.stream("POST", MISTRAL_CHAT_URL, json=payload, headers=headers) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                logger.error("Mistral streaming error %s: %s", response.status_code, error_body[:300])
                # Fallback to non-streaming
                fallback_content, fallback_usage = await call_mistral(messages)
                _last_stream_usage = fallback_usage
                yield fallback_content
                return

            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data_str = line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    data = json.loads(data_str)
                    # Capture usage from any chunk that has it (usually the last)
                    if "usage" in data and data["usage"]:
                        _last_stream_usage = data["usage"]
                    delta = data.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        yield content
                except (json.JSONDecodeError, IndexError, KeyError):
                    continue


# Sentence boundary detection for streaming TTS pipeline
_SENTENCE_TERMINATORS = frozenset(".!?…")
_CLAUSE_SEPARATORS = frozenset(",;:")


def split_into_sentences(text: str) -> tuple[list[str], str]:
    """Split text at sentence boundaries, returning (complete_sentences, remaining_buffer).

    Splits at . ! ? … and also at , ; : if the clause is long enough (>80 chars)
    to feed ElevenLabs with natural-sounding chunks.
    """
    sentences: list[str] = []
    current = ""
    i = 0
    while i < len(text):
        ch = text[i]
        current += ch

        if ch in _SENTENCE_TERMINATORS:
            # Look ahead: skip if followed by more terminators or digits (e.g. "1.5")
            if i + 1 < len(text) and (text[i + 1].isdigit() or text[i + 1] in _SENTENCE_TERMINATORS):
                i += 1
                continue
            sentence = current.strip()
            if sentence:
                sentences.append(sentence)
            current = ""
        elif ch in _CLAUSE_SEPARATORS and len(current.strip()) > 80:
            # Split at clause separator if the chunk is long enough for smooth TTS
            sentence = current.strip()
            if sentence:
                sentences.append(sentence)
            current = ""

        i += 1

    return sentences, current


def parse_eval_meta(response_text: str) -> tuple[dict | None, str]:
    """Extract evaluation metadata JSON from the response and return (meta, clean_message).

    Handles multiple failure modes:
    - Missing closing tag: tries to find JSON from opening tag to end of string
    - No tags at all: tries to detect raw JSON blocks
    - Malformed JSON: strips it and returns the conversational part only
    """
    import re

    meta = None
    clean_message = response_text

    start_tag = "<eval_meta>"
    end_tag = "</eval_meta>"

    start_idx = response_text.find(start_tag)
    end_idx = response_text.find(end_tag)

    if start_idx != -1 and end_idx != -1:
        # Happy path: both tags present
        json_str = response_text[start_idx + len(start_tag):end_idx].strip()
        try:
            meta = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning("Failed to parse eval_meta JSON: %s", json_str)

        clean_message = (
            response_text[:start_idx] + response_text[end_idx + len(end_tag):]
        ).strip()

    elif start_idx != -1 and end_idx == -1:
        # Opening tag but no closing tag — try to extract JSON anyway
        remainder = response_text[start_idx + len(start_tag):].strip()
        # Find the first { ... } block
        brace_start = remainder.find("{")
        if brace_start != -1:
            depth = 0
            for i, ch in enumerate(remainder[brace_start:], brace_start):
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        json_str = remainder[brace_start:i + 1]
                        try:
                            meta = json.loads(json_str)
                        except json.JSONDecodeError:
                            logger.warning("Failed to parse eval_meta JSON (no closing tag): %s", json_str)
                        break

        # Remove everything from the start tag onward
        clean_message = response_text[:start_idx].strip()

    else:
        # No tags at all — check for raw JSON block that looks like eval metadata
        json_pattern = re.search(
            r'\{[^{}]*"phase"\s*:\s*"[A-Z]+"[^{}]*\}',
            response_text,
        )
        if json_pattern:
            try:
                meta = json.loads(json_pattern.group())
            except json.JSONDecodeError:
                pass
            # Remove the JSON block from the message
            clean_message = (
                response_text[:json_pattern.start()] + response_text[json_pattern.end():]
            ).strip()

    # Final safety: strip any remaining JSON-like blocks or tags from clean_message
    clean_message = re.sub(r'</?eval_meta>', '', clean_message)
    clean_message = re.sub(
        r'\{[^{}]*"phase"\s*:\s*"[A-Z]+"[^{}]*\}',
        '',
        clean_message,
    ).strip()

    return meta, clean_message


async def evaluate_message(
    conversation_history: list[dict],
    user_message: str,
) -> tuple[str, dict | None, dict]:
    """
    Process a user message through the evaluation engine.

    Returns (assistant_response_text, eval_metadata_or_none, usage_dict).
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    raw_response, usage = await call_mistral(messages)
    meta, clean_message = parse_eval_meta(raw_response)

    return clean_message, meta, usage


async def generate_final_scoring(conversation_history: list[dict]) -> tuple[str, dict | None, dict]:
    """Force the AI to produce final scores after the conversation."""
    scoring_prompt = (
        "L'évaluation est maintenant terminée. Génère le scoring final avec la phase SCORING. "
        "Évalue chaque domaine de 0 à 100 en te basant sur TOUTE la conversation et en appliquant la GRILLE DE NOTATION STRICTE. "
        "RAPPEL : connaître quelques termes (LLM, prompt, token) et avoir utilisé Copilot = score 35-45 maximum, pas plus. "
        "Seules des preuves concrètes d'application et de compréhension profonde justifient des scores élevés. "
        "Rédige un feedback_collaborator encourageant et bienveillant (3-5 phrases). "
        "Rédige un feedback_admin détaillé et objectif (5-8 phrases incluant le profil métier, les points forts, "
        "les axes d'amélioration et des recommandations de formation adaptées au poste). "
        "Détermine le detected_level parmi : debutant, intermediaire, avance, expert. "
        "Inclus le job_role et job_domain du candidat dans le JSON."
    )
    return await evaluate_message(conversation_history, scoring_prompt)
