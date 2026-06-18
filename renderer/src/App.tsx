"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { Mic, MicOff, Send } from "lucide-react";

// Extend Window for preload APIs
declare global {
  interface Window {
    fridayAPI?: {
      backendUrl: string;
      healthUrl: string;
    };
  }
}

interface ChatMessage {
  role: "user" | "assistant" | "status";
  text: string;
  timestamp: number;
}

const WS_URL = "ws://127.0.0.1:8765/ws/voice";

// Voice Activity Detection config
const SILENCE_THRESHOLD = 0.015;    // Volume level below this = silence
const SILENCE_DURATION_MS = 1800;   // ms of silence before auto-send
const MIN_SPEECH_DURATION_MS = 400; // Minimum speech duration to be valid

export default function App() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState("Starting up...");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechStartRef = useRef<number>(0);
  const hasSpeechRef = useRef(false);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isListeningRef = useRef(false);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Cleanup mic resources ──
  const cleanupMic = useCallback(() => {
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (e) { /* ignore */ }
      mediaRecorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch (e) { /* ignore */ }
      });
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch (e) { /* ignore */ }
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    audioChunksRef.current = [];
    hasSpeechRef.current = false;
    isListeningRef.current = false;
  }, []);

  // ── Send audio to backend ──
  const sendAudioToBackend = useCallback(async (audioBlob: Blob) => {
    if (audioBlob.size < 500) {
      console.log("[Audio] Blob too small, ignoring");
      return;
    }

    const base64 = await blobToBase64(audioBlob);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "audio",
          data: base64,
          mimeType: audioBlob.type,
        })
      );
      setIsProcessing(true);
      setStatusText("Transcribing...");
    }
  }, []);

  // ── Start listening (always-on mic with VAD) ──
  const startListening = useCallback(async () => {
    if (isListeningRef.current || isMuted) return;

    try {
      cleanupMic();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up audio analysis for VAD (Voice Activity Detection)
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      // DO NOT connect to destination — prevents feedback and crashes
      analyserRef.current = analyser;

      // Set up MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      hasSpeechRef.current = false;
      speechStartRef.current = 0;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = [...audioChunksRef.current];
        audioChunksRef.current = [];

        if (chunks.length === 0 || !hasSpeechRef.current) {
          return;
        }

        const audioBlob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });

        console.log(`[Audio] Sending ${audioBlob.size} bytes`);
        await sendAudioToBackend(audioBlob);
      };

      recorder.start(200); // Collect data every 200ms

      // ── Voice Activity Detection loop ──
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate RMS volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 255;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);

        if (rms > SILENCE_THRESHOLD) {
          // Voice detected!
          if (!hasSpeechRef.current) {
            hasSpeechRef.current = true;
            speechStartRef.current = Date.now();
            console.log("[VAD] Speech started");
          }

          // Reset silence timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (hasSpeechRef.current) {
          // Silence after speech — start countdown
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              const speechDuration = Date.now() - speechStartRef.current;
              
              if (speechDuration >= MIN_SPEECH_DURATION_MS && hasSpeechRef.current) {
                console.log(`[VAD] Silence detected after ${speechDuration}ms of speech. Sending.`);
                
                // Stop recorder (triggers onstop which sends audio)
                if (mediaRecorderRef.current?.state === "recording") {
                  mediaRecorderRef.current.stop();
                }

                // Stop listening while processing
                if (vadIntervalRef.current) {
                  clearInterval(vadIntervalRef.current);
                  vadIntervalRef.current = null;
                }
                
                setIsListening(false);
                isListeningRef.current = false;
              }
              
              silenceTimerRef.current = null;
              hasSpeechRef.current = false;
            }, SILENCE_DURATION_MS);
          }
        }
      }, 80); // Check every 80ms

      setIsListening(true);
      isListeningRef.current = true;
      setStatusText("Listening...");
      console.log("[Audio] Listening started with VAD");
    } catch (err: any) {
      console.error("Mic error:", err);
      setStatusText(`Mic error: ${err.message || String(err)}`);
      cleanupMic();
    }
  }, [isMuted, cleanupMic, sendAudioToBackend]);

  // ── Connect WebSocket ──
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = window.fridayAPI?.backendUrl || WS_URL;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      setStatusText("Connected — Ready");
      console.log("[WS] Connected");
      // Auto-start listening on connect
      setTimeout(() => startListening(), 500);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "transcription":
          setMessages((prev) => [
            ...prev,
            { role: "user", text: msg.text, timestamp: Date.now() },
          ]);
          setStatusText("Thinking...");
          break;

        case "response":
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: msg.text, timestamp: Date.now() },
          ]);
          setIsProcessing(false);
          setStatusText("Speaking...");
          break;

        case "speaking":
          setIsSpeaking(msg.active);
          if (!msg.active) {
            setStatusText("Ready");
          }
          break;

        case "listening":
          // Backend says "I'm done, start listening again"
          setIsProcessing(false);
          setIsSpeaking(false);
          // Auto-restart listening
          setTimeout(() => startListening(), 300);
          break;

        case "status":
          setStatusText(msg.message);
          break;

        case "error":
          setIsProcessing(false);
          setStatusText(`Error: ${msg.message}`);
          setMessages((prev) => [
            ...prev,
            { role: "status", text: `⚠️ ${msg.message}`, timestamp: Date.now() },
          ]);
          // Resume listening after error
          setTimeout(() => startListening(), 1000);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatusText("Disconnected — Reconnecting...");
      cleanupMic();
      setTimeout(connectWS, 3000);
    };

    ws.onerror = () => {
      setStatusText("Backend starting up...");
    };

    wsRef.current = ws;
  }, [startListening, cleanupMic]);

  // Connect on mount
  useEffect(() => {
    const timer = setTimeout(connectWS, 2000);
    return () => {
      clearTimeout(timer);
      cleanupMic();
      wsRef.current?.close();
    };
  }, [connectWS, cleanupMic]);

  // ── Toggle mute ──
  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setTimeout(() => startListening(), 200);
    } else {
      setIsMuted(true);
      cleanupMic();
      setIsListening(false);
      setStatusText("Muted");
    }
  }, [isMuted, startListening, cleanupMic]);

  // ── Send text message ──
  const sendTextMessage = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setStatusText("Not connected");
      return;
    }

    // Pause listening while processing text
    cleanupMic();
    setIsListening(false);

    wsRef.current.send(JSON.stringify({ type: "text", data: text }));
    setTextInput("");
    setIsProcessing(true);
    setStatusText("Thinking...");
  }, [textInput, cleanupMic]);

  // ── Stop Friday ──
  const stopFriday = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

  // Determine orb state
  const orbActive = isListening || isSpeaking || isProcessing;

  // Status indicator color
  const getStatusColor = () => {
    if (isProcessing) return "#a78bfa"; // purple
    if (isSpeaking) return "#fbbf24";   // yellow
    if (isListening) return "#4ade80";  // green
    if (isMuted) return "#f87171";      // red
    return "rgba(255,255,255,0.4)";
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "#000",
        fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Connection indicator */}
      <div
        style={{
          position: "absolute",
          top: "1.5rem",
          right: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.75rem",
          color: isConnected ? "#4ade80" : "#f87171",
          opacity: 0.7,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: isConnected ? "#4ade80" : "#f87171",
            boxShadow: isConnected ? "0 0 8px #4ade80" : "0 0 8px #f87171",
          }}
        />
        {isConnected ? "Online" : "Connecting..."}
      </div>

      {/* Chat messages */}
      {messages.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "3rem",
            left: "2rem",
            right: "2rem",
            maxHeight: "25vh",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            scrollbarWidth: "none",
          }}
        >
          {messages.slice(-6).map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "70%",
                padding: "0.6rem 1rem",
                borderRadius:
                  msg.role === "user"
                    ? "1rem 1rem 0.25rem 1rem"
                    : "1rem 1rem 1rem 0.25rem",
                background:
                  msg.role === "user"
                    ? "rgba(255,255,255,0.08)"
                    : msg.role === "status"
                    ? "rgba(251,191,36,0.1)"
                    : "rgba(99,102,241,0.12)",
                color:
                  msg.role === "user"
                    ? "rgba(255,255,255,0.85)"
                    : msg.role === "status"
                    ? "#fbbf24"
                    : "rgba(165,180,252,0.95)",
                fontSize: "0.85rem",
                lineHeight: "1.4",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Orb */}
      <div style={{ width: "24rem", height: "24rem", position: "relative" }}>
        <VoicePoweredOrb
          enableVoiceControl={orbActive}
          className="rounded-xl overflow-hidden shadow-2xl"
        />
      </div>

      {/* Status text */}
      <p
        style={{
          marginTop: "1.5rem",
          color: getStatusColor(),
          fontSize: "0.85rem",
          textAlign: "center",
          minHeight: "1.5em",
          transition: "all 0.3s ease",
          fontWeight: isListening ? 500 : 400,
        }}
      >
        {isListening && !isProcessing && (
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#4ade80",
              marginRight: 6,
              animation: "pulse 1.5s infinite",
            }}
          />
        )}
        {statusText}
      </p>

      {/* Controls row */}
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        {/* Mute toggle button */}
        <button
          onClick={toggleMute}
          style={{
            padding: "0.7rem 1.5rem",
            borderRadius: "9999px",
            border: `1px solid ${
              isMuted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"
            }`,
            background: isMuted
              ? "rgba(239,68,68,0.15)"
              : "rgba(255,255,255,0.04)",
            color: isMuted ? "#f87171" : "rgba(255,255,255,0.7)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          {isMuted ? "Unmute" : "Mute"}
        </button>

        {/* Stop Friday button (visible when speaking/processing) */}
        {(isSpeaking || isProcessing) && (
          <button
            onClick={stopFriday}
            style={{
              padding: "0.7rem 1.5rem",
              borderRadius: "9999px",
              border: "1px solid rgba(251,191,36,0.3)",
              background: "rgba(251,191,36,0.12)",
              color: "#fbbf24",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            Stop Friday
          </button>
        )}
      </div>

      {/* Text input */}
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          maxWidth: "28rem",
        }}
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendTextMessage()}
          placeholder="Or type a command..."
          style={{
            flex: 1,
            padding: "0.65rem 1rem",
            borderRadius: "9999px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.8)",
            fontSize: "0.85rem",
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) =>
            (e.target.style.borderColor = "rgba(99,102,241,0.4)")
          }
          onBlur={(e) =>
            (e.target.style.borderColor = "rgba(255,255,255,0.08)")
          }
        />
        <button
          onClick={sendTextMessage}
          style={{
            width: "2.5rem",
            height: "2.5rem",
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.5)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          <Send size={16} />
        </button>
      </div>

      {/* Pulse animation CSS */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
