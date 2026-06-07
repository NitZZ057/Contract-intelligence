import logging
from functools import lru_cache
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from app.core.config import settings

logger = logging.getLogger(__name__)

@lru_cache()
def get_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_model,
        temperature=settings.llm_temperature,
        openai_api_key=settings.openai_api_key,
        streaming=True,
        max_retries=3,
        request_timeout=60,
    )

@lru_cache()
def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        openai_api_key=settings.openai_api_key,
    )