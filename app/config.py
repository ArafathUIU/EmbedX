from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    app_name: str = "EmbedX"
    app_version: str = "0.1.0"
    debug: bool = False

    qdrant_url: str = "http://localhost:6333"
    qdrant_api_key: str = ""
    qdrant_collection_name: str = "embedx_documents"
    vector_dimension: int = 384

    embedding_model: str = "all-MiniLM-L6-v2"

    llm_api_key: str = ""
    llm_base_url: str = "https://opencode.ai/zen/go/v1"
    llm_model: str = "deepseek-v4-pro"

    chunk_size: int = 500
    chunk_overlap: int = 50

    top_k_retrieval: int = 5


settings = Settings()
