import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "MedPass AI + Trace Commons"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
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
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # Storage paths
    STORAGE_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage"))
    EXPORT_DIR: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "exports"))

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        case_sensitive = True

settings = Settings()

# Ensure directories exist
os.makedirs(settings.STORAGE_DIR, exist_ok=True)
os.makedirs(settings.EXPORT_DIR, exist_ok=True)
