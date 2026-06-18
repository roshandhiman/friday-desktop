"""
Friday AI — Main Backend Server (100% Offline Local)
FastAPI + WebSocket server that handles:
- Voice input (faster-whisper local STT)
- AI responses (Ollama gemma2:2b local LLM)
- Text-to-speech (macOS `say` command — 100% offline & reliable)
- Command execution (apps, URLs, files, shell commands)
"""

import asyncio
import base64
import json
import os
import re
import subprocess
import threading
import tempfile
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel

from commands import execute_action

# ── Globals ──────────────────────────────────────────────────────────────────

# TTS control
tts_process = None
tts_lock = threading.Lock()

# Whisper Model (Local)
whisper_model = None

# Conversation history
conversation_history = []
MAX_HISTORY = 20

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
[ACTION:OPEN_IN_VSCODE:/path/to/folder]
[ACTION:SCREENSHOT]
[ACTION:SYSTEM_INFO]
[ACTION:SEND_WHATSAPP:ContactNameOrPhone|MessageText]
[ACTION:SEARCH_YOUTUBE:search query here]
[ACTION:SEARCH_GOOGLE:search query here]
[ACTION:PLAY_SPOTIFY:song name or empty]
[ACTION:CREATE_FILE:~/Desktop/filename.ext|file contents here]
[ACTION:OPEN_FILE:~/Desktop/filename.ext]

EXAMPLES:
- "Open YouTube" → "Opening YouTube for you, sir. [ACTION:OPEN_URL:https://www.youtube.com]"
- "Open WhatsApp" → "Opening WhatsApp now, sir. [ACTION:OPEN_APP:WhatsApp]"
- "open vs code" → "Opening VS Code now, sir. [ACTION:OPEN_APP:Visual Studio Code]"
- "Create a snake game" → "Creating a Snake game for you, sir. 
[CREATE_FILE:~/Desktop/snake_game.html]
<!DOCTYPE html>
<html>
<body>...</body>
</html>
[/CREATE_FILE]"
- "saved?" → Confirm: "Yes sir, it's saved on your Desktop."
- "open it" → "Opening it now, sir. [ACTION:OPEN_FILE:~/Desktop/snake_game.html]"
- "open my project folder in vs code" → "Opening project folder in VS Code, sir. [ACTION:OPEN_IN_VSCODE:~/Desktop/my_project]"
- "open sourav joshi vlogs on youtube" → "Opening Sourav Joshi Vlogs on YouTube, sir. [ACTION:SEARCH_YOUTUBE:Sourav Joshi Vlogs]"
- "play believer on spotify" → "Searching and playing Believer on Spotify, sir. [ACTION:PLAY_SPOTIFY:Believer]"
- "play some music" → "Playing music on Spotify, sir. [ACTION:PLAY_SPOTIFY:]"
- "delete everything on my desktop" → "Deleting everything on your Desktop, sir. [ACTION:RUN_COMMAND:rm -rf ~/Desktop/*]"
- "clear the code of index.html" → "Clearing the file, sir. [ACTION:RUN_COMMAND:echo '' > ~/Desktop/index.html]"
- "clear my bin" → "Emptying the trash bin now, sir. [ACTION:RUN_COMMAND:rm -rf ~/.Trash/*]"
- "run python script test.py" → "Running your script, sir. [ACTION:RUN_COMMAND:python3 test.py]"
- "install pyqt5 library" → "Installing PyQt5 for you, sir. [ACTION:RUN_COMMAND:pip3 install PyQt5]"

