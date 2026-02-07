"""
Gemini 2.5 Live API Service

Provides server-to-server WebSocket proxy for real-time coaching.
The Coach can:
- Speak to the user in real-time
- Control the UI via tools (open_recorder, seek_video, countdown)
- Receive analysis context from the Analyst
"""
import asyncio
import json
import logging
from typing import AsyncGenerator, Callable
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize the client
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

# Model for Live API - must use the native audio model
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

# System instruction for the Coach - kept short for native audio model
COACH_SYSTEM_INSTRUCTION = """You are The Coach, an enthusiastic music performance coach.

Be supportive, energetic, and helpful. Keep responses short (1-2 sentences).

You have these tools available:
- show_feedback_card: Highlight an issue from the analysis
- start_practice: Open recorder for practice
- seek_video: Jump to a timestamp
- switch_tab: Switch between original/practice/final tabs
- show_original: Show original video
- record_final: Record final performance

When coaching:
1. Greet the user and mention their performance issues
2. Go through issues one by one using show_feedback_card
3. Help them practice sections using start_practice
4. When ready, use record_final for final take
"""

# Tools the Coach can use (new design for video flow)
COACH_TOOLS = [
    {
        "name": "start_practice",
        "description": "Start a countdown and then open the recorder for a practice clip. Use this when the user wants to practice a specific section.",
        "parameters": {
            "type": "object",
            "properties": {
                "focus_hint": {
                    "type": "string",
                    "description": "What to focus on, e.g., 'Keep tempo steady on the chorus'"
                },
                "section_start": {
                    "type": "number",
                    "description": "Start timestamp in seconds of the section to practice"
                },
                "section_end": {
                    "type": "number", 
                    "description": "End timestamp in seconds of the section to practice"
                }
            },
            "required": []
        }
    },
    {
        "name": "seek_video",
        "description": "Jumps the video player to a specific timestamp. Specify which video to seek in.",
        "parameters": {
            "type": "object",
            "properties": {
                "timestamp_seconds": {
                    "type": "number",
                    "description": "The timestamp in seconds to seek to"
                },
                "which_video": {
                    "type": "string",
                    "enum": ["original", "latest"],
                    "description": "Which video to seek in: 'original' for first upload, 'latest' for most recent"
                }
            },
            "required": ["timestamp_seconds"]
        }
    },
    {
        "name": "show_original",
        "description": "Switch the video player to show the original video. Use this when comparing or referencing the first performance.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "record_final",
        "description": "When user is ready for their final take, ask for confirmation then open recorder for full performance. The cringe score will compare this to the original!",
        "parameters": {
            "type": "object",
            "properties": {
                "confirmation_message": {
                    "type": "string",
                    "description": "Encouraging message before the final take"
                }
            },
            "required": []
        }
    }
]



