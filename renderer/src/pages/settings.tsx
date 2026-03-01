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
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3">
      <span className="text-sm text-white/75">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          "flex h-7 w-14 items-center rounded-full border p-1 transition",
          value ? "justify-end border-white/35 bg-white/20" : "justify-start border-white/20 bg-black/45",
        )}
        aria-label={`Toggle ${label}`}
      >
        <span className="h-5 w-5 rounded-full bg-white" />
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
    <section className="panel-surface min-h-[780px] rounded-3xl border border-white/10 bg-[#0a0a0a]/92 p-6">
      <header className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-white/55">Tune assistant behavior and desktop controls.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <Bell className="h-3.5 w-3.5" /> Notifications
          </p>
          <div className="space-y-3">
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

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <Waves className="h-3.5 w-3.5" /> Voice Assistant
          </p>
          <div className="space-y-3">
            <ToggleRow
              label="Enable Voice Orb"
              value={voiceOrb}
              onChange={() => setVoiceOrb((prev) => !prev)}
            />
            <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-sm text-white/75">
                <span>Sensitivity</span>
                <span>{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={sensitivity}
                onChange={(event) => setSensitivity(Number(event.target.value))}
                className="w-full accent-white"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <Lock className="h-3.5 w-3.5" /> Privacy
          </p>
          <div className="space-y-3">
            <ToggleRow
              label="Private Mode"
              value={privacyMode}
              onChange={() => setPrivacyMode((prev) => !prev)}
            />
            <p className="text-sm text-white/60">Restricts saved history and limits local telemetry.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Runtime
          </p>
          <p className="text-sm text-white/65">Advanced runtime controls and model tuning area.</p>
          {/* TODO: Connect runtime model configuration backend */}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button variant="glass" size="lg">
          Save Settings
        </Button>
      </div>

      {/* TODO: Connect settings persistence API */}
    </section>
  );
}
