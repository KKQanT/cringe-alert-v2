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

# System instruction for the Coach
COACH_SYSTEM_INSTRUCTION = """You are "The Coach" - an enthusiastic, supportive music coach for singing and guitar covers.

Your personality:
- Hype-man energy but professional
- Encouraging but honest about areas to improve
- Use casual language, feels like talking to a friend

Your capabilities:
- You can control the app using tools
- When the user wants to practice, use open_recorder to start recording
- When discussing specific moments, use seek_video to jump to that timestamp
- Before recording, use start_countdown to give them a "3, 2, 1" countdown

Current context will be provided about the user's previous analysis results.

Keep responses conversational and SHORT (1-2 sentences when possible).
End with actionable suggestions or questions.
"""

# Tools the Coach can use
COACH_TOOLS = [
    {
        "name": "open_recorder",
        "description": "Opens the recording modal so the user can record a new take. Use this when the user is ready to practice.",
        "parameters": {
            "type": "object",
            "properties": {
                "focus_hint": {
                    "type": "string",
                    "description": "A short hint about what to focus on, e.g., 'Keep tempo steady on the chorus'"
                }
            },
            "required": []
        }
    },
    {
        "name": "seek_video",
        "description": "Jumps the video player to a specific timestamp. Use this when discussing specific moments.",
        "parameters": {
            "type": "object",
            "properties": {
                "timestamp_seconds": {
                    "type": "number",
                    "description": "The timestamp in seconds to seek to"
                }
            },
            "required": ["timestamp_seconds"]
        }
    },
    {
        "name": "start_countdown",
        "description": "Starts a 3-2-1 countdown before recording. Use this right before recording starts.",
        "parameters": {
            "type": "object",
            "properties": {
                "seconds": {
                    "type": "integer",
                    "description": "Countdown duration (default: 3)"
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
        
        # Build context message if we have analysis
        context_message = ""
        if self.analysis_context:
            context_message = f"""
Current session context:
- Last score: {self.analysis_context.get('overall_score', 'N/A')}/100
- Summary: {self.analysis_context.get('summary', 'No previous analysis')}
- Key issues: {', '.join([f['title'] for f in self.analysis_context.get('feedback_items', [])[:3]])}
"""
        
        # Build tools using SDK types
        coach_tools = [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="open_recorder",
                        description="Opens the recording modal so the user can record a new take.",
                        parameters=types.Schema(
                            type="OBJECT",
                            properties={
                                "focus_hint": types.Schema(
                                    type="STRING",
                                    description="A short hint about what to focus on"
                                )
                            }
                        )
                    ),
                    types.FunctionDeclaration(
                        name="seek_video",
                        description="Jumps the video player to a specific timestamp.",
                        parameters=types.Schema(
                            type="OBJECT",
                            properties={
                                "timestamp_seconds": types.Schema(
                                    type="NUMBER",
                                    description="The timestamp in seconds to seek to"
                                )
                            },
                            required=["timestamp_seconds"]
                        )
                    ),
                    types.FunctionDeclaration(
                        name="start_countdown",
                        description="Starts a 3-2-1 countdown before recording.",
                        parameters=types.Schema(
                            type="OBJECT",
                            properties={
                                "seconds": types.Schema(
                                    type="INTEGER",
                                    description="Countdown duration (default: 3)"
                                )
                            }
                        )
                    )
                ]
            )
        ]
        
        config = {
            "response_modalities": ["AUDIO"],
            "system_instruction": COACH_SYSTEM_INSTRUCTION + context_message,
            "tools": coach_tools,
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
                    
                    # Send tool response back
                    await self.session.send_tool_response(
                        function_responses=[{
                            "name": tool_name,
                            "response": {"status": "executed"}
                        }]
                    )
                    
        except Exception as e:
            logger.error(f"Error handling response: {e}")
