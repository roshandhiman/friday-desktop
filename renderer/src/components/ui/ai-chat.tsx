"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

import { cn } from "@/lib/utils";

export default function AIChatCard({ className }: { className?: string }) {
  const [messages, setMessages] = useState<{ sender: "ai" | "user"; text: string }[]>([
    { sender: "ai", text: "Hello. I’m your AI assistant." },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = () => {
    if (!input.trim()) {
      return;
    }

    setMessages([...messages, { sender: "user", text: input }]);
    setInput("");
    setIsTyping(true);

    // TODO: Connect chat to AI endpoint
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "ai", text: "Sample AI response." }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className={cn("relative h-[460px] w-[360px] overflow-hidden rounded-3xl p-[1px]", className)}>
      <motion.div
        className="absolute inset-0 rounded-3xl border border-cyan-400/30"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[calc(1.5rem-1px)] border border-cyan-500/20 bg-gradient-to-b from-cyan-950/30 to-slate-950/40 backdrop-blur-xl">
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(125deg,rgba(0,217,255,0.05),rgba(13,21,52,0.03),rgba(51,170,255,0.04))]"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "220% 220%" }}
        />

        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-cyan-400/20"
            animate={{
              y: ["0%", "-140%"],
              x: [Math.random() * 120 - 60, Math.random() * 120 - 60],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 5 + Math.random() * 2,
              repeat: Infinity,
              delay: i * 0.6,
              ease: "easeInOut",
            }}
            style={{ left: `${Math.random() * 100}%`, bottom: "-10%" }}
          />
        ))}

        <div className="relative z-10 border-b border-cyan-500/20 px-4 py-3 bg-gradient-to-r from-cyan-950/20 to-transparent">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-cyan-300/90">AI Chat</h2>
        </div>

        <div className="relative z-10 flex flex-1 flex-col space-y-3 overflow-y-auto px-4 py-3 text-sm">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 shadow-sm backdrop-blur-md",
                msg.sender === "ai"
                  ? "self-start border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-transparent text-cyan-100"
                  : "self-end border border-cyan-400/50 bg-gradient-to-l from-cyan-600/60 to-cyan-500/40 font-semibold text-white",
              )}
            >
              {msg.text}
            </motion.div>
          ))}

          {isTyping ? (
            <motion.div
              className="flex max-w-[30%] items-center gap-1 self-start rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-transparent px-3 py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 delay-200" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400 delay-400" />
            </motion.div>
          ) : null}
        </div>

        <div className="relative z-10 flex items-center gap-2 border-t border-cyan-500/20 p-3 bg-gradient-to-r from-cyan-950/10 to-transparent">
          <input
            className="flex-1 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 to-transparent px-3 py-2 text-sm text-white placeholder-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/60 transition-all"
            placeholder="Type a message..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            className="rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/60 to-cyan-500/40 p-2 transition-all hover:border-cyan-400/70 hover:from-cyan-600/80 hover:to-cyan-500/60 hover:shadow-[0_0_20px_rgba(0,217,255,0.3)]"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