class LiveCoachSession:
    """
    Manages a single Live API coaching session.
    Proxies audio between the browser and Gemini.
    """
    
    def __init__(
        self, 
        on_audio: Callable[[bytes], None],
        on_text: Callable[[str], None],
        on_tool_call: Callable[[str, dict], None],
        analysis_context: dict | None = None
    ):
        self.on_audio = on_audio
        self.on_text = on_text
        self.on_tool_call = on_tool_call
        self.analysis_context = analysis_context
        self.session = None
        self._session_context = None  # Store context manager
        self._receive_task = None
        self._connected = False
        
    async def connect(self):
        """Establish connection to Gemini Live API."""
        print(f"[LIVE] Connecting to Gemini Live API with model: {LIVE_MODEL}")
        
        # Build context message from session data
        context_message = ""
        if self.analysis_context:
            ctx = self.analysis_context
            
            # Session context format (from session_service.get_session_context())
            if "original_score" in ctx:
                parts = []
                parts.append(f"Original performance score: {ctx['original_score']}/100")
                
                if ctx.get("original_summary"):
                    parts.append(f"Summary: {ctx['original_summary']}")
                
                if ctx.get("original_feedback"):
                    issues = [f["title"] for f in ctx["original_feedback"][:3]]
                    parts.append(f"Key issues to work on: {', '.join(issues)}")
                
                if ctx.get("original_strengths"):
                    parts.append(f"Strengths: {', '.join(ctx['original_strengths'][:2])}")
                
                if ctx.get("practice_clip_count", 0) > 0:
                    parts.append(f"Practice clips recorded: {ctx['practice_clip_count']}")
                
                if ctx.get("final_score"):
                    parts.append(f"Final score: {ctx['final_score']}/100")
                    if ctx.get("improvement"):
                        sign = "+" if ctx["improvement"] > 0 else ""
                        parts.append(f"Improvement: {sign}{ctx['improvement']} points!")
                
                context_message = "SESSION MEMORY:\n" + "\n".join(parts)
            
            # Legacy format (from direct analysis result)
            elif "overall_score" in ctx:
                context_message = f"""
Current session context:
- Last score: {ctx.get('overall_score', 'N/A')}/100
- Summary: {ctx.get('summary', 'No previous analysis')}
- Key issues: {', '.join([f['title'] for f in ctx.get('feedback_items', [])[:3]])}
"""
            
            logger.info(f"Coach context: {context_message[:200]}...")
        
        # Build tools using MINIMAL format for native audio model
        # Per Live API docs: native audio only supports simple {"name": "..."} format
        # The system instruction provides the context for how to use these tools
        show_feedback_card = {"name": "show_feedback_card"}
        switch_tab = {"name": "switch_tab"}
        start_practice = {"name": "start_practice"}
        seek_video = {"name": "seek_video"}
        show_original = {"name": "show_original"}
        record_final = {"name": "record_final"}
        
        tools = [{"function_declarations": [show_feedback_card, switch_tab, start_practice, seek_video, show_original, record_final]}]
        
        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": COACH_SYSTEM_INSTRUCTION + context_message,
            "tools": tools,
        }
        
        try:
            print("[LIVE] Calling client.aio.live.connect()...")
            # The connect() returns an async context manager, so we manually enter it
            self._session_context = client.aio.live.connect(
                model=LIVE_MODEL,
                config=config
            )
            # Manually enter the async context manager
            self.session = await self._session_context.__aenter__()
            print("[LIVE] client.aio.live.connect() entered successfully!")
            self._connected = True
            
            # Start receiving in background
            self._receive_task = asyncio.create_task(self._receive_loop())
            
            print("[LIVE] Connected to Gemini Live API successfully!")
            
            # Send initial greeting prompt
            await self.send_text("Say a short greeting to the user who just opened the coaching session.")
            print("[LIVE] Sent initial greeting prompt")
            
        except Exception as e:
            print(f"[LIVE] ERROR: Failed to connect to Gemini Live API: {e}")
            import traceback
            traceback.print_exc()
            raise
        
    async def disconnect(self):
        """Close the Live API connection."""
        self._connected = False
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        # Exit the context manager properly
        if self._session_context:
            try:
                await self._session_context.__aexit__(None, None, None)
            except Exception as e:
                logger.warning(f"Error closing session: {e}")
        logger.info("Disconnected from Gemini Live API")
        
    async def send_audio(self, audio_data: bytes):
        """Send audio chunk to Gemini."""
        if self.session and self._connected:
            await self.session.send_realtime_input(
                audio={"data": audio_data, "mime_type": "audio/pcm"}
            )
            
    async def send_text(self, text: str):
        """Send text message to Gemini."""
        if self.session and self._connected:
            await self.session.send_client_content(
                turns=[{"role": "user", "parts": [{"text": text}]}],
                turn_complete=True
            )
            
    async def _receive_loop(self):
        """Background task to receive responses from Gemini."""
        try:
            while self._connected and self.session:
                turn = self.session.receive()
                async for response in turn:
                    await self._handle_response(response)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in receive loop: {e}")
            
    async def _handle_response(self, response):
        """Process a response from Gemini Live API."""
        try:
            if response.server_content:
                content = response.server_content
                
                # Handle model turn (audio/text output)
                if content.model_turn:
                    for part in content.model_turn.parts:
                        # Audio output
                        if part.inline_data and isinstance(part.inline_data.data, bytes):
                            await self.on_audio(part.inline_data.data)
                        # Text output
                        if part.text:
                            await self.on_text(part.text)
                            
            # Handle tool calls
            if response.tool_call:
                for fc in response.tool_call.function_calls:
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}
                    logger.info(f"Tool call: {tool_name}({tool_args})")
                    await self.on_tool_call(tool_name, tool_args)
                    
                    # Send tool response for NON_BLOCKING functions
                    # Using SILENT scheduling so model continues without interruption
                    try:
                        function_response = types.FunctionResponse(
                            id=fc.id,
                            name=tool_name,
                            response={"result": "ok", "scheduling": "SILENT"}
                        )
                        await self.session.send_tool_response(function_responses=[function_response])
                        logger.info(f"Sent tool response for {tool_name}")
                    except Exception as tool_err:
                        logger.warning(f"Tool response failed: {tool_err}")
                    
        except Exception as e:
            logger.error(f"Error handling response: {e}")
