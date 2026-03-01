import { useState } from "react";
import { BriefcaseBusiness, Globe2, Mail, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const [name, setName] = useState("Roshan");
  const [email, setEmail] = useState("roshan@assistant.local");
  const [role, setRole] = useState("Owner");
  const [timezone, setTimezone] = useState("Asia/Kolkata");

  return (
    <section className="panel-surface min-h-[780px] rounded-3xl border border-white/10 bg-[#0a0a0a]/92 p-6">
      <header className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-semibold text-white">Profile</h1>
        <p className="mt-1 text-sm text-white/55">Manage your identity and account preferences.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <div className="mx-auto mb-4 h-24 w-24 rounded-full border border-white/20 bg-black/35" />
          <p className="text-center text-sm text-white/65">Display Picture Space</p>

          <div className="mt-5 space-y-2 rounded-xl border border-white/10 bg-black/20 p-3 text-xs uppercase tracking-[0.18em] text-white/55">
            <p>Status: Active</p>
            <p>Auth: Protected</p>
            <p>Workspace: Primary</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
                <UserRound className="h-3.5 w-3.5" /> Name
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-white/30"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
                <Mail className="h-3.5 w-3.5" /> Email
              </span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-white/30"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Role
              </span>
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-white/30"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
                <Globe2 className="h-3.5 w-3.5" /> Timezone
              </span>
              <input
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none transition focus:border-white/30"
              />
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/60">
              <ShieldCheck className="h-3.5 w-3.5" /> Security
            </p>
            <p className="text-sm text-white/70">Last login verified. Two-factor authentication is enabled.</p>
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="glass" size="lg">
              Save Profile
            </Button>
          </div>
        </div>
      </div>

      {/* TODO: Connect user profile API */}
      {/* TODO: Connect profile image upload backend */}
    </section>
  );
}
