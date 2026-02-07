"""
Session Router - API endpoints for managing coaching sessions.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import uuid
import logging

from app.services import session_service, firebase_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


# ============ Request/Response Models ============

class CreateSessionRequest(BaseModel):
    user_id: str = "1"


class CreateSessionResponse(BaseModel):
    session_id: str


class SessionSummary(BaseModel):
    session_id: str
    created_at: str
    has_original: bool
    has_final: bool
    practice_clip_count: int
    original_score: Optional[int] = None
    final_score: Optional[int] = None
    improvement: Optional[int] = None


class VideoAnalysisResponse(BaseModel):
    url: str
    blob_name: str
    score: Optional[int] = None
    summary: Optional[str] = None
    feedback_items: List[dict] = []
    strengths: List[str] = []
    thought_signature: Optional[str] = None
    analyzed_at: Optional[str] = None


class PracticeClipResponse(BaseModel):
    clip_number: int
    url: str
    blob_name: str
    section_start: Optional[float] = None
    section_end: Optional[float] = None
    focus_hint: Optional[str] = None
    feedback: Optional[str] = None
    score: Optional[int] = None
    feedback_items: List[dict] = []
    strengths: List[str] = []
    thought_signature: Optional[str] = None
    created_at: str


class FullSessionResponse(BaseModel):
    session_id: str
    user_id: str
    created_at: str
    updated_at: str
    original_video: Optional[VideoAnalysisResponse] = None
    practice_clips: List[PracticeClipResponse] = []
    final_video: Optional[VideoAnalysisResponse] = None
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

@router.get("", response_model=List[SessionSummary])
async def list_sessions(user_id: str = Query(default="1")):
    """List sessions for a user, most recent first."""
    sessions = session_service.list_user_sessions(user_id)
    return [
        SessionSummary(
            session_id=s.session_id,
            created_at=s.created_at.isoformat(),
            has_original=s.original_video is not None,
            has_final=s.final_video is not None,
            practice_clip_count=len(s.practice_clips),
            original_score=s.original_video.score if s.original_video else None,
            final_score=s.final_video.score if s.final_video else None,
            improvement=s.improvement,
        )
        for s in sessions
    ]


@router.post("", response_model=CreateSessionResponse)
async def create_session(request: CreateSessionRequest = CreateSessionRequest()):
    """Create a new coaching session."""
    session_id = str(uuid.uuid4())
    session_service.create_session(session_id, user_id=request.user_id)
    logger.info(f"Created new session: {session_id} for user: {request.user_id}")
    return CreateSessionResponse(session_id=session_id)


@router.get("/{session_id}/full", response_model=FullSessionResponse)
async def get_full_session(session_id: str):
    """Get complete session data with fresh signed download URLs."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    original = None
    if session.original_video:
        fresh_url = session.original_video.url
        if session.original_video.blob_name:
            try:
                fresh_url = firebase_service.get_download_url(session.original_video.blob_name)
            except Exception as e:
                logger.warning(f"Failed to regenerate URL for original video: {e}")
        original = VideoAnalysisResponse(
            url=fresh_url,
            blob_name=session.original_video.blob_name,
            score=session.original_video.score,
            summary=session.original_video.summary,
            feedback_items=[f.model_dump() for f in session.original_video.feedback_items],
            strengths=session.original_video.strengths,
            thought_signature=session.original_video.thought_signature,
            analyzed_at=session.original_video.analyzed_at.isoformat() if session.original_video.analyzed_at else None,
        )

    clips = []
    for c in session.practice_clips:
        fresh_url = c.url
        if c.blob_name:
            try:
                fresh_url = firebase_service.get_download_url(c.blob_name)
            except Exception as e:
                logger.warning(f"Failed to regenerate URL for practice clip {c.clip_number}: {e}")
        clips.append(PracticeClipResponse(
            clip_number=c.clip_number,
            url=fresh_url,
            blob_name=c.blob_name,
            section_start=c.section_start,
            section_end=c.section_end,
            focus_hint=c.focus_hint,
            feedback=c.feedback,
            score=c.score,
            feedback_items=[f.model_dump() for f in c.feedback_items],
            strengths=c.strengths,
            thought_signature=c.thought_signature,
            created_at=c.created_at.isoformat(),
        ))

    final = None
    if session.final_video:
        fresh_url = session.final_video.url
        if session.final_video.blob_name:
            try:
                fresh_url = firebase_service.get_download_url(session.final_video.blob_name)
            except Exception as e:
                logger.warning(f"Failed to regenerate URL for final video: {e}")
        final = VideoAnalysisResponse(
            url=fresh_url,
            blob_name=session.final_video.blob_name,
            score=session.final_video.score,
            summary=session.final_video.summary,
            feedback_items=[f.model_dump() for f in session.final_video.feedback_items],
            strengths=session.final_video.strengths,
            thought_signature=session.final_video.thought_signature,
            analyzed_at=session.final_video.analyzed_at.isoformat() if session.final_video.analyzed_at else None,
        )

    return FullSessionResponse(
        session_id=session.session_id,
        user_id=session.user_id,
        created_at=session.created_at.isoformat(),
        updated_at=session.updated_at.isoformat(),
        original_video=original,
        practice_clips=clips,
        final_video=final,
        improvement=session.improvement,
    )


@router.get("/{session_id}", response_model=SessionSummary)
async def get_session(session_id: str):
    """Get session summary."""
    session = session_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return SessionSummary(
        session_id=session.session_id,
        created_at=session.created_at.isoformat(),
        has_original=session.original_video is not None,
        has_final=session.final_video is not None,
        practice_clip_count=len(session.practice_clips),
        original_score=session.original_video.score if session.original_video else None,
        final_score=session.final_video.score if session.final_video else None,
        improvement=session.improvement,
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
    return {"status": "deleted", "session_id": session_id}
