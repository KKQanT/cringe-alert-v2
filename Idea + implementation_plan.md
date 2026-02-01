# Cringe Alert - Implementation Plan

> TL;DR: A real-time AI judge that analyzes your performance videos and tells you if it's IG-worthy to impress your crush 🎤💕
> 

---

## **Overview**

Build a minimal single-page app where users can upload videos or stream live, and an AI agent provides real-time feedback with:

- Streaming thinking + feedback
- Timestamp-based performance markers (🟢 good / 🔴 cringe)
- Final "Cringe Score" (0-100)

---

## **🎭 Parallel Dual-Model Strategy**

> Key Insight: Two models working together like a talk show!
> 
> - 🎙️ **Host (Gemini 2.5 Live)** - Keeps user engaged, narrates, proactive
> - 🧠 **Analyst (Gemini 3 Pro)** - Deep analysis, streaming thinking, tool calls

### **Role Separation**

| **Aspect** | **🎙️ Host (Gemini 2.5 Live)** | **🧠 Analyst (Gemini 3 Pro)** |
| --- | --- | --- |
| **Purpose** | User engagement, narration | Deep video analysis |
| **Communication** | Voice + Text (conversational) | Thinking stream + Tool calls |
| **Timing** | Continuous, proactive | Triggered on video submit |
| **Panel** | Left side - Voice bubble | Right side - Thinking stream |
| **Example** | "Ooh, this looks interesting! Let me get my colleague to analyze..." | "Analyzing frame at 0:12... detecting pitch variance..." |

### **Parallel Flow**

```
FrontendAnalyst (3 Pro)Host (2.5 Live)UserFrontendAnalyst (3 Pro)Host (2.5 Live)Userpar[Host keeps user engaged][Analyst does deep work]Upload videoNotify video receivedStart analysis"Nice! Let me take a look at this...""Oh wow, you're singing [song name]!""My colleague is analyzing now..."[Thinking] Analyzing first 10 seconds...[Tool] update_timeline_marker(0:08, "cringe", "...")[Thinking] Checking vocal technique...Analysis complete (score: 42)Send summary to Host"Alright! The results are in... *drumroll*""You scored 42/100. Your crush might... pass on this one 😅"

```

### **Why This Works**

1. **No awkward silence** - Host fills the gap while analysis runs (30-60 seconds)
2. **Personality** - Host can be funny/encouraging, Analyst stays technical
3. **Show don't tell** - Users see the AI thinking in real-time
4. **Audio option** - Host can speak (Live API native audio) while Analyst outputs text

---

## **Tool Calling Design**

We use **two categories of tools**:

1. **Backend Tools** - Gemini calls these to fetch external data (lyrics, chords)
2. **Frontend Tools** - Gemini calls these to control the UI via WebSocket

---

### **Backend Tools (Google Search Grounding)**

Gemini has a built-in **Google Search** tool that we'll use to fetch lyrics and chords automatically.

```
# backend/app/services/gemini_service.py
from google.genaiimport types

# Enable Google Search grounding for lyrics lookup
tools= [
    types.Tool(google_search=types.GoogleSearch()),# Built-in search
    types.Tool(function_declarations=FRONTEND_TOOLS)# Our custom tools
]

```

**Lyrics Search Flow:**

```
FrontendBackendGoogle SearchGemini 3 ProFrontendBackendGoogle SearchGemini 3 ProAnalyzing video audio...Detect song title from audiosearch("Taylor Swift Shake It Off lyrics")Search results with lyricstool_call: set_lyrics({lyrics: [...], source: "genius.com"})WebSocket eventDisplay lyrics in panel

```

**NOTE**

If Google Search can't find lyrics (instrumental, obscure song), the Host will ask the user to paste them manually.

---

### **Frontend Tools (UI Control)**

The AI controls the frontend via structured tool calls sent through WebSocket:

```
{
"source":"analyst",
"type":"tool_call",
"tool":"update_timeline_marker",
"params": {
"timestamp":12.5,
"type":"cringe",
"reason":"Off-key note on high C"
  }
}

```

### **Available Frontend Tools**

**Analysis Tools:**

