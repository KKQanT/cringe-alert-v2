from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Literal
from app.services import firebase_service, video_service, session_service
from app.services.gemini_service import analyze_video_streaming
import os
import logging
import json
import asyncio

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analyze"])


class AnalyzeRequest(BaseModel):
    video_url: str  # This is actually the blob name, e.g. "uploads/filename.webm"
    session_id: Optional[str] = None  # For session persistence
    video_type: Optional[Literal["original", "practice", "final"]] = None  # Which video this is


@router.post("/video")
async def analyze_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Trigger video analysis (non-streaming, background task).
    For Milestone 1: Downloads WebM, converts to MP4, uploads MP4.
    """
    try:
        logger.info(f"Received analyze request for: {request.video_url}")
        background_tasks.add_task(process_video_conversion, request.video_url)
        return {"status": "processing", "message": "Conversion started"}
    except Exception as e:
        logger.error(f"Error in analyze_video: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/video/stream")
async def analyze_video_stream(request: AnalyzeRequest):
    """
    Stream video analysis using Gemini 3 Pro with SSE.
    
    Flow:
    1. Download WebM from Firebase
    2. Convert to MP4
    3. Upload to Gemini Files API
    4. Stream analysis with thinking
    5. Return results as SSE events
    """
    logger.info(f"Received streaming analyze request for: {request.video_url}")
    
    async def event_generator():
        local_webm = None
        local_mp4 = None

        try:
            # Status: Starting
            yield f"data: {json.dumps({'type': 'status', 'content': 'Downloading video...'})}\n\n"
            await asyncio.sleep(0.01)  # Flush

            # 1. Download WebM from Firebase
            local_webm = f"temp_stream_{os.path.basename(request.video_url)}"
            firebase_service.download_blob(request.video_url, local_webm)
            logger.info(f"Downloaded: {local_webm}")

            # Status: Converting
            yield f"data: {json.dumps({'type': 'status', 'content': 'Converting video format...'})}\n\n"
            await asyncio.sleep(0.01)

            # 2. Convert to MP4 (handle any extension, not just .webm)
            base_name = os.path.splitext(local_webm)[0]
            local_mp4 = f"{base_name}.mp4"
            await video_service.convert_webm_to_mp4(local_webm, local_mp4)
            logger.info(f"Converted: {local_mp4}")

            # 3. Stream analysis from Gemini
            async for event in analyze_video_streaming(local_mp4):
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.01)  # Allow flush

                # Persist analysis results to Firestore when complete
                if event.get("type") == "complete" and request.session_id and request.video_type:
                    try:
                        result = json.loads(event["content"])
                        blob_name = request.video_url
                        url = firebase_service.get_download_url(blob_name)
                        feedback_items = result.get("feedback_items", [])
                        strengths = result.get("strengths", [])
                        score = result.get("overall_score")
                        summary = result.get("summary")
                        thought_sig = result.get("thought_signature")

                        if request.video_type == "original":
                            session_service.set_original_video(
                                session_id=request.session_id,
                                url=url,
                                blob_name=blob_name,
                                score=score,
                                summary=summary,
                                feedback_items=feedback_items,
                                strengths=strengths,
                                thought_signature=thought_sig,
                            )
                        elif request.video_type == "practice":
                            session_service.add_practice_clip(
                                session_id=request.session_id,
                                url=url,
                                blob_name=blob_name,
                                feedback=summary,
                                score=score,
                                feedback_items=feedback_items,
                                strengths=strengths,
                                thought_signature=thought_sig,
                            )
                        elif request.video_type == "final":
                            session_service.set_final_video(
                                session_id=request.session_id,
                                url=url,
                                blob_name=blob_name,
                                score=score,
                                summary=summary,
                                feedback_items=feedback_items,
                                strengths=strengths,
                                thought_signature=thought_sig,
                            )
                        logger.info(f"Saved {request.video_type} analysis to session {request.session_id}")
                    except Exception as persist_err:
                        logger.error(f"Failed to persist analysis to Firestore: {persist_err}")

        except Exception as e:
            logger.error(f"Streaming analysis error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            # Cleanup local files
            if local_webm and os.path.exists(local_webm):
                os.remove(local_webm)
                logger.info(f"Cleaned up: {local_webm}")
            if local_mp4 and os.path.exists(local_mp4):
                os.remove(local_mp4)
                logger.info(f"Cleaned up: {local_mp4}")
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


async def process_video_conversion(blob_name: str):
    """Background task for non-streaming conversion (Milestone 1 compat)."""
    logger.info(f"Starting processing for {blob_name}")
    try:
        # 1. Download
        local_webm = f"temp_{os.path.basename(blob_name)}"
        firebase_service.download_blob(blob_name, local_webm)
        logger.info(f"Downloaded to {local_webm}")

        # 2. Convert (handle any extension)
        base_name = os.path.splitext(local_webm)[0]
        local_mp4 = f"{base_name}.mp4"
        await video_service.convert_webm_to_mp4(local_webm, local_mp4)
        logger.info(f"Converted to {local_mp4}")

        # 3. Upload MP4 (Verification step)
        mp4_blob_name = blob_name.replace(".webm", ".mp4")
        firebase_service.upload_file(local_mp4, mp4_blob_name, "video/mp4")
        logger.info(f"Uploaded MP4 to {mp4_blob_name}")

        # Cleanup
        if os.path.exists(local_webm):
            os.remove(local_webm)
        if os.path.exists(local_mp4):
            os.remove(local_mp4)

        logger.info(f"Processing complete for {blob_name}")

    except Exception as e:
        logger.error(f"Error processing video: {e}")
