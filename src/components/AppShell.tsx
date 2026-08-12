import { Link, Outlet, useRouter } from "@tanstack/react-router";
import {
  BarChart3,
  Landmark,
  Target,
  PiggyBank,
  Receipt,
  Sparkles,
  Wallet,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Översikt", short: "Översikt", icon: BarChart3 },
  { to: "/lan", label: "Lån", short: "Lån", icon: Landmark },
  { to: "/plan", label: "Plan", short: "Plan", icon: Target },
  { to: "/sparande", label: "Sparande", short: "Spar", icon: Wallet },
  { to: "/budget", label: "Budget", short: "Budget", icon: PiggyBank },
  { to: "/transaktioner", label: "Transaktioner", short: "Trans.", icon: Receipt },
  { to: "/coach", label: "Coach", short: "Coach", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 md:flex md:justify-between">
          <span className="truncate text-15 font-semibold tracking-tight">Skuldfri</span>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-[6px] px-3 py-1.5 text-13 text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground underline underline-offset-8" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={signOut}
            className="rounded-[6px] p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Logga ut"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:pb-12">{children ?? <Outlet />}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card md:hidden">
        <div className="grid grid-cols-7">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-col items-center gap-1 py-2 text-[0.65rem] text-muted-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              <n.icon className="size-4" />
              {n.short}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