| **Tool** | **Called By** | **Description** |
| --- | --- | --- |
| `set_lyrics` | Analyst | Set lyrics for the song (from search or user input) |
| `highlight_lyrics` | Host/Analyst | Highlight specific lyric line at timestamp |
| `update_timeline_marker` | Analyst | Add green/red dot at timestamp |
| `display_feedback` | Analyst | Show feedback item in panel |
| `update_cringe_score` | Analyst | Update the live cringe score |
| `show_thinking` | Analyst | Stream AI thinking process |
| `set_verdict` | Analyst | Final verdict (POST or DONT POST) |
| `request_lyrics_input` | Host | Ask user to paste lyrics (fallback) |
| `set_chords` | Analyst | Display chord progression (optional) |

**Coaching Mode Tools:**

| **Tool** | **Called By** | **Description** |
| --- | --- | --- |
| `request_reference_url` | Host | Ask user to paste YouTube URL for comparison |
| `set_reference_video` | Analyst | Set the reference video URL + timestamp mapping |
| `seek_user_video` | Host | Jump user's video to specific timestamp |
| `seek_reference_video` | Host | Jump YouTube reference to specific timestamp |
| `play_both_videos` | Host | Sync play both videos for comparison |
| `enter_coaching_mode` | Host | Switch UI to coaching mode |
| `set_coaching_focus` | Host | Set current issue being coached |
| `exit_coaching_mode` | Host | Return to normal view |

---

### **Lyrics Timestamp Sync**

The video timeline and lyrics panel stay synchronized:

```

```

**Frontend Sync Logic:**

```
// In VideoPlayground component
consthandleTimeUpdate= (currentTime:number)=> {
const {lyrics,setCurrentLyricIndex }=useLyricsStore.getState();

// Find the lyric line that matches current timestamp
constindex=lyrics.findIndex((line,i)=> {
constnextLine=lyrics[i+1];
returncurrentTime>=line.timestamp&&
           (!nextLine||currentTime<nextLine.timestamp);
  });

if (index!==-1) {
setCurrentLyricIndex(index);
  }
};

```

**Lyrics Data Structure:**

```
interfaceLyricLine {
index:number;
timestamp:number;// Start time in seconds
text:string;
chord?:string;// Optional chord (e.g., "Am", "G")
}

// Example from Gemini analysis
constlyrics:LyricLine[]= [
  {index:0,timestamp:0.0,text:"♪ Intro ♪",chord:"C" },
  {index:1,timestamp:5.2,text:"First line of the song...",chord:"Am" },
  {index:2,timestamp:8.5,text:"Second line continues...",chord:"F" },
// ...
];

```

---

## **Data Flow**

### **Flow 1: Video Upload + Judging**

```
Gemini 3 ProFirebaseBackendFrontendUserGemini 3 ProFirebaseBackendFrontendUserloop[Streaming Response]Click "Judge My Performance"Open upload modalSelect video fileRequest signed URLGenerate signed URLSigned URLSigned URLUpload video directlyUpload completeTrigger analysisConvert WebM to MP4 (if needed)Analyze videoTool call (marker/feedback)WebSocket eventUpdate UIFinal verdict + scoreComplete event

```

### **Flow 2: Live Recording + Real-time Coaching**

```
Gemini 2.5 LiveBackendFrontendUserGemini 2.5 LiveBackendFrontendUserloop[Real-time Stream]Switch to Gemini 3 Profor full analysisClick "Go Live"Request ephemeral tokenEphemeral tokenConnect Live API (WebSocket)Audio/Video chunksProactive coachingStop recordingSave recording + trigger full analysis

```

---

## **Proposed Changes**

### **Backend Structure**

```
cring-alert/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Environment config
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── upload.py           # Video upload endpoints
│   │   │   ├── analyze.py          # Analysis endpoints
│   │   │   └── websocket.py        # WebSocket handlers
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── firebase_service.py # Firebase signed URLs
│   │   │   ├── gemini_service.py   # Gemini 3 Pro analysis
│   │   │   ├── live_api_service.py # Gemini 2.5 Live API
│   │   │   └── video_service.py    # Video conversion
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── models.py           # Pydantic models
│   │   └── tools/
│   │       ├── __init__.py
│   │       └── frontend_tools.py   # Tool definitions
│   ├── requirements.txt
│   └── Dockerfile

```

