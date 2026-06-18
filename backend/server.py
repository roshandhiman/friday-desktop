"""
Friday AI — Main Backend Server
FastAPI + WebSocket server that handles:
- Voice input (Groq Whisper API transcription)
- AI responses (Groq Llama 3.3 70B chat completions)
- Text-to-speech (macOS `say` command — 100% reliable)
- Command execution (apps, URLs, files, shell commands)
"""

import asyncio
import base64
import json
import os
import re
import subprocess
import threading
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from commands import execute_action

# Load environment variables
load_dotenv()

# ── Globals ──────────────────────────────────────────────────────────────────

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# TTS control
tts_process = None
tts_lock = threading.Lock()

SYSTEM_PROMPT = """You are Friday, an elite AI assistant inspired by Jarvis from Iron Man.
You run on a macOS desktop app and can execute system commands.

PERSONALITY:
- Professional yet warm. Call the user "sir".
- Be concise in conversation, but thorough in code.
- Respond in the SAME language the user speaks (Hindi, English, Hinglish, etc.)

CODING EXPERTISE (You are an expert-level developer):
- You write production-quality, clean, well-structured code.
- For HTML/CSS/JS: Use modern best practices — semantic HTML5, CSS Grid/Flexbox, ES6+, responsive design, accessibility.
- For games: Use Canvas API or pure CSS animations. Make them polished and fun.
- For websites: Create beautiful, modern designs with gradients, animations, hover effects, dark themes.
- Always write COMPLETE, WORKING code — never use placeholders or "// add code here".
- Include proper error handling, comments, and clean formatting.
- When creating files, write the ENTIRE content — every line of HTML, CSS, JS.

ACTION FORMAT (include at END of your response):
[ACTION:OPEN_APP:AppName]
[ACTION:OPEN_URL:https://example.com]
[ACTION:RUN_COMMAND:shell command here]
[ACTION:OPEN_VSCODE:/path/to/folder]
[ACTION:SCREENSHOT]
[ACTION:SYSTEM_INFO]
[ACTION:SEND_WHATSAPP:ContactNameOrPhone|MessageText]
[ACTION:SEARCH_YOUTUBE:search query here]
[ACTION:SEARCH_GOOGLE:search query here]
[ACTION:CREATE_FILE:~/Desktop/filename.ext|file contents here]
[ACTION:OPEN_FILE:~/Desktop/filename.ext]

EXAMPLES:
- "Open YouTube" → "Opening YouTube for you, sir. [ACTION:OPEN_URL:https://www.youtube.com]"
- "Open WhatsApp" → "Opening WhatsApp now, sir. [ACTION:OPEN_APP:WhatsApp]"
- "Create a snake game" → "Creating a Snake game for you, sir. [ACTION:CREATE_FILE:~/Desktop/snake_game.html|<!DOCTYPE html><html lang='en'><head>...</head><body>...</body></html>]"
- "saved?" → Confirm: "Yes sir, it's saved on your Desktop."
- "open it" → "Opening it now, sir. [ACTION:OPEN_FILE:~/Desktop/snake_game.html]"
- "open sourav joshi vlogs on youtube" → "Opening Sourav Joshi Vlogs on YouTube, sir. [ACTION:SEARCH_YOUTUBE:Sourav Joshi Vlogs]"

CRITICAL RULES:
- For CREATE_FILE: Write ALL code on a single line after the | separator. No newlines inside the ACTION tag.
- Write COMPLETE, PRODUCTION-QUALITY code. Every HTML file must have full DOCTYPE, head, meta, styles, and scripts.
- When user says "open it" after creating a file, use OPEN_FILE with the same path.
- Remember conversation context — don't recreate files unnecessarily.
- For YouTube channel requests: Use SEARCH_YOUTUBE with the channel/video name.
- For Google searches: Use SEARCH_GOOGLE.

Format your output as a JSON object with key "response".

Be smart. Be fast. Write beautiful code. Always help."""

# Conversation history
conversation_history = []
MAX_HISTORY = 20


