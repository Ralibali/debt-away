import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { BarChart3, Landmark, Target, PiggyBank, Receipt, Sparkles, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", label: "Översikt", icon: BarChart3 },
  { to: "/lan", label: "Lån", icon: Landmark },
  { to: "/plan", label: "Plan", icon: Target },
  { to: "/budget", label: "Budget", icon: PiggyBank },
  { to: "/transaktioner", label: "Trans.", icon: Receipt },
  { to: "/coach", label: "Coach", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2.5">
          <span className="text-sm font-semibold tracking-tight">
            Skuldfri<span className="text-primary">.</span>
          </span>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                {n.label === "Trans." ? "Transaktioner" : n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={signOut}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Logga ut"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 pb-24 pt-3 md:pb-10">{children ?? <Outlet />}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-col items-center gap-0.5 py-2 text-[0.65rem] text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