---

### **Frontend Structure**

**Tech Stack:**

| **Tool** | **Purpose** |
| --- | --- |
| **Vite + React 18** | Build tool + UI framework |
| **TypeScript** | Type safety |
| **Tailwind CSS v4** | Styling (utility-first) |
| **Zustand** | UI + WebSocket state |
| **TanStack Query** | REST API calls (upload, signed URLs) |

**IMPORTANT**

**WebSocket Pattern:** We use a **class-based WebSocketManager** (not a hook) to avoid re-render bugs. The class pushes updates directly to Zustand stores.

```
cring-alert/
├── frontend/
│   ├── src/
│   │   ├── App.tsx                    # Single page layout
│   │   ├── index.css                  # Tailwind imports
│   │   │
│   │   ├── components/                # UI Components (presentation only)
│   │   │   ├── VideoPlayground/
│   │   │   │   └── VideoPlayground.tsx
│   │   │   ├── HostPanel/
│   │   │   │   └── HostPanel.tsx      # 🎙️ Gemini 2.5 Live messages
│   │   │   ├── AnalystPanel/
│   │   │   │   └── AnalystPanel.tsx   # 🧠 Gemini 3 thinking + feedback
│   │   │   ├── CringeScore/
│   │   │   │   └── CringeScore.tsx    # Score + verdict display
│   │   │   ├── LyricsPanel/
│   │   │   │   └── LyricsPanel.tsx
│   │   │   ├── TimelineMarkers/
│   │   │   │   └── TimelineMarkers.tsx
│   │   │   └── UploadModal/
│   │   │       └── UploadModal.tsx
│   │   │
│   │   ├── stores/                    # Zustand stores
│   │   │   ├── useAppStore.ts         # Global UI state (modal, video URL)
│   │   │   ├── useAnalysisStore.ts    # Analyst state (thinking, markers, feedback)
│   │   │   ├── useHostStore.ts        # Host state (messages, audio playback)
│   │   │   ├── useLyricsStore.ts      # Lyrics state (lines, current index)
│   │   │   └── useCoachingStore.ts    # Coaching state (issues, progress)
│   │   │
│   │   ├── services/                  # External connections
│   │   │   ├── api.ts                 # TanStack Query hooks (REST)
│   │   │   ├── WebSocketManager.ts    # WebSocket CLASS (singleton)
│   │   │   └── firebase.ts            # Firebase upload helper
│   │   │
│   │   ├── types/
│   │   │   └── index.ts               # TypeScript types
│   │   │
│   │   └── main.tsx
│   │
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── index.html

```

### **WebSocket → Zustand Pattern (No Hooks!)**

```

```

**Why this works:**

- ✅ Single WebSocket connection (singleton pattern)
- ✅ No useEffect dependency issues
- ✅ Components only subscribe to Zustand (simple!)
- ✅ TanStack Query handles REST (upload, trigger analysis)
- ✅ Easy to debug and test

---

### **File Details**

### **[NEW] main.py**

FastAPI application with:

- CORS middleware
- WebSocket endpoint `/ws`
- Include routers for upload and analyze
- Health check endpoint

### **[NEW] gemini_service.py**

Gemini 3 Pro service:

- Video analysis with thinking enabled
- Structured output for tool calls
- Streaming response handling
- Cringe score calculation

Key function:

```
asyncdefanalyze_video(video_url:str,lyrics:str|None=None):
"""
    Analyze video and stream tool calls to update frontend.
    Uses Gemini 3 Pro with high thinking level.
    """

```

### **[NEW] live_api_service.py**

Gemini 2.5 Live API service (The Host 🎙️):

- Ephemeral token generation for client-side connection
- Real-time audio streaming (native audio output)
- Proactive commentary during analysis
- Receives updates from Analyst to announce results

