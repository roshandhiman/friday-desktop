import { useMemo } from "react";
import { Lightbulb } from "lucide-react";

import AIChatCard from "@/components/ui/ai-chat";
import { BGPattern } from "@/components/ui/bg-pattern";
import SystemMonitorCard from "@/components/ui/system-monitor";
import VoicePoweredOrb from "@/components/ui/voice-powered-orb";

const suggestions = [
  "Open where to go today",
  "Open calculator",
  "Show my emails",
  "What is on my calendar",
];

export default function DashboardPage() {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return "Good Morning";
    }
    if (hour < 18) {
      return "Good Afternoon";
    }
    return "Good Evening";
  }, []);

  return (
    <div className="grid min-h-[780px] gap-5 xl:grid-cols-[minmax(0,1fr)_372px]">
      <section className="panel-surface relative flex min-h-[760px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0a0a0a]/90 p-6">
        <BGPattern
          variant="dots"
          mask="fade-center"
          fill="rgba(255,255,255,0.08)"
          size={26}
          className="opacity-40"
        />

        <div className="relative z-10 mb-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">{greeting}, Roshan</h1>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center">
          <VoicePoweredOrb />
        </div>

        {/* TODO: Connect AI orchestration backend */}
        {/* TODO: Connect voice command execution API */}
      </section>

      <aside className="panel-surface flex min-h-[760px] flex-col rounded-3xl border border-white/10 bg-[#090909]/92 p-4">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/85">Today</h2>
          <div className="space-y-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#0f0f10]/85 px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10"
              >
                <Lightbulb className="h-4 w-4 text-white/70" />
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="my-4 flex justify-center">
          <AIChatCard />
        </div>

        <SystemMonitorCard className="mt-auto" />
      </aside>
    </div>
  );
}
