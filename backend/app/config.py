import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    PROJECT_NAME: str = "Damper Quote Pro"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "pune-damper-quote-pro-secret-key-2026-super-secure"
    JWT_SECRET_KEY: str = "pune-damper-quote-pro-secret-key-2026-super-secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = "sqlite:///./damper_quote_pro.db"
    
    # CORS
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"
    
    # Approval Thresholds (Editable defaults)
    DEFAULT_MIN_APPROVAL_VALUE: float = 1500000.0  # Rs 15 Lakhs
    DEFAULT_MIN_APPROVAL_MARGIN_PCT: float = 8.0   # 8% minimum margin

    @property
    def effective_secret_key(self) -> str:
        return self.JWT_SECRET_KEY or self.SECRET_KEY

settings = Settings()
# Ensure SECRET_KEY uses effective_secret_key
settings.SECRET_KEY = settings.effective_secret_key
