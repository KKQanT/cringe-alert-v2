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

First, identify the song being performed. Use Google Search to look up the song name and original artist based on the melody, lyrics, and playing style you observe. If you cannot confidently identify the song even after searching, use "Unknown" for both fields.

Analyze both the GUITAR playing and VOCALS performance. For each issue found, provide:
1. A timestamp in seconds (e.g., 45.5 for 0:45)
2. Category: 'guitar', 'vocals', or 'timing'
3. Severity: 'critical', 'improvement', or 'minor'
4. A short title
5. An action: a single concise actionable improvement tip (max 15 words)
6. A description: detailed explanation of what happened and technique to improve

When referencing specific lyrics the performer sang, always wrap them in double angle bracket markers like this: <<these are the lyrics>>. This applies to both "action" and "description" fields. Only wrap actual sung lyrics, not general musical terms.

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
  "song_name": "<identified song name or Unknown>",
  "song_artist": "<original artist or Unknown>",
  "overall_score": <number>,
  "summary": "<one sentence>",
  "feedback_items": [
    {
      "timestamp_seconds": <number>,
      "category": "guitar" | "vocals" | "timing",
      "severity": "critical" | "improvement" | "minor",
      "title": "<short title>",
      "action": "<one concise actionable tip, max 15 words>",
      "description": "<detailed feedback with <<lyrics>> markers where applicable>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"]
}
"""


FLASH_MODEL_ID = "gemini-3-flash-preview"

FIX_EVALUATION_PROMPT = """You are evaluating whether a performer has fixed a specific issue from their original performance.

ORIGINAL FEEDBACK ITEM:
- Title: {title}
- Category: {category}
- Severity: {severity}
- Description: {description}
- Action tip: {action}

Watch this short clip carefully. The performer recorded this specifically to fix the issue described above.

Judge whether the specific issue has been adequately addressed. Be encouraging but honest.

Return your evaluation as JSON:
{{
  "is_fixed": true/false,
  "explanation": "<2-3 sentences explaining your judgment>",
  "tips": "<optional: if not fixed, give a specific tip to help them nail it>"
}}
"""

FINAL_COMPARISON_PROMPT = """You are a multimodal AI coach doing the FINAL evaluation of a singing/guitar cover performance.

CONTEXT FROM ORIGINAL PERFORMANCE:
- Original Score: {original_score}/100
- Original Strengths: {original_strengths}
- Original Feedback Items (with fix status):
{feedback_items_text}

First, identify the song being performed. Use Google Search to look up the song name and original artist.

Analyze both the GUITAR playing and VOCALS performance. Provide detailed feedback as in a normal analysis.

ADDITIONALLY, compare this final take to the original:
- What improved? What's still needs work?
- Write a comparison_summary (2-3 sentences) highlighting the journey
- Decide: is this video good enough to post on Instagram? (ig_postable: true/false)
- Write a fun, casual ig_verdict (1-2 sentences, hackathon vibe - be funny!)

When referencing specific lyrics, wrap them in <<these are the lyrics>> markers.

Return as JSON:
{{
  "song_name": "<identified song name or Unknown>",
  "song_artist": "<original artist or Unknown>",
  "overall_score": <number>,
  "summary": "<one sentence>",
  "feedback_items": [
    {{
      "timestamp_seconds": <number>,
      "category": "guitar" | "vocals" | "timing",
      "severity": "critical" | "improvement" | "minor",
      "title": "<short title>",
      "action": "<one concise actionable tip, max 15 words>",
      "description": "<detailed feedback>"
    }}
  ],
  "strengths": ["<strength 1>", "<strength 2>"],
  "comparison_summary": "<2-3 sentence comparison to original>",
  "ig_postable": true/false,
  "ig_verdict": "<fun casual verdict about IG-worthiness>"
}}
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
            thinking_config=types.ThinkingConfig(),  # Default: unlimited thinking
            tools=[types.Tool(google_search=types.GoogleSearch())],  # Song identification
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


