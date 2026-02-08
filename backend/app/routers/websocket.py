from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict
import uuid
from app.services.auth_service import ws_get_current_user

router = APIRouter()

# Store active WebSocket connections
connections: Dict[str, WebSocket] = {}


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    _user: str = Depends(ws_get_current_user),
):
    """WebSocket endpoint for real-time AI communication."""
    await websocket.accept()
    connections[session_id] = websocket
    
    try:
        while True:
            data = await websocket.receive_json()
            
            # Handle different message types
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
            # Add more message handlers as needed
            
    except WebSocketDisconnect:
        if session_id in connections:
            del connections[session_id]


async def send_to_client(session_id: str, message: dict):
    """Send a message to a specific client."""
    if session_id in connections:
        await connections[session_id].send_json(message)
