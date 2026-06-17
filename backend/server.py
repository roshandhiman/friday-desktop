"""
Friday AI — Main Backend Server
FastAPI + WebSocket server that handles:
- Voice input (Google Gemini API audio transcription & understanding)
- AI responses (Google Gemini API with function actions)
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

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

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

EXAMPLES:
- User: "Open YouTube" → "Opening YouTube for you, sir. [ACTION:OPEN_URL:https://www.youtube.com]"
- User: "Open WhatsApp" → "Opening WhatsApp now, sir. [ACTION:OPEN_APP:WhatsApp]"
- User: "What time is it?" → Just answer naturally, no action needed.
- User: "Open my projects folder in VS Code" → "Opening your projects folder in VS Code, sir. [ACTION:OPEN_VSCODE:~/projects]"
- User: "Take a screenshot" → "Taking a screenshot now, sir. [ACTION:SCREENSHOT]"
- User: "send message on whatsapp to Bujj saying hi i am friday" → "Sending message to Bujj on WhatsApp, sir. [ACTION:SEND_WHATSAPP:Bujj|hi i am friday]"

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
        # Try to find a good English voice
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
            # Try to reinitialize
            try:
                tts_engine = pyttsx3.init()
            except Exception:
                pass


def speak_async(text: str):
    """Speak text in a background thread (non-blocking)."""
    thread = threading.Thread(target=speak, args=(text,), daemon=True)
    thread.start()
    return thread


# ── Gemini API ───────────────────────────────────────────────────────────────

async def chat_with_gemini(user_message_part: dict) -> dict:
    """
    Send conversation history and optional audio to Gemini API.
    user_message_part is a part dictionary.
    Returns a dict with {"transcription": "...", "response": "..."}
    """
    global conversation_history

    if not GEMINI_API_KEY:
        print("[Gemini] Error: GEMINI_API_KEY is not set.")
        return {
            "transcription": "",
            "response": "Gemini API Key is not set, sir. Please configure it in the .env file."
        }

    # Format current user turn
    user_turn = {
        "role": "user",
        "parts": [user_message_part]
    }
    
    # If the user message part is audio, we also add an instruction text part to guide transcription and response.
    if "inlineData" in user_message_part:
        user_turn["parts"].append({
            "text": "Transcribe the audio exactly in 'transcription' and respond to it in 'response' following the system rules."
        })

    # Prepare contents history
    contents = []
    # Add history (mapping roles user->user, assistant->model)
    for msg in conversation_history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": msg["content"]}]
        })
    
    # Append the new user turn
    contents.append(user_turn)

    # Prepare request payload
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "transcription": {"type": "STRING"},
                    "response": {"type": "STRING"}
                },
                "required": ["transcription", "response"]
            }
        }
    }

    max_retries = 3
    retry_delay = 2.0  # seconds

    for attempt in range(max_retries):
        try:
            print(f"[Gemini] Sending request to {url.split('?')[0]} (Attempt {attempt + 1}/{max_retries})...")
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(url, json=payload)
                print(f"[Gemini] HTTP Status: {resp.status_code}")
                
                if resp.status_code == 429:
                    if attempt < max_retries - 1:
                        print(f"[Gemini] Got 429. Retrying in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                        continue
                    else:
                        return {
                            "transcription": "",
                            "response": "I'm sorry sir, but my Gemini brain is currently receiving too many requests (429 Rate Limit). Please wait a moment and try again."
                        }
                
                resp.raise_for_status()
                data = resp.json()
                
                # Parse text response from Gemini
                candidate = data.get("candidates", [{}])[0]
                part = candidate.get("content", {}).get("parts", [{}])[0]
                text_response = part.get("text", "{}")
                print(f"[Gemini] Raw Model Output: {text_response}")
                
                # Parse the JSON response returned by the model
                res = json.loads(text_response)
                
                transcription = res.get("transcription", "").strip()
                response_text = res.get("response", "").strip()

                print(f"[Gemini] Parsed - Transcription: '{transcription}' | Response: '{response_text}'")

                # Update conversation history with text representation of user query
                user_text = transcription if transcription else user_message_part.get("text", "")
                if user_text:
                    conversation_history.append({"role": "user", "content": user_text})
                
                conversation_history.append({"role": "assistant", "content": response_text})

                # Keep history manageable
                if len(conversation_history) > MAX_HISTORY:
                    conversation_history = conversation_history[-MAX_HISTORY:]

                return {"transcription": transcription, "response": response_text}

        except Exception as e:
            print(f"[Gemini] Exception occurred on attempt {attempt + 1}: {e}")
            if attempt < max_retries - 1:
                print(f"[Gemini] Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2
                continue
            else:
                if 'resp' in locals():
                    print(f"[Gemini] Response Content: {resp.text}")
                return {
                    "transcription": "",
                    "response": f"I'm having trouble connecting to my Gemini brain, sir. Error: {str(e)}"
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
        "gemini": bool(GEMINI_API_KEY),
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
                audio_base64 = msg["data"]
                print(f"[WS] Audio data length: {len(audio_base64)} chars")

                await ws.send_json({"type": "status", "message": "Thinking..."})

                # Send base64 audio to Gemini for audio transcription and understanding
                result = await chat_with_gemini({
                    "inlineData": {
                        "mimeType": "audio/wav",
                        "data": audio_base64
                    }
                })

                transcription = result.get("transcription", "")
                ai_response = result.get("response", "")

                # Send transcription back
                if transcription:
                    print(f"[WS] Sending transcription: '{transcription}'")
                    await ws.send_json({"type": "transcription", "text": transcription})
                else:
                    print("[WS] No transcription found in Gemini response.")

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

                result = await chat_with_gemini({"text": text})
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
