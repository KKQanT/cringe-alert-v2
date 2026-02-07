"""
Gemini 3 Flash Chat Coaching Service

Text-based coaching over WebSocket using generate_content_stream.
The Coach can:
- Chat with the user in real-time (streamed text)
- Control the UI via tools with full parameters (seek_video, start_practice, etc.)
- Receive analysis context from the session
"""
import logging
from typing import AsyncGenerator
from google import genai
from google.genai import types
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize the client
client = genai.Client(api_key=settings.GOOGLE_API_KEY)

# Model for coaching chat
CHAT_MODEL = "gemini-3-flash-preview"

# System instruction for the Coach
COACH_SYSTEM_INSTRUCTION = """You are The Coach, an enthusiastic and supportive music performance coach.

Your personality:
- Energetic, encouraging, and genuinely excited about helping people improve
- Keep responses concise (2-4 sentences) unless explaining something detailed
- Use casual, friendly language
- Celebrate wins! When a feedback item gets fixed, cheer them on

You have these tools to control the UI:
- seek_video: Jump the video player to a specific timestamp
- open_feedback_modal: Open the fix modal for a specific feedback item so the user can record a fix clip
- show_original: Switch to the original video
- record_final: Open recorder for the final performance take
- show_feedback_card: Highlight a specific feedback item from the analysis

Coaching workflow (FEEDBACK-CARD DRIVEN):
1. Greet the user proactively! Mention their score, and suggest starting with the easiest/most impactful issue to fix
2. Walk through feedback items one by one:
   a. Use show_feedback_card to highlight the current issue
   b. Use seek_video to show the problem spot in their video
   c. Explain what went wrong and give a quick tip
   d. Use open_feedback_modal to let them record a fix clip for that specific issue
3. When they fix an item, celebrate! Then suggest the next unfixed item
4. Track progress: mention how many items they've addressed (e.g., "3 out of 5 fixed!")
5. When enough items are fixed (or they want to move on), suggest recording a final take with record_final
6. If items are marked [SKIPPED], respect that and move on

IMPORTANT: Always use tools with their proper parameters. For example:
- seek_video needs timestamp_seconds (number)
- open_feedback_modal takes index (number, 0-based index of the feedback item)
- show_feedback_card takes index (number, 0-based)
- record_final can take confirmation_message (string)
"""

# Tools with full parameter definitions
COACH_TOOLS = [
    types.Tool(function_declarations=[
        types.FunctionDeclaration(
            name="open_feedback_modal",
            description="Open the fix modal for a specific feedback item so the user can record a short clip to fix that issue.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "index": types.Schema(
                        type="NUMBER",
                        description="Zero-based index of the feedback item to fix"
                    ),
                },
                required=["index"],
            ),
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
                    ),
                    "which_video": types.Schema(
                        type="STRING",
                        description="Which video to seek in: 'original' for first upload, 'latest' for most recent"
                    ),
                },
                required=["timestamp_seconds"],
            ),
        ),
        types.FunctionDeclaration(
            name="show_original",
            description="Switch the video player to show the original video. Use this when comparing or referencing the first performance.",
            parameters=types.Schema(
                type="OBJECT",
                properties={},
            ),
        ),
        types.FunctionDeclaration(
            name="record_final",
            description="When user is ready for their final take, open recorder for full performance.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "confirmation_message": types.Schema(
                        type="STRING",
                        description="Encouraging message before the final take"
                    ),
                },
            ),
        ),
        types.FunctionDeclaration(
            name="show_feedback_card",
            description="Highlight a specific feedback item from the analysis. Use index 0 for the first issue, 1 for second, etc.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "index": types.Schema(
                        type="NUMBER",
                        description="Zero-based index of the feedback item to highlight"
                    ),
                },
            ),
        ),
    ])
]


