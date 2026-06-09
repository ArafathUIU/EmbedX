from __future__ import annotations

from functools import lru_cache

from openai import OpenAI

from app.config import settings


SYSTEM_PROMPT = """You are a helpful assistant that answers questions based on provided context.
Answer concisely using only the provided context. If the context does not contain enough
information to answer the question, say so. Do not make up information."""


class LLMClient:
    def __init__(self) -> None:
        self._client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        self._model = settings.deepseek_model

    def generate(self, prompt: str, context: str) -> str:
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {prompt}"},
        ]
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            max_tokens=512,
            temperature=0.3,
        )
        return response.choices[0].message.content or ""


@lru_cache()
def get_llm_client() -> LLMClient:
    return LLMClient()
