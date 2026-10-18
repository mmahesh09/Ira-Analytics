"""One OpenRouter client for every AI feature (GEO visibility probes, AI content rewrites)."""

import json
import re

import httpx

from .config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


async def chat(client: httpx.AsyncClient, model: str, prompt: str, max_tokens: int = 500, system: str | None = None) -> dict:
    messages = ([{"role": "system", "content": system}] if system else []) + [{"role": "user", "content": prompt}]
    resp = await client.post(
        OPENROUTER_URL,
        headers={"Authorization": f"Bearer {settings.openrouter_api_key}", "X-Title": "Rankwise"},
        json={"model": model, "max_tokens": max_tokens, "messages": messages},
        timeout=45,
    )
    resp.raise_for_status()
    body = resp.json()
    return {"text": body["choices"][0]["message"]["content"] or "", "citations": body.get("citations") or []}


def first_json_object(text: str) -> dict:
    """Models sometimes wrap JSON in prose or code fences; take the outermost object."""
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("No JSON object in the model reply")
    data = json.loads(match.group(0))
    if not isinstance(data, dict):
        raise ValueError("Model reply is not a JSON object")
    return data
