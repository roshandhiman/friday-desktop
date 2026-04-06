import { type ReactNode, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, HardDrive, MemoryStick } from "lucide-react";

import { cn } from "@/lib/utils";

type SystemStats = {
  cpu: number;
  ram: number;
  gpu: number;
};

function clamp(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function MeterRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  const normalized = clamp(value);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-cyan-300/80">
        <span className="flex items-center gap-2 text-cyan-200/90">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-cyan-100/90">{normalized}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-gradient-to-r from-cyan-950/40 to-blue-950/40 border border-cyan-500/20">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-blue-400 shadow-[0_0_20px_rgba(0,217,255,0.5),inset_0_0_10px_rgba(255,255,255,0.2)]"
          animate={{ width: `${normalized}%` }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function SystemMonitorCard({ className }: { className?: string }) {
  const [stats, setStats] = useState<SystemStats>({ cpu: 0, ram: 0, gpu: 0 });

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!window.systemAPI?.getStats) {
        return;
      }

      try {
        const result = await window.systemAPI.getStats();
        if (mounted) {
          setStats({
            cpu: clamp(result.cpu),
            ram: clamp(result.ram),
            gpu: clamp(result.gpu),
          });
        }
      } catch {
        // TODO: Handle telemetry API errors
      }
    };

    poll();
    const timer = window.setInterval(poll, 2500);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div
      className={cn(
        "rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/10 p-4 backdrop-blur-sm",
        className,
      )}
    >
      <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-cyan-300/90">
        System Monitor
      </h3>

      <div className="space-y-4">
        <MeterRow label="CPU" value={stats.cpu} icon={<Cpu className="h-3.5 w-3.5 text-cyan-400" />} />
        <MeterRow label="RAM" value={stats.ram} icon={<MemoryStick className="h-3.5 w-3.5 text-cyan-400" />} />
        <MeterRow label="GPU" value={stats.gpu} icon={<HardDrive className="h-3.5 w-3.5 text-cyan-400" />} />
      </div>

      {/* TODO: Attach backend persistence for historical system metrics */}
    </div>
  );
}