```
asyncdefstart_host_session(ws: WebSocket):
"""Start a Live API session as the friendly host."""
    config= {
"response_modalities": ["AUDIO","TEXT"],
"system_instruction":"""You are a fun, encouraging host for a video
        performance judging app. Your job is to:
        1. Keep the user entertained while analysis runs
        2. Comment on what you see in their video
        3. Build suspense before revealing the score
        4. Be supportive but honest about the results"""
    }

```

### **[NEW] orchestrator_service.py**

**Coordinates parallel execution of Host + Analyst:**

```
asyncdeforchestrate_analysis(video_url:str,ws: WebSocket):
"""
    Run Host and Analyst in parallel:
    1. Notify Host that video is received
    2. Start Analyst (Gemini 3 Pro) analysis
    3. Host provides commentary while waiting
    4. When Analyst completes, send summary to Host
    5. Host announces the verdict dramatically
    """

# Start both in parallel
asyncwith asyncio.TaskGroup()as tg:
        analyst_task= tg.create_task(
            gemini_service.analyze_video(video_url, ws)
        )
        host_task= tg.create_task(
            live_api_service.host_commentary(ws,analyst_updates=analyst_task)
        )

# Get final results
    analysis_result= analyst_task.result()

# Host announces verdict
await live_api_service.announce_verdict(ws, analysis_result)

```

### **[NEW] frontend_tools.py**

Tool definitions for Gemini to control frontend:

```
FRONTEND_TOOLS= [
    {
"name":"update_timeline_marker",
"description":"Add a performance marker at a specific timestamp",
"parameters": {
"type":"object",
"properties": {
"timestamp": {"type":"number"},
"type": {"type":"string","enum": ["good","cringe"]},
"reason": {"type":"string"}
            },
"required": ["timestamp","type","reason"]
        }
    },
# ... more tools
]

```

### **[NEW] App.tsx**

Main single-page layout with **two AI panels** + **reference video support**:

**Judge Mode (Initial):**

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CRINGE ALERT 🚨                                │
│          [Judge My Performance]  [Optional: Paste YouTube URL 📎]      │
├────────────────────┬───────────────────────┬───────────────────────────┤
│                    │                       │                           │
│   🎙️ HOST PANEL   │   VIDEO PLAYGROUND    │   🧠 ANALYST PANEL        │
│   (Gemini 2.5)     │                       │   (Gemini 3 Pro)          │
│                    │   ┌───────────────┐   │                           │
│   ┌──────────────┐ │   │  YOUR VIDEO   │   │   ┌───────────────────┐   │
│   │ 🗨️ "Nice    │ │   │               │   │   │ 💭 Thinking...    │   │
│   │  cover!"    │ │   └───────────────┘   │   │ Comparing to       │   │
│   └──────────────┘ │   ●○●●○●●●○●●●○●●     │   │ original...        │   │
│                    │                       │   └───────────────────┘   │
│   [🎤 Voice]       │   ♪ Lyrics Panel      │   📋 FEEDBACK ITEMS       │
│                    │   "Current line..."   │   🔴 0:12 - Off-key       │
├────────────────────┴───────────────────────┴───────────────────────────┤
│                         CRINGE SCORE: 42/100                           │
│                 ❌ DON'T POST    [🎯 Start Coaching]                   │
└────────────────────────────────────────────────────────────────────────┘

```

**Coaching Mode (After clicking "Start Coaching"):**

```
┌────────────────────────────────────────────────────────────────────────┐
│                    🎯 COACHING MODE - Chorus Practice                  │
│                         [Exit Coaching]                                │
├────────────────────┬───────────────────────────────────────────────────┤
│                    │                                                   │
│   🎙️ HOST PANEL   │   SIDE-BY-SIDE COMPARISON                         │
│   (Coach Mode)     │                                                   │
│                    │   ┌─────────────┐    ┌─────────────┐              │
│   ┌──────────────┐ │   │ YOUR VIDEO  │    │  ORIGINAL   │              │
│   │ 🗨️ "Listen  │ │   │   0:12      │    │   0:45      │              │
│   │  to how he  │ │   └─────────────┘    └─────────────┘              │
│   │  holds the  │ │                                                   │
│   │  note..."   │ │   [⏮️] [▶️ Play Both] [⏭️] [🔁 Loop Section]      │
│   └──────────────┘ │                                                   │
│                    │   📝 Focus: "Hold the note on 'case' for 2 beats" │
│   [Paste URL if    │                                                   │
│    no reference]   │   ♪ Lyrics: "...am I just para-NOID..."          │
│                    │              ▲ You're here                        │
├────────────────────┴───────────────────────────────────────────────────┤
│   Coaching Progress: [====>     ] Issue 2 of 5                         │
└────────────────────────────────────────────────────────────────────────┘

