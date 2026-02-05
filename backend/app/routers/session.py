"""
Session Router - API endpoints for managing coaching sessions.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import uuid
import logging

from app.services import session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# ============ Request/Response Models ============

class CreateSessionResponse(BaseModel):
    session_id: str


class SessionResponse(BaseModel):
    session_id: str
    created_at: str
    has_original: bool
    has_final: bool
    practice_clip_count: int
    original_score: Optional[int] = None
    final_score: Optional[int] = None
    improvement: Optional[int] = None


class SessionContextResponse(BaseModel):
    session_id: str
    has_original: bool
    practice_clip_count: int
    has_final: bool
    original_score: Optional[int] = None
    original_summary: Optional[str] = None
    original_feedback: Optional[List[dict]] = None
    original_strengths: Optional[List[str]] = None
    practice_clips: Optional[List[dict]] = None
    final_score: Optional[int] = None
    improvement: Optional[int] = None


# ============ Endpoints ============

@router.post("", response_model=CreateSessionResponse)
async def create_session():
    """Create a new coaching session."""
    session_id = str(uuid.uuid4())
    session_service.create_session(session_id)
    logger.info(f"Created new session: {session_id}")
    return CreateSessionResponse(session_id=session_id)


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    """Get session details."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse(
        session_id=session.session_id,
        created_at=session.created_at.isoformat(),
        has_original=session.original_video is not None,
        has_final=session.final_video is not None,
        practice_clip_count=len(session.practice_clips),
        original_score=session.original_video.score if session.original_video else None,
        final_score=session.final_video.score if session.final_video else None,
        improvement=session.improvement
    )


@router.get("/{session_id}/context", response_model=SessionContextResponse)
async def get_session_context(session_id: str):
    """Get session context for Coach prompts."""
    context = session_service.get_session_context(session_id)
    if not context:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionContextResponse(**context)


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    # Note: For now, just return success. 
    # Firestore deletion can be added if needed.
    return {"status": "deleted", "session_id": session_id}
