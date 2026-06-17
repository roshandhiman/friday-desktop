"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { VoicePoweredOrb } from "@/components/ui/voice-powered-orb";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send } from "lucide-react";

// Extend Window for our preload APIs
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

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState("Click mic to start");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioSamplesRef = useRef<number[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastToggleTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Connect WebSocket
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = window.fridayAPI?.backendUrl || WS_URL;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setIsConnected(true);
      setStatusText("Connected — Ready to listen");
      console.log("[WS] Connected");
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
          setStatusText("Speaking...");
          break;

        case "speaking":
          setIsSpeaking(msg.active);
          if (!msg.active) {
            setStatusText("Ready to listen");
          }
          break;

        case "status":
          setStatusText(msg.message);
          break;

        case "error":
          setStatusText(`Error: ${msg.message}`);
          setMessages((prev) => [
            ...prev,
            { role: "status", text: `⚠️ ${msg.message}`, timestamp: Date.now() },
          ]);
          break;
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      setStatusText("Disconnected — Reconnecting...");
      console.log("[WS] Disconnected");
      // Auto-reconnect after 3s
      setTimeout(connectWS, 3000);
    };

    ws.onerror = () => {
      setStatusText("Backend not ready — starting up...");
    };

    wsRef.current = ws;
  }, []);

  // Connect on mount
  useEffect(() => {
    // Wait a bit for Python backend to start
    const timer = setTimeout(connectWS, 2000);
    return () => {
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [connectWS]);

  // Start/Stop Recording
  const toggleRecording = useCallback(async () => {
    const now = Date.now();
    if (now - lastToggleTimeRef.current < 800) {
      console.log("[Audio] Toggle recording click debounced");
      return;
    }
    lastToggleTimeRef.current = now;

    if (isRecording) {
      // Stop recording
      setIsRecording(false);
      setStatusText("Processing audio...");

      try {
        if (scriptProcessorRef.current) {
          scriptProcessorRef.current.disconnect();
          scriptProcessorRef.current.onaudioprocess = null;
          scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
          mediaStreamSourceRef.current.disconnect();
          mediaStreamSourceRef.current = null;
        }
        if (audioContextRef.current) {
          await audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const samples = new Float32Array(audioSamplesRef.current);
        if (samples.length === 0) {
          setStatusText("No audio captured. Try again.");
          return;
        }

        console.log(`[Audio] Captured ${samples.length} samples.`);
        const wavBuffer = encodeWav(samples, 16000);
        const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });
        const base64 = await blobToBase64(wavBlob);

        // Send to backend
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({ type: "audio", data: base64 })
          );
          setStatusText("Transcribing...");
        } else {
          setStatusText("Not connected to backend");
          connectWS();
        }
      } catch (err: any) {
        console.error("Stop recording error:", err);
        setStatusText(`Error processing audio: ${err.message || err.name || String(err)}`);
      }
      return;
    }

    // Start recording
    try {
      setStatusText("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const mediaStreamSource = audioContext.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = mediaStreamSource;

      // 4096 buffer size, 1 input channel, 1 output channel
      const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = scriptProcessor;

      audioSamplesRef.current = [];

      scriptProcessor.onaudioprocess = (event) => {
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length; i++) {
          audioSamplesRef.current.push(inputData[i]);
        }
      };

      mediaStreamSource.connect(scriptProcessor);
      scriptProcessor.connect(audioContext.destination);

      setIsRecording(true);
      setStatusText("Listening... Click mic to stop");
    } catch (err: any) {
      console.error("Mic error:", err);
      setStatusText(`Microphone error: ${err.message || err.name || String(err)}`);
    }
  }, [isRecording, connectWS]);

  // Send text message
  const sendTextMessage = useCallback(() => {
    const text = textInput.trim();
    if (!text) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setStatusText("Not connected");
      return;
    }

    wsRef.current.send(JSON.stringify({ type: "text", data: text }));
    setTextInput("");
    setStatusText("Thinking...");
  }, [textInput]);

  // Stop Friday from speaking
  const stopSpeaking = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
    }
  }, []);

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
            boxShadow: isConnected
              ? "0 0 8px #4ade80"
              : "0 0 8px #f87171",
          }}
        />
        {isConnected ? "Online" : "Connecting..."}
      </div>

      {/* Chat messages (scrollable area above orb) */}
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
                borderRadius: msg.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
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
          enableVoiceControl={isRecording || isSpeaking}
          className="rounded-xl overflow-hidden shadow-2xl"
        />
      </div>

      {/* Status text */}
      <p
        style={{
          marginTop: "1.5rem",
          color: "rgba(255,255,255,0.4)",
          fontSize: "0.85rem",
          textAlign: "center",
          minHeight: "1.5em",
          transition: "all 0.3s ease",
        }}
      >
        {statusText}
      </p>

      {/* Controls */}
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        {/* Mic button */}
        <Button
          onClick={isSpeaking ? stopSpeaking : toggleRecording}
          variant={isRecording ? "destructive" : "secondary"}
          size="lg"
          className="px-8 py-3 border-none transition-all duration-300"
          style={{
            background: isRecording
              ? "rgba(239,68,68,0.2)"
              : isSpeaking
              ? "rgba(251,191,36,0.2)"
              : "rgba(255,255,255,0.06)",
            color: isRecording
              ? "#f87171"
              : isSpeaking
              ? "#fbbf24"
              : "rgba(255,255,255,0.7)",
            border: `1px solid ${
              isRecording
                ? "rgba(239,68,68,0.3)"
                : isSpeaking
                ? "rgba(251,191,36,0.3)"
                : "rgba(255,255,255,0.08)"
            }`,
            borderRadius: "9999px",
            cursor: "pointer",
          }}
        >
          {isRecording ? (
            <>
              <MicOff className="w-5 h-5 mr-3" />
              Stop
            </>
          ) : isSpeaking ? (
            <>
              <MicOff className="w-5 h-5 mr-3" />
              Stop Friday
            </>
          ) : (
            <>
              <Mic className="w-5 h-5 mr-3" />
              Speak
            </>
          )}
        </Button>
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
    </div>
  );
}

// ── Helper Functions ──────────────────────────────────────────────────────────


function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // PCM data
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}
