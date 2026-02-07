"""
WebSocket endpoint for live coaching with Gemini 2.5 Live API.

Protocol:
- Client sends: JSON messages with type "audio" (base64) or "text"
- Server sends: JSON messages with type "audio" (base64), "text", or "tool_call"
"""
import asyncio
import base64
import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.live_service import LiveCoachSession
from app.services import session_service

logger = logging.getLogger(__name__)

print("[COACH MODULE] coach.py is being loaded!", flush=True)

router = APIRouter(tags=["Coach"])


@router.websocket("/coach")
async def coach_websocket(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None, description="Session ID for context")
):
    """
    WebSocket endpoint for real-time coaching.
    
    Query params:
    - session_id: Optional session ID to load context from Firestore
    
    Client messages (JSON):
    - {"type": "audio", "data": "<base64 PCM 16kHz>"}
    - {"type": "text", "content": "message"}
    - {"type": "context", "analysis": {...}}  # Set analysis context
    
    Server messages (JSON):
    - {"type": "audio", "data": "<base64 PCM 24kHz>"}
    - {"type": "text", "content": "message"}
    - {"type": "tool_call", "name": "open_recorder", "args": {...}}
    - {"type": "connected"}
    - {"type": "error", "message": "..."}
    """
    await websocket.accept()
    print(f"[COACH] WebSocket accepted! session_id={session_id}", flush=True)
    logger.info(f"Coach WebSocket connected, session_id={session_id}")
    
    # Load session context from Firestore if session_id provided
    session_context = None
    if session_id:
        try:
            session_context = session_service.get_session_context(session_id)
            if session_context:
                logger.info(f"Loaded session context: {session_context}")
        except Exception as e:
            logger.warning(f"Failed to load session context: {e}")
    
    session = None
    send_queue = asyncio.Queue()
    
    async def on_audio(audio_data: bytes):
        """Callback when Gemini sends audio."""
        await send_queue.put({
            "type": "audio",
            "data": base64.b64encode(audio_data).decode("utf-8")
        })
        
    async def on_text(text: str):
        """Callback when Gemini sends text."""
        await send_queue.put({
            "type": "text",
            "content": text
        })
        
    async def on_tool_call(name: str, args: dict):
        """Callback when Gemini wants to call a tool."""
        await send_queue.put({
            "type": "tool_call",
            "name": name,
            "args": args
        })
    
    async def sender():
        """Background task to send messages to client."""
        try:
            while True:
                msg = await send_queue.get()
                await websocket.send_json(msg)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Sender error: {e}")
            
    sender_task = None
    
    try:
        # Create session with context
        print("[COACH] Creating LiveCoachSession...", flush=True)
        session = LiveCoachSession(
            on_audio=on_audio,
            on_text=on_text,
            on_tool_call=on_tool_call,
            analysis_context=session_context  # Pass session context
        )
        
        # Start sender task
        sender_task = asyncio.create_task(sender())
        
        # Connect to Gemini
        print("[COACH] About to call session.connect()...", flush=True)
        await session.connect()
        print("[COACH] session.connect() completed, sending 'connected' to client", flush=True)
        await websocket.send_json({"type": "connected"})
        
        # Main loop: receive from client
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "audio":
                    # Decode base64 audio and send to Gemini
                    audio_bytes = base64.b64decode(data["data"])
                    await session.send_audio(audio_bytes)
                    
                elif msg_type == "text":
                    # Send text to Gemini
                    await session.send_text(data["content"])
                    
                elif msg_type == "context":
                    # Update analysis context
                    session.analysis_context = data.get("analysis")
                    logger.info("Updated coach context with analysis")
                    
            except json.JSONDecodeError:
                logger.warning("Received non-JSON message")
                
    except WebSocketDisconnect:
        logger.info("Coach WebSocket disconnected")
    except Exception as e:
        logger.error(f"Coach WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
    finally:
        # Cleanup
        if sender_task:
            sender_task.cancel()
            try:
                await sender_task
            except asyncio.CancelledError:
                pass
        if session:
            await session.disconnect()