def _build_context_message(analysis_context: dict | None) -> str:
    """Build context string from session data."""
    if not analysis_context:
        return ""

    ctx = analysis_context

    # Session context format (from session_service.get_session_context())
    if "original_score" in ctx:
        parts = []
        parts.append(f"Original performance score: {ctx['original_score']}/100")

        if ctx.get("original_summary"):
            parts.append(f"Summary: {ctx['original_summary']}")

        if ctx.get("original_feedback"):
            issues = []
            for f in ctx["original_feedback"]:
                status_tag = f.get("status", "unfixed").upper()
                idx = f.get("index", "?")
                issues.append(f"  [{idx}] [{status_tag}] {f['title']} ({f.get('category', '')}/{f.get('severity', '')}): {f.get('description', '')}")
            parts.append("Feedback items:\n" + "\n".join(issues))

        addressed = ctx.get("feedback_addressed", 0)
        total = ctx.get("feedback_total", 0)
        if total > 0:
            parts.append(f"Fix progress: {addressed}/{total} items addressed")

        if ctx.get("original_strengths"):
            parts.append(f"Strengths: {', '.join(ctx['original_strengths'][:3])}")

        if ctx.get("final_score"):
            parts.append(f"Final score: {ctx['final_score']}/100")
            if ctx.get("improvement"):
                sign = "+" if ctx["improvement"] > 0 else ""
                parts.append(f"Improvement: {sign}{ctx['improvement']} points!")

        return "\n\nSESSION MEMORY:\n" + "\n".join(parts)

    # Legacy format (from direct analysis result)
    elif "overall_score" in ctx:
        return f"""
\nCurrent session context:
- Last score: {ctx.get('overall_score', 'N/A')}/100
- Summary: {ctx.get('summary', 'No previous analysis')}
- Key issues: {', '.join([f['title'] for f in ctx.get('feedback_items', [])[:3]])}
"""

    return ""


class ChatCoachSession:
    """
    Manages a text-based coaching session with Gemini 3 Flash.
    Uses multi-turn conversation with generate_content_stream.
    """

    def __init__(self, analysis_context: dict | None = None):
        self.analysis_context = analysis_context
        self.history: list[types.Content] = []
        self._system_instruction = COACH_SYSTEM_INSTRUCTION + _build_context_message(analysis_context)
        logger.info(f"ChatCoachSession created with context: {bool(analysis_context)}")

    async def send_message(self, text: str) -> AsyncGenerator[dict, None]:
        """
        Send a user message and yield streamed response events.
        Yields: {"type": "text", "content": chunk} or {"type": "tool_call", "name": ..., "args": ...}
        """
        # Add user message to history
        self.history.append(types.Content(
            role="user",
            parts=[types.Part.from_text(text=text)],
        ))

        async for event in self._generate():
            yield event

    async def send_tool_result(self, tool_name: str, result: dict) -> AsyncGenerator[dict, None]:
        """
        Send tool execution result back to the model.
        Yields any follow-up response events.
        """
        # Add function response to history
        self.history.append(types.Content(
            role="user",
            parts=[types.Part.from_function_response(
                name=tool_name,
                response=result,
            )],
        ))

        async for event in self._generate():
            yield event

    async def _generate(self) -> AsyncGenerator[dict, None]:
        """Run generate_content_stream and yield events."""
        config = types.GenerateContentConfig(
            system_instruction=self._system_instruction,
            tools=COACH_TOOLS,
        )

        try:
            response_parts = []
            full_text = ""

            stream = await client.aio.models.generate_content_stream(
                model=CHAT_MODEL,
                contents=self.history,
                config=config,
            )
            async for chunk in stream:
                if not chunk.candidates:
                    continue

                for candidate in chunk.candidates:
                    if not candidate.content or not candidate.content.parts:
                        continue

                    for part in candidate.content.parts:
                        # Handle text chunks
                        if part.text:
                            full_text += part.text
                            yield {"type": "text", "content": part.text}

                        # Handle function calls
                        if part.function_call:
                            fc = part.function_call
                            args = dict(fc.args) if fc.args else {}
                            logger.info(f"Tool call: {fc.name}({args})")
                            yield {
                                "type": "tool_call",
                                "name": fc.name,
                                "args": args,
                            }
                            response_parts.append(part)

            # Build the model's response Content and add to history
            parts_for_history = []
            if full_text:
                parts_for_history.append(types.Part.from_text(text=full_text))
            parts_for_history.extend(response_parts)

            if parts_for_history:
                self.history.append(types.Content(
                    role="model",
                    parts=parts_for_history,
                ))

        except Exception as e:
            logger.error(f"Error in generate: {e}")
            yield {"type": "error", "content": str(e)}
