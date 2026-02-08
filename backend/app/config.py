from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Google AI
    GOOGLE_API_KEY: str

    # Firebase
    FIREBASE_BUCKET: str
    FIREBASE_CREDENTIALS_PATH: str = "./firebase-credentials.json"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # Auth
    JWT_SECRET: str = "cringe-alert-v2-hackathon-secret-key-2026"
    AUTH_USERS: str = ""  # Format: "user1:pass1,user2:pass2"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )
        

settings = Settings()
