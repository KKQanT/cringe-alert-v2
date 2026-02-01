import firebase_admin
from firebase_admin import credentials, storage
from datetime import timedelta
from app.config import settings
import os
import logging

logger = logging.getLogger(__name__)

# Track initialization status
_firebase_initialized = False

def _initialize_firebase():
    """Initialize Firebase App if not already initialized."""
    global _firebase_initialized
    
    if firebase_admin._apps:
        _firebase_initialized = True
        return True
        
    cred_path = settings.FIREBASE_CREDENTIALS_PATH
    logger.info(f"Attempting to initialize Firebase with credentials at: {cred_path}")
    
    if not os.path.exists(cred_path):
        logger.error(f"Firebase credentials file NOT FOUND at: {os.path.abspath(cred_path)}")
        logger.error("Please ensure firebase-credentials.json exists in the backend directory")
        return False
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': settings.FIREBASE_BUCKET
        })
        _firebase_initialized = True
        logger.info(f"Firebase initialized successfully with bucket: {settings.FIREBASE_BUCKET}")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")
        return False

def _ensure_initialized():
    """Ensure Firebase is initialized before any operation."""
    if not _firebase_initialized:
        if not _initialize_firebase():
            raise RuntimeError(
                f"Firebase not initialized. Credentials file not found at: {os.path.abspath(settings.FIREBASE_CREDENTIALS_PATH)}"
            )

def get_upload_signed_url(filename: str, content_type: str = "video/webm") -> str:
    """Generate a signed URL for uploading a file directly to Firebase Storage."""
    _ensure_initialized()
    
    bucket = storage.bucket()
    blob = bucket.blob(filename)
    
    # firebase-admin uses 'method' not 'action'
    url = blob.generate_signed_url(
        version="v4",
        method="PUT",
        expiration=timedelta(minutes=15),
        content_type=content_type
    )
    logger.info(f"Generated upload signed URL for: {filename}")
    return url

def get_download_url(blob_name: str) -> str:
    """Get a signed download URL."""
    _ensure_initialized()
    
    bucket = storage.bucket()
    blob = bucket.blob(blob_name)
    # firebase-admin uses 'method' not 'action'
    return blob.generate_signed_url(
        version="v4",
        method="GET",
        expiration=timedelta(hours=1)
    )

def download_blob(blob_name: str, destination_path: str):
    """Download a blob to a local file."""
    _ensure_initialized()
    
    logger.info(f"Downloading blob: {blob_name} to {destination_path}")
    bucket = storage.bucket()
    blob = bucket.blob(blob_name)
    blob.download_to_filename(destination_path)
    logger.info(f"Download complete: {destination_path}")

def upload_file(local_path: str, destination_blob_name: str, content_type: str):
    """Upload a local file to Firebase Storage."""
    _ensure_initialized()
    
    logger.info(f"Uploading {local_path} to {destination_blob_name}")
    bucket = storage.bucket()
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(local_path, content_type=content_type)
    logger.info(f"Upload complete: {destination_blob_name}")
