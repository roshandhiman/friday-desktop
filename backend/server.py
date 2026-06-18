"""
Friday AI — Main Backend Server
FastAPI + WebSocket server that handles:
- Voice input (Groq Whisper API transcription)
- AI responses (Groq Llama 3 API chat completions)
- Text-to-speech (pyttsx3)
- Command execution
"""

import asyncio
import io
import json
import os
import re
import tempfile
import threading
from contextlib import asynccontextmanager

import httpx
import pyttsx3
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from commands import execute_action

# Load environment variables
load_dotenv()

# ── Globals ──────────────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# pyttsx3 engine (runs in its own thread)
tts_engine = None
tts_lock = threading.Lock()

SYSTEM_PROMPT = """You are Friday, an advanced AI assistant like Jarvis from Iron Man.
You are running on a macOS desktop app. You can execute commands on the user's computer.

RULES:
1. Be concise and natural. Speak like a helpful, polite AI butler.
2. Greet properly based on time: "Good morning sir", "Good evening sir", etc.
3. Understand both Hindi and English. Respond in the same language the user speaks.
4. When the user asks to open an app, website, or run a command, include an ACTION tag in your response.

ACTION FORMAT (include at END of your response when needed):
[ACTION:OPEN_APP:AppName]
[ACTION:OPEN_URL:https://example.com]
[ACTION:RUN_COMMAND:shell command here]
[ACTION:OPEN_VSCODE:/path/to/folder]
[ACTION:SCREENSHOT]
[ACTION:SYSTEM_INFO]
[ACTION:SEND_WHATSAPP:ContactNameOrPhone|MessageText]
[ACTION:SEARCH_YOUTUBE:search query here]
[ACTION:SEARCH_GOOGLE:search query here]

EXAMPLES:
- User: "Open YouTube" → "Opening YouTube for you, sir. [ACTION:OPEN_URL:https://www.youtube.com]"
- User: "Open WhatsApp" → "Opening WhatsApp now, sir. [ACTION:OPEN_APP:WhatsApp]"
- User: "What time is it?" → Just answer naturally, no action needed.
- User: "Open my projects folder in VS Code" → "Opening your projects folder in VS Code, sir. [ACTION:OPEN_VSCODE:~/projects]"
- User: "Take a screenshot" → "Taking a screenshot now, sir. [ACTION:SCREENSHOT]"
- User: "send message on whatsapp to Bujj saying hi i am friday" → "Sending message to Bujj on WhatsApp, sir. [ACTION:SEND_WHATSAPP:Bujj|hi i am friday]"
- User: "open sourav joshi vlogs on youtube" → "Searching for Sourav Joshi Vlogs on YouTube now, sir. [ACTION:SEARCH_YOUTUBE:Sourav Joshi Vlogs]"
- User: "search for the weather in new york on google" → "Searching Google for the weather in New York, sir. [ACTION:SEARCH_GOOGLE:weather in new york]"

Format your output as a JSON object with a single key "response".

Be smart. Be fast. Never say no. Always help."""

# Conversation history (in-memory)
conversation_history = []
MAX_HISTORY = 20


# ── TTS Engine ───────────────────────────────────────────────────────────────

def init_tts():
    """Initialize pyttsx3 in a dedicated thread."""
    global tts_engine
    try:
        tts_engine = pyttsx3.init()
        # Set voice properties
        voices = tts_engine.getProperty("voices")
        for voice in voices:
            if "english" in voice.name.lower() or "samantha" in voice.name.lower():
                tts_engine.setProperty("voice", voice.id)
                break
        tts_engine.setProperty("rate", 180)  # Speed
        tts_engine.setProperty("volume", 0.9)
    except Exception as e:
        print(f"[TTS] Failed to init: {e}")
        tts_engine = None


