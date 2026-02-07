"""
Session Service for managing coaching sessions with Firestore.

Handles:
- Session data model with original/practice/final videos
- Thought signature storage for multi-turn context
- CRUD operations for session persistence
"""
from firebase_admin import firestore
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
import logging

# Import firebase_service to ensure Firebase is initialized
from app.services import firebase_service

logger = logging.getLogger(__name__)

# ============ Data Models ============

class VideoFeedbackItem(BaseModel):
    timestamp_seconds: float
    category: str  # 'guitar', 'vocals', 'timing'
    severity: str  # 'critical', 'improvement', 'minor'
    title: str
    action: Optional[str] = None  # concise actionable tip
    description: str
    status: str = 'unfixed'           # 'unfixed' | 'fixed' | 'skipped'
    fix_clip_url: Optional[str] = None
    fix_clip_blob_name: Optional[str] = None
    fix_feedback: Optional[str] = None  # AI's judgment text
    fix_attempts: int = 0


class VideoAnalysis(BaseModel):
    url: str
    blob_name: str
    score: Optional[int] = None
    summary: Optional[str] = None
    song_name: Optional[str] = None
    song_artist: Optional[str] = None
    feedback_items: List[VideoFeedbackItem] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    thought_signature: Optional[str] = None
    analyzed_at: Optional[datetime] = None
    comparison_summary: Optional[str] = None   # AI comparison (final only)
    ig_postable: Optional[bool] = None         # Can post on IG?
    ig_verdict: Optional[str] = None           # Funny IG verdict


class PracticeClip(BaseModel):
    clip_number: int
    url: str
    blob_name: str
    section_start: Optional[float] = None
    section_end: Optional[float] = None
    focus_hint: Optional[str] = None
    feedback: Optional[str] = None
    score: Optional[int] = None
    feedback_items: List[VideoFeedbackItem] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    thought_signature: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Session(BaseModel):
    session_id: str
    user_id: str = "anonymous"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Videos
    original_video: Optional[VideoAnalysis] = None
    practice_clips: List[PracticeClip] = Field(default_factory=list)
    final_video: Optional[VideoAnalysis] = None

    # Computed
    improvement: Optional[int] = None  # final_score - original_score

    # Fix tracking
    feedback_addressed: int = 0
    feedback_total: int = 0


# ============ Firestore Operations ============

SESSIONS_COLLECTION = "sessions"


def _get_db():
    """Get Firestore client (ensures Firebase is initialized first)."""
    # This import triggers Firebase initialization if not already done
    firebase_service._ensure_initialized()
    return firestore.client()


def create_session(session_id: str, user_id: str = "1") -> Session:
    """Create a new coaching session."""
    db = _get_db()
    session = Session(session_id=session_id, user_id=user_id)

    db.collection(SESSIONS_COLLECTION).document(session_id).set(
        session.model_dump(mode="json")
    )
    logger.info(f"Created session: {session_id} for user: {user_id}")
    return session


def list_user_sessions(user_id: str, limit: int = 20) -> List[Session]:
    """List sessions for a user, ordered by most recent first."""
    db = _get_db()
    query = (
        db.collection(SESSIONS_COLLECTION)
        .where("user_id", "==", user_id)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
    )

    sessions = []
    for doc in query.stream():
        try:
            sessions.append(Session(**doc.to_dict()))
        except Exception as e:
            logger.warning(f"Failed to parse session {doc.id}: {e}")
    return sessions


def get_session(session_id: str) -> Optional[Session]:
    """Get a session by ID."""
    db = _get_db()
    doc = db.collection(SESSIONS_COLLECTION).document(session_id).get()
    
    if doc.exists:
        return Session(**doc.to_dict())
    return None


def update_session(session: Session) -> Session:
    """Update an existing session."""
    db = _get_db()
    session.updated_at = datetime.utcnow()
    
    db.collection(SESSIONS_COLLECTION).document(session.session_id).set(
        session.model_dump(mode="json"),
        merge=True
    )
    logger.info(f"Updated session: {session.session_id}")
    return session


def set_original_video(
    session_id: str,
    url: str,
    blob_name: str,
    score: Optional[int] = None,
    summary: Optional[str] = None,
    song_name: Optional[str] = None,
    song_artist: Optional[str] = None,
    feedback_items: Optional[List[dict]] = None,
    strengths: Optional[List[str]] = None,
    thought_signature: Optional[str] = None
) -> Session:
    """Set or update the original video for a session."""
    session = get_session(session_id)
    if not session:
        session = create_session(session_id)

    session.original_video = VideoAnalysis(
        url=url,
        blob_name=blob_name,
        score=score,
        summary=summary,
        song_name=song_name,
        song_artist=song_artist,
        feedback_items=[VideoFeedbackItem(**f) for f in (feedback_items or [])],
        strengths=strengths or [],
        thought_signature=thought_signature,
        analyzed_at=datetime.utcnow() if score else None
    )

    session.feedback_total = len(feedback_items or [])
    session.feedback_addressed = 0

    return update_session(session)


