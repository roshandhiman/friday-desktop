import { useEffect, useMemo, useState } from "react";
import { Menu, Home, UserCircle2, Settings, CreditCard, Wrench } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { BGPattern } from "@/components/ui/bg-pattern";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "Profile", to: "/profile", icon: UserCircle2 },
  { label: "Settings", to: "/settings", icon: Settings },
  { label: "Subscription", to: "/subscription", icon: CreditCard },
  { label: "Tools", to: "/tools", icon: Wrench },
];

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (window.innerWidth < 1024) {
      setCollapsed(true);
    }
  }, [location.pathname]);

  const dayGreeting = useMemo(() => {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950 p-3 sm:p-4 lg:p-6">
      <div className="core-shell relative mx-auto min-h-[calc(100vh-1.5rem)] w-full max-w-[1600px] overflow-hidden rounded-[34px] border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-slate-950/30">
        <BGPattern
          variant="grid"
          mask="fade-edges"
          fill="rgba(0,217,255,0.04)"
          size={34}
          className="opacity-30"
        />

        <div className="relative z-10 flex min-h-[860px]">
          <aside
            className={cn(
              "sidebar-glass flex h-auto flex-col gap-6 border-r border-cyan-500/20 px-4 py-5 transition-all duration-300 ease-in-out",
              collapsed ? "w-[92px]" : "w-[280px]",
            )}
          >
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-transparent",
                  collapsed ? "h-10 w-10" : "h-10 w-[130px]",
                )}
                aria-label="Reserved logo space"
              />
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent text-cyan-300 transition hover:border-cyan-400/60 hover:bg-gradient-to-br hover:from-cyan-500/20 hover:text-cyan-200"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            <div className={cn("flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent px-3 py-3", collapsed ? "justify-center" : "")}>
              <div className="h-12 w-12 rounded-full border border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-transparent" />
              <div className={cn("transition-opacity", collapsed ? "hidden" : "block")}>
                <p className="text-sm font-bold text-white">Roshan</p>
                <p className="text-xs text-cyan-300/60">0 chats</p>
              </div>
            </div>

            <p className={cn("px-2 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400/70", collapsed ? "hidden" : "block")}>
              {dayGreeting}
            </p>

            <nav className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/dashboard"
                    ? location.pathname === "/" || location.pathname === "/dashboard"
                    : location.pathname.startsWith(item.to);

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "flex items-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-300",
                      collapsed ? "justify-center" : "gap-3",
                      active
                        ? "border border-cyan-400/50 bg-gradient-to-r from-cyan-500/20 to-transparent text-cyan-100 shadow-[0_0_25px_rgba(0,217,255,0.25)]"
                        : "border border-transparent text-cyan-200/70 hover:border-cyan-500/30 hover:bg-gradient-to-r hover:from-cyan-500/10 hover:to-transparent hover:text-cyan-100",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className={cn(collapsed ? "hidden" : "block")}>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto rounded-xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent px-3 py-3">
              <p className={cn("text-xs font-medium text-cyan-300/70", collapsed ? "hidden" : "block")}>
                Plan expires: 99/99/9999
              </p>
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