async def evaluate_fix_streaming(local_mp4_path: str, feedback_item: dict):
    """
    Evaluate a fix clip against a specific feedback item using Gemini Flash.
    Yields SSE-formatted events.
    """
    try:
        yield {"type": "status", "content": "Uploading clip to AI..."}
        uploaded_file = await upload_video_to_gemini(local_mp4_path)

        yield {"type": "status", "content": "Evaluating your fix..."}

        prompt = FIX_EVALUATION_PROMPT.format(
            title=feedback_item.get("title", ""),
            category=feedback_item.get("category", ""),
            severity=feedback_item.get("severity", ""),
            description=feedback_item.get("description", ""),
            action=feedback_item.get("action", ""),
        )

        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(),
        )

        contents = [
            types.Part.from_uri(file_uri=uploaded_file.uri, mime_type=uploaded_file.mime_type),
            prompt,
        ]

        response_text = ""

        for chunk in client.models.generate_content_stream(
            model=FLASH_MODEL_ID,
            contents=contents,
            config=config,
        ):
            if hasattr(chunk, 'candidates') and chunk.candidates:
                for candidate in chunk.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            if hasattr(part, 'thought') and part.thought:
                                yield {"type": "thinking", "content": part.text or ""}
                            elif hasattr(part, 'text') and part.text:
                                response_text += part.text

        # Parse the JSON result
        parsed_result = None
        try:
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
            if json_match:
                parsed_result = json.loads(json_match.group(1).strip())
            else:
                parsed_result = json.loads(response_text.strip())
        except Exception as e:
            logger.error(f"Failed to parse fix evaluation JSON: {e}")

        if parsed_result:
            yield {"type": "complete", "content": json.dumps(parsed_result)}
        else:
            yield {"type": "complete", "content": response_text}

        # Cleanup
        try:
            client.files.delete(name=uploaded_file.name)
        except Exception as e:
            logger.warning(f"Failed to cleanup file: {e}")

    except Exception as e:
        logger.error(f"Fix evaluation failed: {e}")
        yield {"type": "error", "content": str(e)}


async def analyze_final_video_streaming(local_mp4_path: str, original_context: dict):
    """
    Analyze a final video with comparison to the original performance.
    Uses Gemini Pro for thorough evaluation. Yields SSE events.
    """
    try:
        yield {"type": "status", "content": "Uploading video to AI..."}
        uploaded_file = await upload_video_to_gemini(local_mp4_path)

        yield {"type": "status", "content": "Analyzing final performance..."}

        # Build feedback items text for the prompt
        feedback_lines = []
        for f in original_context.get("original_feedback", []):
            status_tag = f.get("status", "unfixed").upper()
            feedback_lines.append(
                f"  [{status_tag}] {f.get('title', '')} ({f.get('category', '')}/{f.get('severity', '')}): {f.get('description', '')}"
            )
        feedback_items_text = "\n".join(feedback_lines) if feedback_lines else "  (no feedback items)"

        prompt = FINAL_COMPARISON_PROMPT.format(
            original_score=original_context.get("original_score", "N/A"),
            original_strengths=", ".join(original_context.get("original_strengths", [])),
            feedback_items_text=feedback_items_text,
        )

        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(),
            tools=[types.Tool(google_search=types.GoogleSearch())],
        )

        contents = [
            types.Part.from_uri(file_uri=uploaded_file.uri, mime_type=uploaded_file.mime_type),
            prompt,
        ]

        response_text = ""
        thought_text = ""

        for chunk in client.models.generate_content_stream(
            model=MODEL_ID,
            contents=contents,
            config=config,
        ):
            if hasattr(chunk, 'candidates') and chunk.candidates:
                for candidate in chunk.candidates:
                    if hasattr(candidate, 'content') and candidate.content:
                        for part in candidate.content.parts:
                            if hasattr(part, 'thought_signature') and part.thought_signature:
                                gemini_signature = "gts_" + part.thought_signature[:16].hex()
                                thought_text = gemini_signature

                            if hasattr(part, 'thought') and part.thought:
                                thought_text += part.text or ""
                                yield {"type": "thinking", "content": part.text or ""}
                            elif hasattr(part, 'text') and part.text:
                                response_text += part.text
                                yield {"type": "analysis", "content": part.text}

        # Parse JSON
        parsed_result = None
        try:
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_text)
            if json_match:
                parsed_result = json.loads(json_match.group(1).strip())
            else:
                parsed_result = json.loads(response_text.strip())
        except Exception as e:
            logger.error(f"Failed to parse final analysis JSON: {e}")

        # Generate thought signature
        import hashlib
        thought_signature = None
        if thought_text:
            if thought_text.startswith("gts_"):
                thought_signature = thought_text
            else:
                thought_signature = "ts_" + hashlib.sha256(thought_text.encode()).hexdigest()[:16]
        elif response_text:
            thought_signature = "ts_" + hashlib.sha256(response_text.encode()).hexdigest()[:16]

        if parsed_result:
            result_with_signature = {**parsed_result, "thought_signature": thought_signature}
            yield {"type": "complete", "content": json.dumps(result_with_signature)}
        else:
            yield {"type": "complete", "content": response_text}

        # Cleanup
        try:
            client.files.delete(name=uploaded_file.name)
        except Exception as e:
            logger.warning(f"Failed to cleanup file: {e}")

    except Exception as e:
        logger.error(f"Final analysis failed: {e}")
        yield {"type": "error", "content": str(e)}
