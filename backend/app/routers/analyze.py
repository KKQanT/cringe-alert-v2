from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from app.services import firebase_service, video_service
import os
import asyncio

router = APIRouter(tags=["Analyze"])

class AnalyzeRequest(BaseModel):
    video_url: str # This is actually the blob name, e.g. "uploads/filename.webm"

@router.post("/video")
async def analyze_video(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Trigger video analysis. 
    For Milestone 1: Downloads WebM, converts to MP4, uploads MP4.
    """
    try:
        # We run the conversion in background to respond quickly? 
        # For agentic flow, we might want to stream. 
        # But for Milestone 1 MVP check, let's just do it synchronously or background.
        # Plan says "Integration: ... Verify MP4 exists".
        # Let's do it in background so request doesn't timeout, but we print logs.
        
        background_tasks.add_task(process_video_conversion, request.video_url)
        return {"status": "processing", "message": "Conversion started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def process_video_conversion(blob_name: str):
    print(f"Starting processing for {blob_name}")
    try:
        # 1. Download
        local_webm = f"temp_{os.path.basename(blob_name)}"
        firebase_service.download_blob(blob_name, local_webm)
        print(f"Downloaded to {local_webm}")

        # 2. Convert
        local_mp4 = local_webm.replace(".webm", ".mp4")
        await video_service.convert_webm_to_mp4(local_webm, local_mp4)
        print(f"Converted to {local_mp4}")

        # 3. Upload MP4 (Verification step)
        mp4_blob_name = blob_name.replace(".webm", ".mp4")
        firebase_service.upload_file(local_mp4, mp4_blob_name, "video/mp4")
        print(f"Uploaded MP4 to {mp4_blob_name}")

        # Cleanup
        if os.path.exists(local_webm):
            os.remove(local_webm)
        if os.path.exists(local_mp4):
            os.remove(local_mp4)
            
    except Exception as e:
        print(f"Error processing video: {e}")
