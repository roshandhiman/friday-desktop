import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

import { cn } from "@/lib/utils";

const levels = ["h-2", "h-3", "h-4", "h-5", "h-6", "h-7", "h-8", "h-9", "h-10"];

export default function VoicePoweredOrb({ className }: { className?: string }) {
  const [micOn, setMicOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(2);

  useEffect(() => {
    if (!micOn) {
      setIsSpeaking(false);
      return;
    }

    let speakingTimer = 0;
    let pauseTimer = 0;

    const schedule = () => {
      setIsSpeaking(true);
      speakingTimer = window.setTimeout(() => {
        setIsSpeaking(false);
        pauseTimer = window.setTimeout(schedule, 2200 + Math.random() * 2400);
      }, 1200 + Math.random() * 1800);
    };

    schedule();

    return () => {
      window.clearTimeout(speakingTimer);
      window.clearTimeout(pauseTimer);
    };
  }, [micOn]);

  useEffect(() => {
    if (!micOn) {
      setVoiceLevel(1);
      return;
    }

    const meter = window.setInterval(() => {
      if (isSpeaking) {
        setVoiceLevel(4 + Math.floor(Math.random() * 5));
      } else {
        setVoiceLevel(1 + Math.floor(Math.random() * 3));
      }
    }, 220);

    return () => window.clearInterval(meter);
  }, [micOn, isSpeaking]);

  const bars = useMemo(
    () =>
      Array.from({ length: levels.length }).map((_, index) => {
        const active = index <= voiceLevel;
        return (
          <span
            key={`meter-${index}`}
            className={cn(
              "orb-voice-bar w-1.5 rounded-full",
              levels[index],
              active ? "orb-voice-bar-active" : "bg-white/15",
            )}
          />
        );
      }),
    [voiceLevel],
  );

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative grid h-[400px] w-[400px] place-items-center">
        <div className="orb-ambient" />
        <div className="orb-ring orb-ring-1" />
        <div className="orb-ring orb-ring-2" />
        <div className="orb-ring orb-ring-3" />

        <motion.div
          className="orb-core"
          animate={
            micOn && isSpeaking
              ? {
                  scale: [1, 1.035, 1],
                  boxShadow: [
                    "0 0 22px rgba(255,255,255,0.2)",
                    "0 0 42px rgba(255,255,255,0.5)",
                    "0 0 22px rgba(255,255,255,0.2)",
                  ],
                }
              : {
                  scale: 1,
                  boxShadow: "0 0 24px rgba(255,255,255,0.18)",
                }
          }
          transition={{ duration: 1.3, repeat: micOn && isSpeaking ? Infinity : 0 }}
        >
          <div className="orb-core-inner" />
        </motion.div>
      </div>

      <div className="mt-4 flex h-10 items-end gap-1.5">{bars}</div>

      <button
        type="button"
        onClick={() => setMicOn((prev) => !prev)}
        className={cn(
          "mt-5 grid h-16 w-16 place-items-center rounded-full border border-white/20 bg-[#111111]/90 text-white transition",
          micOn ? "shadow-[0_0_32px_rgba(255,255,255,0.35),0_0_16px_rgba(0,217,255,0.25)]" : "opacity-70 shadow-[0_0_20px_rgba(0,0,0,0.4)]",
        )}
        aria-label={micOn ? "Turn mic off" : "Turn mic on"}
      >
        {micOn ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
      </button>

      {/* TODO: Connect AI speaking state from backend */}
    </div>
  );
}
