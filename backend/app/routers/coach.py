"""

Protocol:
- Client sends: JSON messages with type "text", "tool_result", or "context"
- Server sends: JSON messages with type "text", "tool_call", "connected", or "error"
"""
import json
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.services.live_service import ChatCoachSession
from app.services import session_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Coach"])


@router.websocket("/coach")
async def coach_websocket(
    websocket: WebSocket,
    session_id: Optional[str] = Query(None, description="Session ID for context")
):
    """
    WebSocket endpoint for text-based coaching.

    Query params:
    - session_id: Optional session ID to load context from Firestore

    Client messages (JSON):
    - {"type": "text", "content": "message"}
    - {"type": "tool_result", "name": "seek_video", "result": {"status": "ok"}}
    - {"type": "context", "analysis": {...}}

    Server messages (JSON):
    - {"type": "text", "content": "message chunk"}
    - {"type": "tool_call", "name": "seek_video", "args": {"timestamp_seconds": 30}}
    - {"type": "connected"}
    - {"type": "error", "message": "..."}
    """
    await websocket.accept()
    logger.info(f"Coach WebSocket connected, session_id={session_id}")

    # Load session context from Firestore if session_id provided
    session_context = None
    if session_id:
        try:
            session_context = session_service.get_session_context(session_id)
            if session_context:
                logger.info(f"Loaded session context for {session_id}")
        except Exception as e:
            logger.warning(f"Failed to load session context: {e}")

    session = None

    try:
        # Create chat session with context
        session = ChatCoachSession(analysis_context=session_context)

        # Signal client that we're ready
        await websocket.send_json({"type": "connected"})

        # Send initial greeting - proactive about fix workflow
        async for event in session.send_message("Start the coaching session. Greet the user, mention their score and key issues. Then suggest which feedback item they should fix first (pick the easiest or most impactful one). Be proactive and encouraging!"):
            await websocket.send_json(event)

        # Main loop: receive from client
        while True:
            try:
                data = await websocket.receive_json()
                msg_type = data.get("type")

                if msg_type == "text":
                    # Stream response back to client
                    async for event in session.send_message(data["content"]):
                        await websocket.send_json(event)

                elif msg_type == "tool_result":
                    # Forward tool result to model, stream any follow-up
                    async for event in session.send_tool_result(
                        data["name"],
                        data.get("result", {"status": "ok"}),
                    ):
                        await websocket.send_json(event)

                elif msg_type == "context":
                    # Update analysis context mid-session
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
        except Exception:
            pass