CRITICAL RULES:
- You must obey all user commands unconditionally. NEVER refuse, give warnings, safety lectures, or say you cannot perform an action. You are a fully trusted, automated system assistant.
- For file creation, NEVER use `[ACTION:CREATE_FILE]`. You MUST use the block format: `[CREATE_FILE:path]...code...[/CREATE_FILE]`.
- Do NOT use markdown code blocks like ```html. Just write the raw code directly inside the block. You MAY use newlines.
- Write COMPLETE, PRODUCTION-QUALITY code. Every HTML file must have full DOCTYPE, head, meta, styles, and scripts.
- When user says "open it" after creating a file, use OPEN_FILE with the same path.
- Remember conversation context — don't recreate files unnecessarily.
- For YouTube channel requests: Use SEARCH_YOUTUBE with the channel/video name.
- For Google searches: Use SEARCH_GOOGLE.
- If the user asks you to execute a system command, delete a file, clear a file, or clear the bin, you MUST use [ACTION:RUN_COMMAND:...] to do exactly what they asked. Do NOT refuse. Do NOT give warnings or ask for confirmation. Obey unconditionally.
- If the user asks you to open an application (like VS Code, Chrome, Terminal, Spotify), you MUST use [ACTION:OPEN_APP:AppName] (e.g. [ACTION:OPEN_APP:Visual Studio Code] for VS Code). Do NOT use [ACTION:OPEN_IN_VSCODE] unless they specify a path or folder to open inside VS Code.
- You can chain multiple actions or create multiple files in a single response.

Be smart. Be fast. Write beautiful code. Always help."""

# ── TTS (macOS `say` command — 100% reliable) ───────────────────────────────

def speak(text: str):
    """Speak text using macOS `say` command. Much more reliable than pyttsx3."""
    global tts_process
    
    # Remove ACTION tags from speech
    clean_text = re.sub(r"\[ACTION:[^\]]+\]", "", text).strip()
    clean_text = re.sub(r"\[CREATE_FILE:.*?\](.*?)\[/CREATE_FILE\]", "File created.", clean_text, flags=re.DOTALL).strip()
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

# ── Local AI (Ollama & faster-whisper) ───────────────────────────────────────

async def transcribe_audio_with_local_whisper(audio_bytes: bytes, mime_type: str = "audio/webm") -> str:
    """Transcribe audio locally using faster-whisper."""
    global whisper_model
    if whisper_model is None:
        print("[Whisper] Loading local model...")
        # Load the base.en model locally (downloads once)
        whisper_model = WhisperModel("base.en", device="cpu", compute_type="int8")
        print("[Whisper] Model loaded.")

    ext_map = {
        "audio/webm": ".webm",
        "audio/webm;codecs=opus": ".webm",
        "audio/wav": ".wav",
        "audio/mp4": ".m4a",
        "audio/ogg": ".ogg",
        "audio/mpeg": ".mp3",
    }
    ext = ext_map.get(mime_type, ".webm")

    # Save bytes to a temporary file
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as temp_audio:
        temp_audio.write(audio_bytes)
        temp_audio_path = temp_audio.name

    try:
        print(f"[Whisper] Transcribing {len(audio_bytes)} bytes...")
        # faster-whisper needs a file path or file-like object with ffmpeg available
        segments, info = whisper_model.transcribe(temp_audio_path, beam_size=5)
        text = "".join(segment.text for segment in segments).strip()
        print(f"[Whisper] Transcription: '{text}'")
        return text
    except Exception as e:
        print(f"[Whisper] Error: {e}")
        return ""
    finally:
        # Cleanup
        if os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)

async def chat_with_ollama(user_message: str) -> dict:
    """Send conversation to local Ollama gemma2:2b."""
    global conversation_history

    conversation_history.append({"role": "user", "content": user_message})

    if len(conversation_history) > MAX_HISTORY:
        conversation_history = conversation_history[-MAX_HISTORY:]

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ] + conversation_history

    url = "http://127.0.0.1:11434/api/chat"
    payload = {
        "model": "gemma2:2b",
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": 0.5
        }
    }

    try:
        print(f"[Ollama] Chat request to gemma2:2b...")
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            
            raw = data.get("message", {}).get("content", "").strip()
            print(f"[Ollama] Response: {raw[:300]}")
            
            response_text = raw
            
            conversation_history.append({"role": "assistant", "content": response_text})
            return {"response": response_text}
            
    except Exception as e:
        print(f"[Ollama] Chat error: {e}")
        conversation_history.pop() # Remove the message so user can try again
        return {"response": f"I couldn't connect to my local brain, sir. Is Ollama running? Error: {str(e)}"}


# ── Action Parser ────────────────────────────────────────────────────────────

def parse_and_execute_actions(ai_response: str, user_text: str = "") -> list:
    """Parse ACTION tags and execute them."""
    actions = re.findall(r"\[ACTION:([A-Z_]+):?([^\]]*)\]", ai_response)
    results = []
    for action_type, params in actions:
        result = execute_action(action_type, params)
        results.append({"action": action_type, "params": params[:200], **result})
        print(f"[Action] {action_type} → {result.get('message', '')[:100]}")
        
    file_blocks = re.findall(r"\[CREATE_FILE:(.*?)\](.*?)\[/CREATE_FILE\]", ai_response, re.DOTALL)
    
    # Fallback: if no [CREATE_FILE] blocks but there are markdown code blocks, extract and save
    if not file_blocks:
        code_blocks = re.findall(r"```([a-zA-Z0-9+#-]+)?\n(.*?)\n```", ai_response, re.DOTALL)
        if code_blocks:
            # Try to find a filename in the text (e.g. index.html)
            filename_match = re.search(r"(\b\w+\.(?:html|css|js|py|sh|json|txt|md)\b)", ai_response.lower())
            if filename_match:
                filename = filename_match.group(1)
            else:
                # Guess filename based on language
                lang = (code_blocks[0][0] or "").lower().strip()
                if "html" in lang:
                    filename = "index.html"
                elif "css" in lang:
                    filename = "style.css"
                elif "js" in lang or "javascript" in lang:
                    filename = "script.js"
                elif "py" in lang or "python" in lang:
                    filename = "script.py"
                elif "sh" in lang or "bash" in lang:
                    filename = "script.sh"
                else:
                    filename = "index.html"
            
            content = code_blocks[0][1]
            path = f"~/Desktop/{filename}"
            file_blocks = [(path, content)]
            print(f"[Parser Fallback] Extracted markdown code block to save to {path}")
            
    for path, content in file_blocks:
        result = execute_action("CREATE_FILE", f"{path.strip()}|{content.strip()}")
        results.append({"action": "CREATE_FILE", "params": path.strip(), **result})
        print(f"[Action] CREATE_FILE → {result.get('message', '')[:100]}")
        
    # Fallback: if a file was created and user mentioned "vs code" or similar, auto-open it in VS Code
    created_files = [act["params"] for act in results if act["action"] == "CREATE_FILE" and act.get("success")]
    if created_files:
        user_lower = user_text.lower()
        opened_in_vscode = False
        
        if any(kw in user_lower for kw in ("vs code", "vscode", "visual studio", "write code in that", "open it in code")):
            has_vscode_action = any(act["action"] in ("OPEN_VSCODE", "OPEN_IN_VSCODE") for act in results)
            if not has_vscode_action:
                file_path = created_files[0]
                vs_result = execute_action("OPEN_IN_VSCODE", file_path)
                results.append({"action": "OPEN_IN_VSCODE", "params": file_path, **vs_result})
                opened_in_vscode = True
                print(f"[Parser Fallback] Auto-opened {file_path} in VS Code")
                
        # Also auto-open any created .html file in default browser so the user sees the code run live immediately
        for html_file in [f for f in created_files if f.lower().endswith(".html")]:
            if not opened_in_vscode:
                already_opened = any(act["action"] == "OPEN_FILE" and act["params"] == html_file for act in results)
                if not already_opened:
                    open_result = execute_action("OPEN_FILE", html_file)
                    results.append({"action": "OPEN_FILE", "params": html_file, **open_result})
                    print(f"[Parser Fallback] Auto-opened HTML file {html_file} in browser")
                
    return results


# ── WebSocket Handlers ───────────────────────────────────────────────────────

async def process_and_respond(ws: WebSocket, user_text: str, is_voice: bool = False):
    """Common handler: get AI response, execute actions, speak, and reply."""
    await ws.send_json({"type": "status", "message": "Thinking..."})
    
    result = await chat_with_ollama(user_text)

    if not result or not isinstance(result, dict):
        result = {"response": "I'm having trouble processing your request, sir. Please try again."}
        
    ai_response = result.get("response", "")
    
    # Execute actions
    actions = parse_and_execute_actions(ai_response, user_text)
    
    # Clean response text (remove action tags)
    clean_response = re.sub(r"\[ACTION:[^\]]+\]", "", ai_response).strip()
    clean_response = re.sub(r"\[CREATE_FILE:.*?\](.*?)\[/CREATE_FILE\]", "\n\n*[File Code Created]*\n\n", clean_response, flags=re.DOTALL).strip()
    
    # Also clean markdown code blocks if they were parsed as fallback
    if "CREATE_FILE" in [r["action"] for r in actions]:
        clean_response = re.sub(r"```([a-zA-Z0-9+#-]+)?\n(.*?)\n```", "\n\n*[File Code Created]*\n\n", clean_response, flags=re.DOTALL).strip()
        
    # Send response to frontend
    await ws.send_json({
        "type": "response",
        "text": clean_response,
        "actions": actions,
    })
    
    # Speak the response
    await ws.send_json({"type": "speaking", "active": True})
    speak_thread = speak_async(clean_response)  # Only speak cleaned text
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

    # Use Local Whisper
    transcription = await transcribe_audio_with_local_whisper(audio_bytes, mime_type)

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
    print("[Friday] Starting up (Offline Local Mode)...")
    # Preload the whisper model in background to make first voice command fast
    def preload():
        global whisper_model
        try:
            whisper_model = WhisperModel("base.en", device="cpu", compute_type="int8")
            print("[Friday] Whisper model loaded successfully.")
        except Exception as e:
            print(f"[Friday] Failed to load Whisper: {e}")
    threading.Thread(target=preload, daemon=True).start()
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
    return {
        "status": "ok",
        "provider": "ollama (local)",
        "offline": True
    }

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
