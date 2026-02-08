from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.firebase_service import get_upload_signed_url, get_download_url
from app.services.auth_service import get_current_user

router = APIRouter(tags=["Upload"], dependencies=[Depends(get_current_user)])

class SignedUrlRequest(BaseModel):
    filename: str
    content_type: str = "video/webm"

class SignedUrlResponse(BaseModel):
    upload_url: str
    download_url: str  # For video playback
    filename: str      # Blob name for analysis trigger

@router.post("/signed-url", response_model=SignedUrlResponse)
async def generate_signed_url(request: SignedUrlRequest):
    try:
        blob_name = f"uploads/{request.filename}"
        
        upload_url = get_upload_signed_url(blob_name, request.content_type)
        download_url = get_download_url(blob_name)
        
        return SignedUrlResponse(
            upload_url=upload_url,
            download_url=download_url,
            filename=blob_name
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
