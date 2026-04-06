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
    <div className="min-h-screen bg-[#060606] p-3 sm:p-4 lg:p-6">
      <div className="core-shell relative mx-auto min-h-[calc(100vh-1.5rem)] w-full max-w-[1600px] overflow-hidden rounded-[34px] border border-white/10 bg-[#0a0a0a]/95">
        <BGPattern
          variant="grid"
          mask="fade-edges"
          fill="rgba(255,255,255,0.06)"
          size={34}
          className="opacity-45"
        />

        <div className="relative z-10 flex min-h-[860px]">
          <aside
            className={cn(
              "sidebar-glass flex h-auto flex-col gap-5 border-r border-white/10 px-3 py-4 transition-all duration-300 ease-in-out",
              collapsed ? "w-[88px]" : "w-[260px]",
            )}
          >
            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "rounded-xl border border-white/10 bg-black/25",
                  collapsed ? "h-10 w-10" : "h-10 w-[120px]",
                )}
                aria-label="Reserved logo space"
              />
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/25 text-white/80 transition hover:bg-white/10"
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>

            <div className={cn("flex items-center gap-3 px-1", collapsed ? "justify-center" : "")}> 
              <div className="h-12 w-12 rounded-full border border-white/20 bg-black/35" />
              <div className={cn("transition-opacity", collapsed ? "hidden" : "block")}>
                <p className="text-sm font-semibold text-white">Roshan</p>
                <p className="text-xs text-white/45">0 chats</p>
              </div>
            </div>

            <p className={cn("px-1 text-xs uppercase tracking-[0.2em] text-white/40", collapsed ? "hidden" : "block")}>
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
                      "flex items-center rounded-xl px-3 py-3 text-sm transition-all duration-200",
                      collapsed ? "justify-center" : "gap-3",
                      active
                        ? "bg-white/14 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2),0_0_16px_rgba(0,217,255,0.2)]"
                        : "text-white/65 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className={cn(collapsed ? "hidden" : "block")}>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto px-1">
              <p className={cn("text-xs text-white/45", collapsed ? "hidden" : "block")}>
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