```

**Panel Breakdown:**

| **Panel** | **AI Model** | **Content Type** |
| --- | --- | --- |
| 🎙️ Host Panel (Left) | Gemini 2.5 Live | Voice bubbles, coaching guidance |
| 📺 Video Area (Center) | - | User video OR side-by-side comparison |
| 🎬 Reference Video | YouTube Embed | Original song (controlled by Host) |
| 🧠 Analyst Panel (Right) | Gemini 3 Pro | Thinking stream, feedback, timestamp mapping |

---

## **Key Implementation Details**

### **1. WebM to MP4 Conversion**

```
# backend/app/services/video_service.py
import subprocess

asyncdefconvert_to_mp4(input_path:str,output_path:str) ->str:
"""Convert WebM to MP4 using ffmpeg."""
    cmd= [
"ffmpeg","-i", input_path,
"-c:v","libx264","-c:a","aac",
"-y", output_path
    ]
    subprocess.run(cmd,check=True)
return output_path

```

### **2. Streaming Tool Calls via WebSocket**

```
# backend/app/services/gemini_service.py
asyncdefanalyze_and_stream(video_url:str,ws: WebSocket):
    response= client.models.generate_content_stream(
model="gemini-3-pro-preview",
contents=[video_part, analysis_prompt],
config=types.GenerateContentConfig(
thinking_config=types.ThinkingConfig(thinking_level="high"),
tools=FRONTEND_TOOLS
        )
    )

asyncfor chunkin response:
if chunk.function_call:
await ws.send_json({
"type":"tool_call",
"tool": chunk.function_call.name,
"params": chunk.function_call.args
            })

```

### **3. WebSocketManager Class (Singleton)**

```
// frontend/src/services/WebSocketManager.ts
import {useAnalysisStore }from'../stores/useAnalysisStore';
import {useHostStore }from'../stores/useHostStore';

classWebSocketManager {
privatews:WebSocket|null=null;
privatestaticinstance:WebSocketManager;

staticgetInstance() {
if (!this.instance) {
this.instance=newWebSocketManager();
    }
returnthis.instance;
  }

connect(sessionId:string) {
constwsUrl=`${import.meta.env.VITE_WS_URL}/ws/${sessionId}`;
this.ws=newWebSocket(wsUrl);

this.ws.onopen= ()=> {
console.log('WebSocket connected');
    };

this.ws.onmessage= (event)=> {
constdata=JSON.parse(event.data);

// Route to correct store based on source
if (data.source==='analyst') {
this.handleAnalystMessage(data);
      }elseif (data.source==='host') {
this.handleHostMessage(data);
      }
    };

this.ws.onerror= (error)=> {
console.error('WebSocket error:',error);
    };

this.ws.onclose= ()=> {
console.log('WebSocket closed');
    };
  }

privatehandleAnalystMessage(data:any) {
conststore=useAnalysisStore.getState();

switch (data.type) {
case'thinking':
store.addThinking(data.content);
break;
case'tool_call':
if (data.tool==='update_timeline_marker') {
store.addMarker(data.params);
        }elseif (data.tool==='display_feedback') {
store.addFeedback(data.params);
        }elseif (data.tool==='update_cringe_score') {
store.setScore(data.params.score);
        }elseif (data.tool==='set_verdict') {
store.setVerdict(data.params.verdict);
        }elseif (data.tool==='set_lyrics') {
// Route to lyrics store
constlyricsStore=useLyricsStore.getState();
lyricsStore.setLyrics(data.params.lyrics,data.params.source);
        }elseif (data.tool==='request_lyrics_input') {
// Host asks user to paste lyrics
constlyricsStore=useLyricsStore.getState();
lyricsStore.requestManualInput();
        }elseif (data.tool==='highlight_lyrics') {
// Sync lyrics with video timestamp
constlyricsStore=useLyricsStore.getState();
lyricsStore.setCurrentIndex(data.params.index);
        }
break;
case'complete':
store.setComplete();
break;
    }
  }

privatehandleHostMessage(data:any) {
conststore=useHostStore.getState();

switch (data.type) {
case'text':
store.addMessage(data.content);
break;
case'audio':
store.queueAudio(data.audioData);
break;
    }
  }

disconnect() {
this.ws?.close();
this.ws=null;
  }
}

