from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

from app.config import settings
from app.routers import upload, analyze, websocket, coach, session, auth

app = FastAPI(
    title="Cringe Alert API",
    description="Real-time AI performance analysis",
    version="1.0.0",
)

# CORS middleware
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",")] if isinstance(settings.CORS_ORIGINS, str) else settings.CORS_ORIGINS
print(f"Loaded CORS origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
# Auth router (no auth required)
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])

# Protected routers
# NOTE: coach.router MUST come before websocket.router because
# websocket.router has /ws/{session_id} which would catch /ws/coach
app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(analyze.router, prefix="/api/analyze", tags=["analyze"])
app.include_router(session.router)  # Has its own prefix /api/sessions
app.include_router(coach.router, prefix="/ws", tags=["coach"])
app.include_router(websocket.router, tags=["websocket"])


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
