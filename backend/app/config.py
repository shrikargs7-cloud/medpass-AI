import os
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Proactively locate and load .env files
_current_dir = os.path.dirname(os.path.abspath(__file__))
_backend_dir = os.path.abspath(os.path.join(_current_dir, ".."))
_root_dir = os.path.abspath(os.path.join(_backend_dir, ".."))
load_dotenv(os.path.join(_backend_dir, ".env"))
load_dotenv(os.path.join(_root_dir, ".env"))

class Settings(BaseSettings):
    PROJECT_NAME: str = "MedPass AI + Trace Commons"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEMO_MODE: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
    PORT: int = int(os.getenv("PORT", 8000))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "medpass_super_secret_dev_key_2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./medpass.db")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "*")

    # Beeceptor integration settings
    BEECEPTOR_BASE_URL: str = os.getenv("BEECEPTOR_BASE_URL", "https://medpass-mocks.free.beeceptor.com")
    SIMULATE_BEECEPTOR_LOCALLY: bool = os.getenv("SIMULATE_BEECEPTOR_LOCALLY", "true").lower() == "true"

    # n8n automation settings
    N8N_WEBHOOK_URL: str = os.getenv("N8N_WEBHOOK_URL", "http://localhost:5678/webhook/case-status")
    N8N_ENABLED: bool = os.getenv("N8N_ENABLED", "true").lower() == "true"

    # AI / LLM Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    # Privacy & Anonymization
    TRACE_PSEUDONYM_SECRET: str = os.getenv("TRACE_PSEUDONYM_SECRET", "medpass_prod_secret_salt_9842")

    # Storage paths & S3 Cloud Configuration
    STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
    EXPORT_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports"))

    # S3 / Bunny Storage Configuration
    S3_STORAGE_ENABLED: bool = os.getenv("S3_STORAGE_ENABLED", "true").lower() == "true"
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "https://de-s3.storage.bunnycdn.com")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "my-storage09")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "b8a8900d-fe82-4cf8-ac44538a7c54-4066-48b7")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "my-storage09")
    S3_REGION_NAME: str = os.getenv("S3_REGION_NAME", "de")

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        case_sensitive = True
        extra = "ignore"
        env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))

settings = Settings()

# Ensure directories exist
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
