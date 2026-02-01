from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.services import firebase_service, video_service
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analyze"])

class AnalyzeRequest(BaseModel):
    video_url: str  # This is actually the blob name, e.g. "uploads/filename.webm"

@router.post("/video")
async def analyze_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Trigger video analysis. 
    For Milestone 1: Downloads WebM, converts to MP4, uploads MP4.
    """
    try:
        logger.info(f"Received analyze request for: {request.video_url}")
        background_tasks.add_task(process_video_conversion, request.video_url)
        return {"status": "processing", "message": "Conversion started"}
    except Exception as e:
        logger.error(f"Error in analyze_video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_video_conversion(blob_name: str):
    logger.info(f"Starting processing for {blob_name}")
    try:
        # 1. Download
        local_webm = f"temp_{os.path.basename(blob_name)}"
        firebase_service.download_blob(blob_name, local_webm)
        logger.info(f"Downloaded to {local_webm}")

        # 2. Convert
        local_mp4 = local_webm.replace(".webm", ".mp4")
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
