import { CheckCircle2, CreditCard, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Basic",
    price: "$19 / month",
    points: ["Core assistant", "Daily summaries", "Standard support"],
  },
  {
    name: "Pro",
    price: "$49 / month",
    points: ["Voice commands", "Workflow automations", "Priority support"],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    points: ["Team controls", "Private hosting", "Dedicated manager"],
  },
];

export default function SubscriptionPage() {
  return (
    <section className="panel-surface min-h-[780px] rounded-3xl border border-white/10 bg-[#0a0a0a]/92 p-6">
      <header className="mb-6 border-b border-white/10 pb-4">
        <h1 className="text-3xl font-semibold text-white">Subscription</h1>
        <p className="mt-1 text-sm text-white/55">Manage plan, billing, and usage allocation.</p>
      </header>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/55">
            <CreditCard className="h-3.5 w-3.5" /> Current Plan
          </p>
          <p className="text-2xl font-semibold text-white">Pro</p>
          <p className="mt-1 text-sm text-white/60">Renews on 99/99/9999</p>

          <div className="mt-4 space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>Voice Minutes</span>
                <span>68%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full w-[68%] rounded-full bg-white/70" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-white/60">
                <span>Automation Runs</span>
                <span>41%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div className="h-full w-[41%] rounded-full bg-white/70" />
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Button variant="glass" className="w-full">
              <Rocket className="mr-2 h-4 w-4" /> Upgrade Plan
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "rounded-2xl border border-white/10 bg-black/25 p-4",
                plan.featured ? "border-white/25 bg-white/5" : "",
              )}
            >
              <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
              <p className="mt-1 text-sm text-white/65">{plan.price}</p>

              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {plan.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-white/75" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>

      {/* TODO: Connect billing API */}
      {/* TODO: Connect plan change checkout backend */}
    </section>
  );
}
