"""
Gemini 3 Pro Video Analysis Service

Uses:
- Gemini 3 Pro Preview for multimodal video analysis
- Files API for video upload
- Streaming for real-time thinking/analysis
"""
from google import genai
from google.genai import types
from app.config import settings
import logging
import tempfile
import os
import re
import json

logger = logging.getLogger(__name__)

# Initialize the client
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

MODEL_ID = "gemini-3-pro-preview"

ANALYSIS_PROMPT = """You are a multimodal AI coach analyzing a singing/guitar cover performance video.

Analyze both the GUITAR playing and VOCALS performance. For each issue found, provide:
1. A timestamp in seconds (e.g., 45.5 for 0:45)
2. Category: 'guitar', 'vocals', or 'timing'
3. Severity: 'critical', 'improvement', or 'minor'
4. A short title
5. A description of what happened and how to improve

Also provide:
- An overall score from 0-100
- A one-sentence summary
- 2-3 strengths the performer showed

Think through your analysis step by step, considering:
- Guitar: chord accuracy, timing, strumming patterns, transitions
- Vocals: pitch accuracy, breath control, tone, emotion
- Synchronization between guitar and vocals

Return your analysis as JSON with this structure:
{
  "overall_score": <number>,
  "summary": "<one sentence>", 
  "feedback_items": [
    {
      "timestamp_seconds": <number>,
      "category": "guitar" | "vocals" | "timing",
      "severity": "critical" | "improvement" | "minor",
      "title": "<short title>",
      "description": "<detailed feedback>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"]
}
"""


async def upload_video_to_gemini(local_path: str, mime_type: str = "video/mp4"):
    """
    Upload a video file to Gemini Files API and wait for it to be ready.
    Returns the file reference for use in prompts.
    """
    import time
    
    logger.info(f"Uploading video to Gemini Files API: {local_path}")
    
    try:
        #TODO: improve this for production
        uploaded_file = client.files.upload(file=local_path)
        logger.info(f"Video uploaded: {uploaded_file.name}, state: {uploaded_file.state}")
        
        # Wait for file to be processed (ACTIVE state)
        max_wait = 120  # 2 minutes max
        wait_time = 0
        poll_interval = 2
        
        while uploaded_file.state.name != "ACTIVE":
            if wait_time >= max_wait:
                raise TimeoutError(f"File processing timed out after {max_wait}s")
            
            logger.info(f"Waiting for file to be ready... (state: {uploaded_file.state.name})")
            time.sleep(poll_interval)
            wait_time += poll_interval
            
            # Refresh file status
            uploaded_file = client.files.get(name=uploaded_file.name)
        
        logger.info(f"File ready: {uploaded_file.name}")
        return uploaded_file
        
    except Exception as e:
        logger.error(f"Failed to upload video to Gemini: {e}")
        raise


async def analyze_video_streaming(local_mp4_path: str):
    """
    Analyze a video file using Gemini 3 Pro with streaming.
    Yields SSE-formatted events for real-time UI updates.
    
    Event types:
    - status: Current processing status
    - thinking: Model's thought process (thinking summaries)
    - analysis: The actual analysis output
    - complete: Analysis finished
    - error: An error occurred
    """
    
    try:
        # 1. Upload video to Gemini Files API
        yield {"type": "status", "content": "Uploading video to AI..."}
        uploaded_file = await upload_video_to_gemini(local_mp4_path)
        
        # 2. Start streaming analysis
        yield {"type": "status", "content": "Analyzing performance..."}
        
        # Configure with thinking enabled (no budget limit)
        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig()  # Default: unlimited thinking
        )
        
        # Create the content with video and prompt
        contents = [
            types.Part.from_uri(file_uri=uploaded_file.uri, mime_type=uploaded_file.mime_type),
            ANALYSIS_PROMPT
        ]
        
        response_text = ""
        thought_text = ""
        
        # Stream the response
        for chunk in client.models.generate_content_stream(
            model=MODEL_ID,
            contents=contents,
            config=config
        ):
            # Check for thinking content (thought summaries)
            if hasattr(chunk, 'candidates') and chunk.candidates:
                for candidate in chunk.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            # Capture native Gemini thought_signature if present (bytes)
                            if hasattr(part, 'thought_signature') and part.thought_signature:
                                # Convert bytes to hex string for storage
                                gemini_signature = "gts_" + part.thought_signature[:16].hex()
                                logger.info(f"Captured Gemini thought_signature: {gemini_signature}")
                                thought_text = gemini_signature  # Use as marker
                            
                            # Check if this is a thought summary (thought=True)
                            if hasattr(part, 'thought') and part.thought:
                                thought_text += part.text or ""
                                logger.info(f"Captured thinking content: {(part.text or '')[:100]}...")
                                yield {"type": "thinking", "content": part.text or ""}
                            # Regular text content
                            elif hasattr(part, 'text') and part.text:
                                response_text += part.text
                                yield {"type": "analysis", "content": part.text}
        
        # Log the full response for debugging
        logger.info(f"Full response text: {response_text[:500]}...")
        
        # Extract JSON from markdown code blocks if present
        parsed_result = None
        try:
            
            # Try to find JSON in code blocks first
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
            if json_match:
                json_str = json_match.group(1).strip()
                parsed_result = json.loads(json_str)
            else:
                # Try parsing the whole response as JSON
                parsed_result = json.loads(response_text.strip())
                
            logger.info(f"Parsed result successfully: score={parsed_result.get('overall_score')}")
        except Exception as e:
            logger.error(f"Failed to parse JSON: {e}")
            logger.error(f"Response was: {response_text}")
        
        # Generate thought signature
        # Priority: 1) Native Gemini signature 2) Hash of thinking 3) Hash of response
        thought_signature = None
        import hashlib
        if thought_text:
            if thought_text.startswith("gts_"):
                # Use native Gemini signature directly
                thought_signature = thought_text
                logger.info(f"Using native Gemini thought_signature: {thought_signature}")
            else:
                # Hash the thinking content
                thought_signature = "ts_" + hashlib.sha256(thought_text.encode()).hexdigest()[:16]
                logger.info(f"Generated thought signature from thinking: {thought_signature}")
        elif response_text:
            # Fallback: generate signature from response if no thinking captured
            thought_signature = "ts_" + hashlib.sha256(response_text.encode()).hexdigest()[:16]
            logger.info(f"Generated thought signature from response: {thought_signature}")
        
        # Send complete event with parsed result and thought signature
        if parsed_result:
            result_with_signature = {
                **parsed_result,
                "thought_signature": thought_signature
            }
            yield {"type": "complete", "content": json.dumps(result_with_signature)}
        else:
            yield {"type": "complete", "content": response_text}
        
        # Cleanup: Delete the uploaded file
        try:
            client.files.delete(name=uploaded_file.name)
            logger.info(f"Cleaned up uploaded file: {uploaded_file.name}")
        except Exception as e:
            logger.warning(f"Failed to cleanup file: {e}")
            
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        yield {"type": "error", "content": str(e)}


async def analyze_video_with_signature(
    local_mp4_path: str, 
    previous_signature: str | None = None
):
    """
    Analyze video with thought signature support for multi-turn coaching.
    Used in Milestone 4 for the iterative loop.
    """
    # TODO: Implement in Milestone 4
    pass
