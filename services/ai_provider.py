from __future__ import annotations

import json
import httpx

from core.config import settings


class AIProviderError(RuntimeError):
    pass


class AIProvider:
    @staticmethod
    def _config() -> tuple[str, str, str]:
        provider = getattr(settings, "AI_PROVIDER", "openrouter").lower()
        model = getattr(settings, "AI_MODEL", "openai/gpt-4o-mini")
        if provider == "openai":
            key = getattr(settings, "OPENAI_API_KEY", "")
            return provider, model, key
        key = getattr(settings, "OPENROUTER_API_KEY", "")
        return "openrouter", model, key

    @classmethod
    async def chat(cls, system: str, user: str) -> str:
        provider, model, key = cls._config()
        if not key:
            raise AIProviderError("AI provider is not configured on the server.")

        if provider == "openai":
            url = "https://api.openai.com/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
        else:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

        payload = {
            "model": model,
            "temperature": 0.15,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=payload)
        if response.status_code >= 400:
            raise AIProviderError(f"AI provider returned HTTP {response.status_code}.")
        data = response.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise AIProviderError("AI provider returned an invalid response.") from exc

    @classmethod
    async def analyze_context(cls, context: dict, question: str) -> str:
        system = (
            "You are a trading analysis copilot. Use ONLY the supplied structured market context. "
            "Never invent prices, indicators, backtest results, order-book values or exchange data. "
            "Do not promise profitability. Distinguish analysis from an executable signal. "
            "If a required value is null or absent, say that real-time data is insufficient."
        )
        return await cls.chat(system, json.dumps({"marketContext": context, "question": question}, separators=(",", ":")))
