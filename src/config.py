"""
Application Configuration Module.

Handles loading environment variables from environment or .env file using Pydantic Settings
and python-dotenv. Exposes a global configuration object 'settings'.
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv

# Locate and load the environment variables from the .env file at the project root
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"

if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()


def resolve_secret_value(value: Optional[str]) -> Optional[str]:
    """
    Resolves secret values by checking if they are paths to Docker secrets
    or templates for external secrets vault providers.
    """
    if not value or not isinstance(value, str):
        return value

    # 1. Docker Secrets Resolution (e.g. /run/secrets/redis_password)
    if value.startswith("/run/secrets/") or os.path.exists(value):
        try:
            if os.path.isfile(value):
                with open(value, "r") as f:
                    return f.read().strip()
        except Exception:
            pass

    # 2. Vault integration placeholder resolution
    # format: vault:path/to/secret#key
    if value.startswith("vault:"):
        parts = value[6:].split("#")
        path = parts[0]
        key = parts[1] if len(parts) > 1 else "value"
        # Mock/log Vault retrieval placeholder
        mock_vault_val = f"vault_resolved_{key}_from_{path.replace('/', '_')}"
        return mock_vault_val

    return value


class Settings(BaseSettings):
    """
    Application Settings container.
    """

    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Redis Configuration
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    # Neo4j Configuration
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "password"

    # Prometheus & Loki Configuration
    PROMETHEUS_URL: str = "http://localhost:9090"
    LOKI_URL: str = "http://localhost:3100"

    # Groq API Configuration
    GROQ_API_KEY: str = "mock_key"

    # Slack App Configuration
    SLACK_BOT_TOKEN: str = "mock_token"
    SLACK_SIGNING_SECRET: str = "mock_secret"
    SLACK_CHANNEL: str = "mock_channel"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Resolve secrets for sensitive fields
        self.REDIS_PASSWORD = resolve_secret_value(self.REDIS_PASSWORD)
        self.NEO4J_PASSWORD = resolve_secret_value(self.NEO4J_PASSWORD)
        self.GROQ_API_KEY = resolve_secret_value(self.GROQ_API_KEY)
        self.SLACK_BOT_TOKEN = resolve_secret_value(self.SLACK_BOT_TOKEN)
        self.SLACK_SIGNING_SECRET = resolve_secret_value(self.SLACK_SIGNING_SECRET)


# Global settings singleton
settings = Settings()
