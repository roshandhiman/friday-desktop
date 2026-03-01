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
    <div className={cn("relative h-[460px] w-[360px] overflow-hidden rounded-2xl p-[1px]", className)}>
      <motion.div
        className="absolute inset-0 rounded-2xl border border-white/15"
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[15px] border border-white/10 bg-[#080808]/92 backdrop-blur-xl">
        <motion.div
          className="absolute inset-0 bg-[linear-gradient(125deg,#111111,#080808,#131313)]"
          animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          style={{ backgroundSize: "220% 220%" }}
        />

        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/10"
            animate={{
              y: ["0%", "-140%"],
              x: [Math.random() * 120 - 60, Math.random() * 120 - 60],
              opacity: [0, 1, 0],
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

        <div className="relative z-10 border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/80">AI Chat</h2>
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
                  ? "self-start bg-white/10 text-white"
                  : "self-end bg-white/30 font-semibold text-black",
              )}
            >
              {msg.text}
            </motion.div>
          ))}

          {isTyping ? (
            <motion.div
              className="flex max-w-[30%] items-center gap-1 self-start rounded-xl bg-white/10 px-3 py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-white delay-200" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-white delay-400" />
            </motion.div>
          ) : null}
        </div>

        <div className="relative z-10 flex items-center gap-2 border-t border-white/10 p-3">
          <input
            className="flex-1 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/40"
            placeholder="Type a message..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20"
            aria-label="Send message"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
