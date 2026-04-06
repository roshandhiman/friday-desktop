import { useState } from "react";
import { Bell, Lock, SlidersHorizontal, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 to-transparent px-4 py-3 hover:border-cyan-500/40 transition-all">
      <span className="text-sm font-medium text-cyan-100/90">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "flex h-7 w-14 items-center rounded-full border-2 p-1 transition-all duration-300",
          value 
            ? "justify-end border-cyan-400/60 bg-gradient-to-r from-cyan-600 to-cyan-500 shadow-[0_0_20px_rgba(0,217,255,0.3)]" 
            : "justify-start border-cyan-500/30 bg-gradient-to-r from-slate-600 to-slate-700",
        )}
        aria-label={`Toggle ${label}`}
      >
        <span className="h-5 w-5 rounded-full bg-white transition-all" />
      </button>
    </div>
  );
}

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [voiceOrb, setVoiceOrb] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [sensitivity, setSensitivity] = useState(64);

  return (
    <section className="panel-surface min-h-[780px] rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-cyan-950/10 to-slate-950/5 p-8">
      <header className="mb-8 border-b border-cyan-500/20 pb-6">
        <h1 className="bg-gradient-to-r from-white via-white to-cyan-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent">Settings</h1>
        <p className="mt-2 text-sm text-cyan-300/70">Personalize your AI assistant and control behavior</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/10 p-6 hover:border-cyan-500/40 transition-all">
          <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/90">
            <Bell className="h-4 w-4 text-cyan-400" /> Notifications
          </p>
          <div className="space-y-4">
            <ToggleRow
              label="Desktop Alerts"
              value={notifications}
              onChange={() => setNotifications((prev) => !prev)}
            />
            <ToggleRow
              label="Launch on Startup"
              value={autoLaunch}
              onChange={() => setAutoLaunch((prev) => !prev)}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/10 p-6 hover:border-cyan-500/40 transition-all">
          <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/90">
            <Waves className="h-4 w-4 text-cyan-400" /> Voice Assistant
          </p>
          <div className="space-y-4">
            <ToggleRow
              label="Enable Voice Orb"
              value={voiceOrb}
              onChange={() => setVoiceOrb((prev) => !prev)}
            />
            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 to-transparent px-4 py-4">
              <div className="mb-3 flex items-center justify-between text-sm text-cyan-100/90">
                <span className="font-medium">Sensitivity</span>
                <span className="font-bold text-cyan-300">{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/10 p-6 hover:border-cyan-500/40 transition-all">
          <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/90">
            <Lock className="h-4 w-4 text-cyan-400" /> Privacy
          </p>
          <div className="space-y-4">
            <ToggleRow
              label="Private Mode"
              value={privacyMode}
              onChange={() => setPrivacyMode((prev) => !prev)}
            />
            <p className="text-sm text-cyan-200/70">Restricts saved history and limits local telemetry.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/10 p-6 hover:border-cyan-500/40 transition-all">
          <p className="mb-4 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.3em] text-cyan-300/90">
            <SlidersHorizontal className="h-4 w-4 text-cyan-400" /> Runtime
          </p>
          <p className="text-sm text-cyan-200/70">Advanced runtime controls and model tuning area.</p>
          {/* TODO: Connect runtime model configuration backend */}
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          type="button"
          className="rounded-xl border-2 border-cyan-400/70 bg-gradient-to-r from-cyan-600/80 to-cyan-500/70 px-8 py-3 font-bold text-white transition-all hover:border-cyan-300 hover:from-cyan-600 hover:to-cyan-500 hover:shadow-[0_0_30px_rgba(0,217,255,0.4)]"
        >
          Save Settings
        </button>
      </div>

      {/* TODO: Connect settings persistence API */}
    </section>
  );
}