exportconstwsManager=WebSocketManager.getInstance();

```

### **4. Zustand Stores**

```
// frontend/src/stores/useAnalysisStore.ts
import {create }from'zustand';

interfaceMarker {
id:string;
timestamp:number;
type:'good'|'cringe';
reason:string;
}

interfaceFeedback {
id:string;
timestamp:number;
type:'good'|'cringe';
message:string;
}

interfaceAnalysisState {
isAnalyzing:boolean;
thinking:string[];
markers:Marker[];
feedback:Feedback[];
score:number|null;
verdict:'POST'|'DONT_POST'|null;

// Actions
startAnalysis: ()=>void;
addThinking: (text:string)=>void;
addMarker: (marker:Omit<Marker,'id'>)=>void;
addFeedback: (item:Omit<Feedback,'id'>)=>void;
setScore: (score:number)=>void;
setVerdict: (verdict:'POST'|'DONT_POST')=>void;
setComplete: ()=>void;
reset: ()=>void;
}

exportconstuseAnalysisStore=create<AnalysisState>((set)=> ({
isAnalyzing:false,
thinking: [],
markers: [],
feedback: [],
score:null,
verdict:null,

startAnalysis: ()=>set({
isAnalyzing:true,
thinking: [],
markers: [],
feedback: [],
score:null,
verdict:null
  }),

addThinking: (text)=>set((state)=> ({
thinking: [...state.thinking,text]
  })),

addMarker: (marker)=>set((state)=> ({
markers: [...state.markers, {...marker,id:crypto.randomUUID() }]
  })),

addFeedback: (item)=>set((state)=> ({
feedback: [...state.feedback, {...item,id:crypto.randomUUID() }]
  })),

setScore: (score)=>set({score }),

setVerdict: (verdict)=>set({verdict }),

setComplete: ()=>set({isAnalyzing:false }),

reset: ()=>set({
isAnalyzing:false,
thinking: [],
markers: [],
feedback: [],
score:null,
verdict:null
  }),
}));

```

```
// frontend/src/stores/useHostStore.ts
import {create }from'zustand';

interfaceHostMessage {
id:string;
content:string;
timestamp:number;
}

interfaceHostState {
messages:HostMessage[];
audioQueue:string[];// base64 audio chunks
isPlaying:boolean;

// Actions
addMessage: (content:string)=>void;
queueAudio: (audioData:string)=>void;
dequeueAudio: ()=>string|undefined;
setPlaying: (playing:boolean)=>void;
reset: ()=>void;
}

exportconstuseHostStore=create<HostState>((set,get)=> ({
messages: [],
audioQueue: [],
isPlaying:false,

addMessage: (content)=>set((state)=> ({
messages: [...state.messages, {
id:crypto.randomUUID(),
content,
timestamp:Date.now()
    }]
  })),

queueAudio: (audioData)=>set((state)=> ({
audioQueue: [...state.audioQueue,audioData]
  })),

dequeueAudio: ()=> {
constqueue=get().audioQueue;
if (queue.length===0)returnundefined;
set({audioQueue:queue.slice(1) });
returnqueue[0];
  },

setPlaying: (playing)=>set({isPlaying:playing }),

reset: ()=>set({messages: [],audioQueue: [],isPlaying:false }),
}));

```

```
// frontend/src/stores/useLyricsStore.ts
import {create }from'zustand';

interfaceLyricLine {
index:number;
timestamp:number;// Start time in seconds
text:string;
chord?:string;
}