def speak(text: str):
    """Speak text using pyttsx3 (blocking, call from thread)."""
    global tts_engine
    if tts_engine is None:
        init_tts()
    if tts_engine is None:
        return

    # Remove ACTION tags from speech
    clean_text = re.sub(r"\[ACTION:[^\]]+\]", "", text).strip()
    if not clean_text:
        return

    with tts_lock:
        try:
            tts_engine.say(clean_text)
            tts_engine.runAndWait()
        except Exception as e:
            print(f"[TTS] Error: {e}")
            try:
                tts_engine = pyttsx3.init()
            except Exception:
                pass


def speak_async(text: str):
    """Speak text in a background thread (non-blocking)."""
    thread = threading.Thread(target=speak, args=(text,), daemon=True)
    thread.start()
    return thread


# ── Groq API ─────────────────────────────────────────────────────────────────

async def transcribe_audio_with_groq(audio_bytes: bytes) -> str:
    """Transcribe audio WAV bytes using Groq's Whisper API."""
    if not GROQ_API_KEY:
        print("[Groq] Whisper Error: GROQ_API_KEY is not set.")
        return ""

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }
    
    files = {
        "file": ("audio.wav", audio_bytes, "audio/wav")
    }
    data = {
        "model": "whisper-large-v3-turbo",
        "response_format": "json"
    }

    max_retries = 3
    retry_delay = 1.0
    for attempt in range(max_retries):
        try:
            print(f"[Groq] Sending transcription request (Attempt {attempt + 1}/{max_retries})...")
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, headers=headers, files=files, data=data)
                print(f"[Groq] Whisper Status: {resp.status_code}")
                
                if resp.status_code == 429:
                    print(f"[Groq] Whisper rate limit. Retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                
                resp.raise_for_status()
                res_data = resp.json()
                text = res_data.get("text", "").strip()
                print(f"[Groq] Transcription: '{text}'")
                return text
                
        except Exception as e:
            print(f"[Groq] Whisper exception on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
                continue
            else:
                return ""


async def chat_with_groq(user_message: str) -> dict:
    """Send conversation history and text query to Groq API using Llama 3."""
    global conversation_history

    if not GROQ_API_KEY:
        return {
            "response": "Groq API Key is not set, sir. Please configure it in the .env file."
        }

    # Format current user message
    conversation_history.append({"role": "user", "content": user_message})

    # Keep history manageable
    if len(conversation_history) > MAX_HISTORY:
        conversation_history = conversation_history[-MAX_HISTORY:]

    messages = [{"role": "system", "content": SYSTEM_PROMPT + "\n\nCRITICAL: Return ONLY a valid JSON object matching the requested schema. Do not output any thinking or markdown outside the JSON."}] + conversation_history

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama-3.3-70b-specdec",  # Ultra-fast 70B model
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.5
    }

    max_retries = 3
    retry_delay = 1.5
    for attempt in range(max_retries):
        try:
            print(f"[Groq] Sending chat completions request (Attempt {attempt + 1}/{max_retries})...")
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, headers=headers, json=payload)
                print(f"[Groq] Status: {resp.status_code}")
                
                if resp.status_code == 429:
                    print(f"[Groq] Rate limit hit. Retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                
                resp.raise_for_status()
                data = resp.json()
                
                # Extract response
                ai_message_raw = data["choices"][0]["message"]["content"]
                print(f"[Groq] Raw Model Output: {ai_message_raw}")
                
                try:
                    res = json.loads(ai_message_raw)
                    response_text = res.get("response", ai_message_raw).strip()
                except Exception:
                    response_text = ai_message_raw.strip()
                
                # Update history
                conversation_history.append({"role": "assistant", "content": response_text})
                return {"response": response_text}
                
        except Exception as e:
            print(f"[Groq] Chat exception on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
                continue
            else:
                return {
                    "response": f"I'm having trouble connecting to my Groq brain, sir. Error: {str(e)}"
                }


# ── Action Parser ────────────────────────────────────────────────────────────

def parse_and_execute_actions(ai_response: str) -> list:
    """Parse ACTION tags from AI response and execute them."""
    actions = re.findall(r"\[ACTION:([A-Z_]+):?([^\]]*)\]", ai_response)
    results = []

    for action_type, params in actions:
        result = execute_action(action_type, params)
        results.append({"action": action_type, "params": params, **result})
        print(f"[Action] {action_type}:{params} → {result}")

    return results


# ── FastAPI App ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    print("[Friday] Starting up...")
    init_tts()
    yield
    print("[Friday] Shutting down...")


app = FastAPI(title="Friday AI Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "groq": bool(GROQ_API_KEY),
    }


@app.websocket("/ws/voice")
async def voice_websocket(ws: WebSocket):
    """
    WebSocket endpoint for voice interaction.
    """
    await ws.accept()
    print("[WS] Client connected")

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")
            print(f"[WS] Message received. Type: {msg_type}")

            if msg_type == "audio":
                # Decode base64 audio
                import base64
                audio_bytes = base64.b64decode(msg["data"])
                print(f"[WS] Audio bytes length: {len(audio_bytes)}")

                await ws.send_json({"type": "status", "message": "Transcribing..."})

                # 1. Transcribe with Groq Whisper
                transcription = await transcribe_audio_with_groq(audio_bytes)

                if not transcription:
                    print("[WS] Transcription empty or failed.")
                    await ws.send_json({"type": "error", "message": "Couldn't hear anything. Try again."})
                    continue

                # Send transcription back
                await ws.send_json({"type": "transcription", "text": transcription})

                # 2. Get Llama 3 response
                await ws.send_json({"type": "status", "message": "Thinking..."})
                result = await chat_with_groq(transcription)
                ai_response = result.get("response", "")

                # Parse and execute actions
                actions = parse_and_execute_actions(ai_response)

                # Send response
                clean_response = re.sub(r"\[ACTION:[^\]]+\]", "", ai_response).strip()
                print(f"[WS] Sending response: '{clean_response}' with {len(actions)} actions")
                await ws.send_json({
                    "type": "response",
                    "text": clean_response,
                    "actions": actions,
                })

                # Speak the response
                print("[WS] Speaking response...")
                await ws.send_json({"type": "speaking", "active": True})
                speak_thread = speak_async(ai_response)
                # Wait for speech to finish
                await asyncio.get_event_loop().run_in_executor(None, speak_thread.join)
                await ws.send_json({"type": "speaking", "active": False})
                print("[WS] Speaking finished.")

            elif msg_type == "text":
                # Direct text input
                text = msg.get("data", "").strip()
                if not text:
                    continue
                print(f"[WS] Text input: '{text}'")

                await ws.send_json({"type": "transcription", "text": text})
                await ws.send_json({"type": "status", "message": "Thinking..."})

                result = await chat_with_groq(text)
                ai_response = result.get("response", "")
                actions = parse_and_execute_actions(ai_response)

                clean_response = re.sub(r"\[ACTION:[^\]]+\]", "", ai_response).strip()
                print(f"[WS] Sending response: '{clean_response}' with {len(actions)} actions")
                await ws.send_json({
                    "type": "response",
                    "text": clean_response,
                    "actions": actions,
                })

                print("[WS] Speaking response...")
                await ws.send_json({"type": "speaking", "active": True})
                speak_thread = speak_async(ai_response)
                await asyncio.get_event_loop().run_in_executor(None, speak_thread.join)
                await ws.send_json({"type": "speaking", "active": False})
                print("[WS] Speaking finished.")

            elif msg_type == "stop":
                # Stop TTS
                print("[WS] Stopping speech.")
                if tts_engine:
                    with tts_lock:
                        try:
                            tts_engine.stop()
                        except Exception as e:
                            print(f"[WS] Error stopping TTS: {e}")
                await ws.send_json({"type": "speaking", "active": False})

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
