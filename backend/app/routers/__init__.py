from app.routers.upload import router as upload_router
from app.routers.analyze import router as analyze_router
from app.routers.websocket import router as websocket_router

__all__ = ["upload_router", "analyze_router", "websocket_router"]