interfaceLyricsState {
lyrics:LyricLine[];
currentIndex:number;
source:string|null;// e.g., "genius.com", "user_input"
isLoading:boolean;
needsManualInput:boolean;

// Actions
setLyrics: (lyrics:LyricLine[],source:string)=>void;
setCurrentIndex: (index:number)=>void;
requestManualInput: ()=>void;
setLoading: (loading:boolean)=>void;
reset: ()=>void;
}

exportconstuseLyricsStore=create<LyricsState>((set)=> ({
lyrics: [],
currentIndex:0,
source:null,
isLoading:false,
needsManualInput:false,

setLyrics: (lyrics,source)=>set({
lyrics,
source,
currentIndex:0,
needsManualInput:false,
isLoading:false
  }),

setCurrentIndex: (index)=>set({currentIndex:index }),

requestManualInput: ()=>set({needsManualInput:true,isLoading:false }),

setLoading: (loading)=>set({isLoading:loading }),

reset: ()=>set({
lyrics: [],
currentIndex:0,
source:null,
isLoading:false,
needsManualInput:false
  }),
}));

```

### **5. TanStack Query for REST API**

```
// frontend/src/services/api.ts
import {useMutation }from'@tanstack/react-query';

constAPI_BASE=import.meta.env.VITE_API_URL;

// Get signed URL for Firebase upload
exportconstuseSignedUrl= ()=> {
returnuseMutation({
mutationFn:async (filename:string)=> {
constres=awaitfetch(`${API_BASE}/upload/signed-url`, {
method:'POST',
headers: {'Content-Type':'application/json' },
body:JSON.stringify({filename }),
      });
if (!res.ok)thrownewError('Failed to get signed URL');
returnres.json()asPromise<{url:string;public_url:string }>;
    },
  });
};

// Trigger analysis after video upload
exportconstuseStartAnalysis= ()=> {
returnuseMutation({
mutationFn:async (params: {videoUrl:string;lyrics?:string })=> {
constres=awaitfetch(`${API_BASE}/analyze/start`, {
method:'POST',
headers: {'Content-Type':'application/json' },
body:JSON.stringify({
video_url:params.videoUrl,
lyrics:params.lyrics
        }),
      });
if (!res.ok)thrownewError('Failed to start analysis');
returnres.json()asPromise<{session_id:string }>;
    },
  });
};

// Get ephemeral token for Live API
exportconstuseEphemeralToken= ()=> {
returnuseMutation({
mutationFn:async ()=> {
constres=awaitfetch(`${API_BASE}/live/ephemeral-token`);
if (!res.ok)thrownewError('Failed to get token');
returnres.json()asPromise<{token:string }>;
    },
  });
};

```

### **4. Ephemeral Token for Live API (Client-side connection)**

```
# backend/app/routers/analyze.py
@router.get("/ephemeral-token")
asyncdefget_ephemeral_token():
"""Generate ephemeral token for client-side Live API connection."""
    token= client.auth.tokens.create(
config={"expire_time":"30m"}
    )
return {"token": token.name}

```

---

## **State Sync & Context Management**

### **How Gemini 2.5 Live Knows Frontend State**

Backend maintains **session state** that gets passed to Gemini with each interaction

**Backend Session State:**

```
# backend/app/services/session_state.py
from dataclassesimport dataclass, field

@dataclass
classSessionState:
    session_id:str
    video_url:str|None=None
    reference_url:str|None=None

# From Gemini 3 analysis
    analysis_result:dict|None=None
    cringe_score:int|None=None
    timestamp_mapping: list[dict]|None=None

# Coaching state
    coaching_mode:bool=False
    issues: list[dict]= field(default_factory=list)
    current_issue_index:int=0

defget_context_for_host(self) ->str:
"""Generate context string for Gemini 2.5 Live."""
returnf"""
        Current session:
        - Video:{self.video_url}
        - Reference:{self.reference_urlor'Not provided'}
        - Score:{self.cringe_score}/100
        - Coaching mode:{self.coaching_mode}
        - Current issue:{self.current_issue_index+1} of{len(self.issues)}
        - Issues:{json.dumps(self.issues)}
        """