def add_practice_clip(
    session_id: str,
    url: str,
    blob_name: str,
    section_start: Optional[float] = None,
    section_end: Optional[float] = None,
    focus_hint: Optional[str] = None,
    feedback: Optional[str] = None,
    score: Optional[int] = None,
    feedback_items: Optional[List[dict]] = None,
    strengths: Optional[List[str]] = None,
    thought_signature: Optional[str] = None
) -> Session:
    """Add a practice clip to a session."""
    session = get_session(session_id)
    if not session:
        session = create_session(session_id)

    clip_number = len(session.practice_clips) + 1

    clip = PracticeClip(
        clip_number=clip_number,
        url=url,
        blob_name=blob_name,
        section_start=section_start,
        section_end=section_end,
        focus_hint=focus_hint,
        feedback=feedback,
        score=score,
        feedback_items=[VideoFeedbackItem(**f) for f in (feedback_items or [])],
        strengths=strengths or [],
        thought_signature=thought_signature,
    )
    
    session.practice_clips.append(clip)
    return update_session(session)


def set_final_video(
    session_id: str,
    url: str,
    blob_name: str,
    score: Optional[int] = None,
    summary: Optional[str] = None,
    song_name: Optional[str] = None,
    song_artist: Optional[str] = None,
    feedback_items: Optional[List[dict]] = None,
    strengths: Optional[List[str]] = None,
    thought_signature: Optional[str] = None,
    comparison_summary: Optional[str] = None,
    ig_postable: Optional[bool] = None,
    ig_verdict: Optional[str] = None,
) -> Session:
    """Set the final video for a session and calculate improvement."""
    session = get_session(session_id)
    if not session:
        session = create_session(session_id)

    session.final_video = VideoAnalysis(
        url=url,
        blob_name=blob_name,
        score=score,
        summary=summary,
        song_name=song_name,
        song_artist=song_artist,
        feedback_items=[VideoFeedbackItem(**f) for f in (feedback_items or [])],
        strengths=strengths or [],
        thought_signature=thought_signature,
        analyzed_at=datetime.utcnow() if score else None,
        comparison_summary=comparison_summary,
        ig_postable=ig_postable,
        ig_verdict=ig_verdict,
    )

    # Calculate improvement
    if session.original_video and session.original_video.score and score:
        session.improvement = score - session.original_video.score

    return update_session(session)


def update_feedback_item(
    session_id: str,
    feedback_index: int,
    status: str,
    fix_clip_url: Optional[str] = None,
    fix_clip_blob_name: Optional[str] = None,
    fix_feedback: Optional[str] = None,
) -> Session:
    """Update a specific feedback item's fix status."""
    session = get_session(session_id)
    if not session or not session.original_video:
        raise ValueError(f"Session {session_id} not found or has no original video")

    items = session.original_video.feedback_items
    if feedback_index < 0 or feedback_index >= len(items):
        raise ValueError(f"Feedback index {feedback_index} out of range (0-{len(items)-1})")

    item = items[feedback_index]
    item.status = status
    item.fix_attempts += 1
    if fix_clip_url:
        item.fix_clip_url = fix_clip_url
    if fix_clip_blob_name:
        item.fix_clip_blob_name = fix_clip_blob_name
    if fix_feedback:
        item.fix_feedback = fix_feedback

    # Recompute feedback_addressed
    session.feedback_addressed = sum(1 for f in items if f.status == 'fixed')

    return update_session(session)


def get_session_context(session_id: str) -> dict:
    """Get session context for Coach prompts."""
    session = get_session(session_id)
    if not session:
        return {}
    
    context = {
        "session_id": session_id,
        "has_original": session.original_video is not None,
        "practice_clip_count": len(session.practice_clips),
        "has_final": session.final_video is not None,
    }
    
    if session.original_video:
        context["original_score"] = session.original_video.score
        context["original_summary"] = session.original_video.summary
        context["original_feedback"] = [
            {
                "index": i,
                "title": f.title,
                "category": f.category,
                "severity": f.severity,
                "description": f.description,
                "action": f.action,
                "status": f.status,
            }
            for i, f in enumerate(session.original_video.feedback_items)
        ]
        context["original_strengths"] = session.original_video.strengths
        context["feedback_addressed"] = session.feedback_addressed
        context["feedback_total"] = session.feedback_total

    if session.practice_clips:
        context["practice_clips"] = [
            {
                "clip_number": c.clip_number,
                "focus_hint": c.focus_hint,
                "section": f"{c.section_start}-{c.section_end}" if c.section_start else None
            }
            for c in session.practice_clips
        ]

    if session.final_video:
        context["final_score"] = session.final_video.score
        context["improvement"] = session.improvement

    return context