# ── TTS (macOS `say` command — 100% reliable) ───────────────────────────────

def speak(text: str):
    """Speak text using macOS `say` command. Much more reliable than pyttsx3."""
    global tts_process
    
    # Remove ACTION tags from speech
    clean_text = re.sub(r"\[ACTION:[^\]]+\]", "", text).strip()
    # Remove any markdown or code artifacts
    clean_text = re.sub(r"```[\s\S]*?```", "", clean_text).strip()
    clean_text = re.sub(r"`[^`]+`", "", clean_text).strip()
    
    if not clean_text:
        return

    with tts_lock:
        try:
            # Kill any existing speech
            stop_speaking()
            
            # Use macOS `say` command — works perfectly every time
            tts_process = subprocess.Popen(
                ["say", "-v", "Samantha", "-r", "190", clean_text],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            # Wait for speech to finish
            tts_process.wait()
            tts_process = None
        except Exception as e:
            print(f"[TTS] Error: {e}")
            tts_process = None


def speak_async(text: str) -> threading.Thread:
    """Speak text in a background thread (non-blocking)."""
    thread = threading.Thread(target=speak, args=(text,), daemon=True)
    thread.start()
    return thread


def stop_speaking():
    """Stop current speech."""
    global tts_process
    try:
        if tts_process and tts_process.poll() is None:
            tts_process.terminate()
            tts_process = None
        # Also kill any lingering `say` processes
        subprocess.run(["killall", "say"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass


# ── Groq API ─────────────────────────────────────────────────────────────────

async def transcribe_audio_with_groq(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio bytes using Groq Whisper. Supports wav, webm, mp3, etc."""
    if not GROQ_API_KEY:
        print("[Groq] Whisper Error: GROQ_API_KEY is not set.")
        return ""

    # Map mime types to file extensions
    ext_map = {
        "audio/webm": "webm",
        "audio/webm;codecs=opus": "webm",
        "audio/wav": "wav",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
        "audio/mpeg": "mp3",
    }
    ext = ext_map.get(mime_type, "webm")
    content_type = mime_type.split(";")[0]
    print(f"[Groq] Audio: {len(audio_bytes)} bytes, format: {mime_type} -> .{ext}")

    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
    files = {"file": (f"audio.{ext}", audio_bytes, content_type)}
    data = {
        "model": "whisper-large-v3-turbo",
        "response_format": "json",
        "language": "en",  # Help Whisper detect English/Hindi properly
    }

    max_retries = 3
    retry_delay = 1.0
    for attempt in range(max_retries):
        try:
            print(f"[Groq] Whisper request (attempt {attempt + 1})...")
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(url, headers=headers, files=files, data=data)
                
                if resp.status_code == 429:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                
                resp.raise_for_status()
                text = resp.json().get("text", "").strip()
                print(f"[Groq] Transcription: '{text}'")
                return text
                
        except Exception as e:
            print(f"[Groq] Whisper error (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
    return ""


async def chat_with_groq(user_message: str) -> dict:
    """Send message to Groq Llama 3.3 70B and get response."""
    global conversation_history

    if not GROQ_API_KEY:
        return {"response": "Groq API Key is not set, sir. Please configure it in the .env file."}

    conversation_history.append({"role": "user", "content": user_message})

    if len(conversation_history) > MAX_HISTORY:
        conversation_history = conversation_history[-MAX_HISTORY:]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT + "\n\nCRITICAL: Return ONLY a valid JSON object with key 'response'. No markdown, no thinking, no extra text."}
    ] + conversation_history

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.5,
        "max_tokens": 8000
    }

    max_retries = 3
    retry_delay = 1.5
    for attempt in range(max_retries):
        try:
            print(f"[Groq] Chat request (attempt {attempt + 1})...")
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, headers=headers, json=payload)
                
                if resp.status_code == 429:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                
                resp.raise_for_status()
                data = resp.json()
                raw = data["choices"][0]["message"]["content"]
                print(f"[Groq] Response: {raw[:300]}")
                
                try:
                    res = json.loads(raw)
                    response_text = res.get("response", raw).strip()
                except Exception:
                    response_text = raw.strip()
                
                conversation_history.append({"role": "assistant", "content": response_text})
                return {"response": response_text}
                
        except Exception as e:
            print(f"[Groq] Chat error (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
            else:
                return {"response": f"Connection error, sir. {str(e)}"}


# ── Action Parser ────────────────────────────────────────────────────────────

def parse_and_execute_actions(ai_response: str) -> list:
    """Parse ACTION tags and execute them."""
    actions = re.findall(r"\[ACTION:([A-Z_]+):?([^\]]*)\]", ai_response)
    results = []
    for action_type, params in actions:
        result = execute_action(action_type, params)
        results.append({"action": action_type, "params": params[:200], **result})
        print(f"[Action] {action_type} → {result.get('message', '')[:100]}")
    return results


# ── WebSocket Handlers ───────────────────────────────────────────────────────

async def process_and_respond(ws: WebSocket, user_text: str, is_voice: bool = False):
    """Common handler: get AI response, execute actions, speak, and reply."""
    await ws.send_json({"type": "status", "message": "Thinking..."})
    
    result = await chat_with_groq(user_text)
    ai_response = result.get("response", "")
    
    # Execute actions
    actions = parse_and_execute_actions(ai_response)
    
    # Clean response text (remove action tags)
    clean_response = re.sub(r"\[ACTION:[^\]]+\]", "", ai_response).strip()
    
    # Send response to frontend
    await ws.send_json({
        "type": "response",
        "text": clean_response,
        "actions": actions,
    })
    
    # Speak the response
    await ws.send_json({"type": "speaking", "active": True})
    speak_thread = speak_async(ai_response)
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, speak_thread.join, 30)
    await ws.send_json({"type": "speaking", "active": False})


async def handle_audio_message(ws: WebSocket, msg: dict):
    """Handle incoming audio: transcribe → respond → speak."""
    audio_bytes = base64.b64decode(msg["data"])
    mime_type = msg.get("mimeType", "audio/webm")
    print(f"[WS] Audio: {len(audio_bytes)} bytes, mime: {mime_type}")

    if len(audio_bytes) < 500:
        print("[WS] Audio too short, ignoring.")
        await ws.send_json({"type": "listening"})
        return

    await ws.send_json({"type": "status", "message": "Transcribing..."})

    transcription = await transcribe_audio_with_groq(audio_bytes, mime_type)

    if not transcription or len(transcription.strip()) < 2:
        print("[WS] Empty transcription, resuming listening.")
        await ws.send_json({"type": "listening"})
        return

    # Send transcription
    await ws.send_json({"type": "transcription", "text": transcription})

    # Process and respond
    await process_and_respond(ws, transcription, is_voice=True)

    # Signal frontend to resume listening
    await ws.send_json({"type": "listening"})


async def handle_text_message(ws: WebSocket, msg: dict):
    """Handle text input."""
    text = msg.get("data", "").strip()
    if not text:
        return
    print(f"[WS] Text: '{text}'")

    await ws.send_json({"type": "transcription", "text": text})
    await process_and_respond(ws, text)


# ── FastAPI App ──────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Friday] Starting up...")
    yield
    print("[Friday] Shutting down...")
    stop_speaking()


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
    return {"status": "ok", "groq": bool(GROQ_API_KEY)}


@app.websocket("/ws/voice")
async def voice_websocket(ws: WebSocket):
    await ws.accept()
    print("[WS] Client connected")

    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type", "")

            if msg_type == "audio":
                await handle_audio_message(ws, msg)

            elif msg_type == "text":
                await handle_text_message(ws, msg)

            elif msg_type == "stop":
                stop_speaking()
                await ws.send_json({"type": "speaking", "active": False})
                await ws.send_json({"type": "listening"})

    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Error: {e}")
        import traceback
        traceback.print_exc()
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    print(f"Backend starting on http://127.0.0.1:8765")
    uvicorn.run(app, host="127.0.0.1", port=8765, log_level="info")