# In-memory store (MVP - no database)
sessions: dict[str, SessionState]= {}

```

### **Coaching Context Store (Frontend)**

```
// frontend/src/stores/useCoachingStore.ts
import {create }from'zustand';

interfaceIssue {
id:string;
timestamp:number;
userTimestamp:number;// timestamp in user's video
referenceTimestamp?:number;// timestamp in original (if available)
type:'cringe'|'good';
message:string;
status:'pending'|'in_progress'|'resolved'|'skipped';
}

interfaceCoachingState {
isCoachingMode:boolean;
issues:Issue[];
currentIssueIndex:number;

// Actions
enterCoachingMode: (issues:Issue[])=>void;
exitCoachingMode: ()=>void;
markResolved: (id:string)=>void;
markSkipped: (id:string)=>void;
setCurrentIssue: (index:number)=>void;
nextIssue: ()=>void;
previousIssue: ()=>void;
}

exportconstuseCoachingStore=create<CoachingState>((set,get)=> ({
isCoachingMode:false,
issues: [],
currentIssueIndex:0,

enterCoachingMode: (issues)=>set({
isCoachingMode:true,
issues:issues.map(i=> ({...i,status:'pending' })),
currentIssueIndex:0
  }),

exitCoachingMode: ()=>set({isCoachingMode:false }),

markResolved: (id)=>set((state)=> ({
issues:state.issues.map(i=>
i.id===id? {...i,status:'resolved' }:i
    )
  })),

markSkipped: (id)=>set((state)=> ({
issues:state.issues.map(i=>
i.id===id? {...i,status:'skipped' }:i
    )
  })),

setCurrentIssue: (index)=>set({currentIssueIndex:index }),

nextIssue: ()=> {
const {currentIssueIndex,issues }=get();
if (currentIssueIndex<issues.length-1) {
set({currentIssueIndex:currentIssueIndex+1 });
    }
  },

previousIssue: ()=> {
const {currentIssueIndex }=get();
if (currentIssueIndex>0) {
set({currentIssueIndex:currentIssueIndex-1 });
    }
  },
}));

```

### **Frontend → Backend State Sync**

```
// In WebSocketManager - send state updates to backend
sendStateUpdate() {
constcoaching=useCoachingStore.getState();
constanalysis=useAnalysisStore.getState();

this.ws?.send(JSON.stringify({
type:'state_sync',
data: {
currentIssueIndex:coaching.currentIssueIndex,
resolvedIssues:coaching.issues
        .filter(i=>i.status==='resolved')
        .map(i=>i.id),
currentVideoTime:/* from video player ref */
    }
  }));
}

```

---

## **Session Management**

> MVP Approach: In-memory backend session, no database
> 
- Backend keeps `SessionState` per session (in-memory dict)
- Frontend syncs critical state via WebSocket
- Session lost on server restart (acceptable for hackathon)

---

## **Verification Plan**

### **Automated Tests**

```
# Backend
cdbackend
pytesttests/-v

# Frontend
cdfrontend
npmruntest

```

### **Manual Verification**

1. **Video Upload Flow**
    - Upload a WebM video → verify MP4 conversion
    - Check signed URL generation works
    - Verify video appears in player
2. **AI Analysis Flow**
    - Upload test video → verify streaming response
    - Check timeline markers appear at correct timestamps
    - Verify feedback items stream in real-time
    - Confirm final cringe score displays
3. **Live Recording Flow**
    - Start live recording → verify camera/mic access
    - Check ephemeral token generation
    - Verify Live API connection (if implemented)
4. **Browser Tests**
    - Test on Chrome, Firefox, Safari
    - Test responsive layout

---

## **MVP Scope vs. Nice-to-Have**

### **✅ MVP (Must-Have)**

- Video upload + analysis with Gemini 3 Pro
- Streaming feedback via WebSocket
- Timeline markers (green/red dots)
- Cringe score display
- Basic single-page UI

### **🎯 Demo Day Goals**

- Live recording support
- Gemini 2.5 Live API for real-time coaching
- Lyrics panel with highlighting

### **🌟 Stretch Goals**

- AI voice feedback (TTS)
- Multiple video comparison
- Share verdict as image