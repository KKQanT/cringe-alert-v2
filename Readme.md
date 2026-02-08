# Cringe Alert V2

AI-powered music performance coach that analyzes singing/guitar cover videos and helps you fix issues one by one.

## What It Does

1. **Upload a cover video** -- Record or upload yourself playing a guitar/vocal cover
2. **AI analyzes your performance** -- Gemini Pro watches your video, identifies the song, scores you 0-100, and generates detailed feedback cards (pitch issues, timing problems, guitar mistakes, etc.)
3. **Fix issues one by one** -- Each feedback card has a "Fix this" button. Record a short clip targeting that specific issue, and AI judges whether you nailed it
4. **AI Coach guides you** -- A real-time chat coach (Gemini Flash over WebSocket) proactively walks you through your feedback, suggests what to fix first, celebrates your wins, and opens fix modals for you
5. **Record your final take** -- When you've addressed enough issues, record a final full performance
6. **AI compares original vs final** -- Get a comparison summary, score improvement, and a fun Instagram-worthiness verdict

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React + TypeScript + Vite + TailwindCSS + Zustand + TanStack Query |
| Backend | FastAPI (Python) |
| AI | Google Gemini 3 Pro (analysis), Gemini 3 Flash (coach chat + fix evaluation) |
| Storage | Firebase Storage (video blobs) + Firestore (session data) |
| Real-time | WebSocket (coach chat), SSE (streaming analysis) |

## Core Flow

```
Upload Original Video
        |
        v
  AI Analysis (Gemini Pro)
  - Score, feedback cards, strengths
        |
        v
  Fix Issues Loop (card by card)
  - Click "Fix this" on a card
  - Record a short clip
  - AI evaluates (Gemini Flash): Fixed or Try Again?
  - Coach cheers you on
        |
        v
  Record Final Take
        |
        v
  AI Comparison + IG Verdict
  - Score delta, what improved, what still needs work
  - "Is this Instagram-worthy?" verdict
```

## Key Features

- **Feedback-card-driven coaching loop** -- Each issue is individually fixable with AI judgment, not generic practice recordings
- **Proactive AI coach** -- Auto-connects after analysis, suggests which card to fix, uses tools to control the UI (seek video, highlight cards, open fix modals)
- **Streaming everything** -- Analysis streams thinking + results in real-time via SSE; coach streams text via WebSocket
- **Session persistence** -- Sessions save to Firestore with full fix history; restores on reload with fresh signed URLs
- **Lyric highlighting** -- Feedback references to sung lyrics are wrapped in `<<markers>>` and rendered as styled inline quotes
