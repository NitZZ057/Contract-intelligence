import logging
from functools import lru_cache
from typing import List
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Application
    app_name: str = "Contract Intelligence API"
    app_version: str = "1.0.0"
    environment: str = Field(default="development", pattern="^(development|staging|production)$")
    debug: bool = False
    # Security
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # OpenAI
    openai_api_key: str = Field(..., min_length=1)
    pinecone_api_key: str = Field(..., min_length=1)
    pinecone_index_name: str = "contract-intelligence"
    database_url: str = Field(..., min_length=1)

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LLM
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    llm_temperature: float = 0.0
    upload_dir: str = "uploads"
    max_upload_size_bytes: int = 10 * 1024 * 1024


    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        if not v.startswith("postgresql"):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        return v

    @field_validator("debug", mode="before")
    @classmethod
    def normalize_debug(cls, v: object) -> object:
        if isinstance(v, str) and v.lower() in {"release", "released", "production", "prod"}:
            return False
        return v

    @property
    def asyncpg_database_url(self) -> str:
        """Return DATABASE_URL normalized for SQLAlchemy's asyncpg driver."""
        parts = urlsplit(self.database_url)
        query = [(key, value) for key, value in parse_qsl(parts.query) if key.lower() != "sslmode"]
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))

    @property
    def database_connect_args(self) -> dict[str, object]:
        """Return driver-specific connection arguments."""
        if "neon.tech" in self.database_url or "sslmode=require" in self.database_url:
            return {"ssl": True}
        return {}

    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings() -> Settings:
    logger.debug("Loading application settings")
    return Settings()

settings = get_settings()
