import { useMemo } from "react";
import { Lightbulb, Music, Clock, Focus, Youtube } from "lucide-react";

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

const quickActions = [
  { label: "YouTube", icon: Youtube, color: "from-red-600 to-red-700" },
  { label: "Music", icon: Music, color: "from-purple-600 to-purple-700" },
  { label: "Reminders", icon: Clock, color: "from-cyan-600 to-cyan-700" },
  { label: "Focus", icon: Focus, color: "from-blue-600 to-blue-700" },
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
    <div className="grid min-h-[780px] gap-5 xl:grid-cols-[1fr_380px]">
      {/* CENTER: Orb + Greeting + Quick Actions */}
      <section className="panel-surface relative flex min-h-[760px] flex-col overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/10 to-transparent p-8">
        <BGPattern
          variant="dots"
          mask="fade-center"
          fill="rgba(0,217,255,0.06)"
          size={26}
          className="opacity-30"
        />

        <div className="relative z-10 mb-8 text-center">
          <h1 className="bg-gradient-to-r from-white via-white to-cyan-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">{greeting}, Roshan</h1>
          <p className="mt-2 text-sm text-cyan-400/70">AI Assistant Ready</p>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center">
          <VoicePoweredOrb />
        </div>

        {/* Quick Action Buttons */}
        <div className="relative z-10 mt-8 grid grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                className={`group relative flex flex-col items-center justify-center rounded-2xl border border-cyan-500/30 bg-gradient-to-br ${action.color} p-4 transition-all duration-300 hover:border-cyan-400/60 hover:shadow-[0_0_30px_rgba(0,217,255,0.3)]`}
              >
                <Icon className="h-6 w-6 text-white transition-transform group-hover:scale-110" />
                <span className="mt-2 text-xs font-semibold text-white">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* TODO: Connect AI orchestration backend */}
        {/* TODO: Connect voice command execution API */}
      </section>

      {/* RIGHT: Chat + System Monitor */}
      <aside className="panel-surface flex min-h-[760px] flex-col gap-4 rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/5 to-transparent p-4">
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-transparent p-4 backdrop-blur-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.3em] text-cyan-300/90">Quick Commands</h2>
          <div className="space-y-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/30 to-transparent px-3 py-3 text-left text-sm font-medium text-white/85 transition-all hover:border-cyan-400/40 hover:bg-gradient-to-r hover:from-cyan-950/50 hover:to-transparent hover:text-cyan-200 hover:shadow-[0_0_20px_rgba(0,217,255,0.2)]"
              >
                <Lightbulb className="h-4 w-4 text-cyan-400/80" />
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="my-auto flex justify-center">
          <AIChatCard />
        </div>

        <SystemMonitorCard className="mt-auto" />
      </aside>
    </div>
  );
}
