import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useBudgets, useCategories, useLoans, useSaveScenario, useScenarios, useDeleteScenario, useTransactions } from "@/lib/data";
import { summarize } from "@/lib/budget";
import { compare, effectiveRate } from "@/lib/payoff";
import { kr, manad, monthStartISO, procent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Avbetalningsplan — Skuldfri" },
      {
        name: "description",
        content: "Simulera extraamortering med avalanche eller snöboll och se när du blir skuldfri.",
      },
      { property: "og:title", content: "Avbetalningsplan — Skuldfri" },
      {
        property: "og:description",
        content: "Simulera extraamortering och se när du blir skuldfri.",
      },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { data: loans = [] } = useLoans();
  const [extra, setExtra] = useState(1000);
  const [strategy, setStrategy] = useState<"avalanche" | "snowball">("avalanche");
  const [scenarioName, setScenarioName] = useState("");

  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const surplus = summarize(categories, budgets, transactions).plannedSurplus;

  const { data: scenarios = [] } = useScenarios();
  const saveScenario = useSaveScenario();
  const delScenario = useDeleteScenario();

  const result = useMemo(() => compare(loans, extra, strategy), [loans, extra, strategy]);
  const { chosen, baseline, monthsSaved, interestSaved } = result;

  const chartData = useMemo(() => {
    const len = Math.max(chosen.schedule.length, baseline.schedule.length);
    return Array.from({ length: len }, (_, i) => ({
      month: i + 1,
      label: chosen.schedule[i]?.date ?? baseline.schedule[i]?.date ?? "",
      plan: chosen.schedule[i]?.totalBalance ?? 0,
      utan: baseline.schedule[i]?.totalBalance ?? 0,
    }));
  }, [chosen, baseline]);

  const headline = chosen.months
    ? `Skuldfri i ${manad(chosen.debtFreeDate)}${
        monthsSaved && monthsSaved > 0
          ? ` — ${monthsSaved} månader tidigare och ${kr(interestSaved)} billigare`
          : ""
      }`
    : "Skulden betalas aldrig av med nuvarande betalning";

  const byId = new Map(loans.map((l) => [l.id, l]));
  const ordered = [...chosen.perLoan].sort((a, b) => {
    if (a.payoffMonth == null) return 1;
    if (b.payoffMonth == null) return -1;
    return a.payoffMonth - b.payoffMonth;
  });

  if (loans.length === 0) {
    return (
      <div className="panel p-6 text-center text-sm text-muted-foreground">
        Lägg till lån först så räknar motorn ut din plan.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="panel p-3">
        <div className="label-xs">Avbetalningsplan</div>
        <h1 className="mt-1 text-lg font-semibold leading-snug tracking-tight">{headline}</h1>
        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="label-xs">Total ränta</div>
            <div className="num font-medium">{kr(chosen.totalInterest)}</div>
          </div>
          <div>
            <div className="label-xs">Utan extra</div>
            <div className="num font-medium">{kr(baseline.totalInterest)}</div>
          </div>
          <div>
            <div className="label-xs">Sparat</div>
            <div className="num font-medium text-primary">{kr(interestSaved)}</div>
          </div>
        </div>
      </div>

      <div className="panel space-y-3 p-3">
        <div>
          <div className="flex items-baseline justify-between">
            <span className="label-xs">Extra per månad</span>
            <span className="num text-sm font-semibold">{kr(extra)}</span>
          </div>
          <Slider
            className="mt-2"
            value={[extra]}
            min={0}
            max={20000}
            step={100}
            onValueChange={(v) => setExtra(v[0] ?? 0)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Input
              inputMode="numeric"
              className="h-8 w-28"
              value={extra}
              onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={surplus <= 0}
              onClick={() => setExtra(Math.round(surplus))}
            >
              Använd budgetöverskott ({kr(surplus)})
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["avalanche", "snowball"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                strategy === s
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              <div className="text-sm font-medium">
                {s === "avalanche" ? "Avalanche" : "Snöboll"}
              </div>
              {s === "avalanche" ? "Högst effektiv ränta först" : "Lägst saldo först"}
              <div className="num mt-1 text-foreground">
                {(s === "avalanche" ? result.avalanche : result.snowball).months ?? "–"} mån ·{" "}
                {kr((s === "avalanche" ? result.avalanche : result.snowball).totalInterest)} ränta
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <div className="label-xs mb-2">Total skuld över tid</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: -18, right: 6, top: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(m) => `Månad ${m}`}
                formatter={(v: number, name: string) => [kr(v), name === "plan" ? "Med plan" : "Utan extra"]}
              />
              <Area
                type="monotone"
                dataKey="utan"
                stroke="var(--muted-foreground)"
                fill="var(--muted)"
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="plan"
                stroke="var(--primary)"
                fill="var(--primary)"
                fillOpacity={0.18}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="label-xs px-3 pt-3">Ordningsföljd</div>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">#</th>
              <th className="px-3 py-1.5 font-medium">Lån</th>
              <th className="px-3 py-1.5 text-right font-medium">Eff. ränta</th>
              <th className="px-3 py-1.5 text-right font-medium">Klart</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((p, i) => {
              const loan = byId.get(p.loanId);
              return (
                <tr key={p.loanId} className="border-b border-border/60 last:border-0">
                  <td className="num px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.name}</div>
                    <div className="num text-[0.7rem] text-muted-foreground">
                      {kr(p.totalInterest)} ränta
                    </div>
                  </td>
                  <td className="num px-3 py-2 text-right">
                    {loan ? procent(effectiveRate(loan)) : "–"}
                  </td>
                  <td className="num px-3 py-2 text-right">
                    {p.neverPaidOff ? (
                      <span className="text-destructive">Betalas aldrig av</span>
                    ) : (
                      manad(p.payoffDate)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {chosen.neverPaidOff.length > 0 && (
          <p className="px-3 pb-3 pt-2 text-[0.7rem] text-destructive">
            Minimibetalningen täcker inte räntan på {chosen.neverPaidOff.length} lån — de blir
            aldrig avbetalda utan extraamortering.
          </p>
        )}
      </div>

      <div className="panel space-y-2 p-3">
        <div className="label-xs">Spara scenario</div>
        <div className="flex gap-2">
          <Input
            placeholder="Namn, t.ex. 'Extra 2000 avalanche'"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
          />
          <Button
            onClick={async () => {
              if (!scenarioName.trim()) {
                toast.error("Ange ett namn");
                return;
              }
              await saveScenario.mutateAsync({
                name: scenarioName.trim(),
                extra_per_month: extra,
                strategy,
              });
              setScenarioName("");
              toast.success("Scenario sparat");
            }}
          >
            Spara
          </Button>
        </div>
        {scenarios.length > 0 && (
          <ul className="divide-y divide-border/60 text-sm">
            {scenarios.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5">
                <button
                  className="text-left"
                  onClick={() => {
                    setExtra(Number(s.extra_per_month));
                    setStrategy(s.strategy as "avalanche" | "snowball");
                  }}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="num ml-2 text-xs text-muted-foreground">
                    {kr(Number(s.extra_per_month))}/mån ·{" "}
                    {s.strategy === "avalanche" ? "avalanche" : "snöboll"}
                  </span>
                </button>
                <button
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => delScenario.mutate(s.id)}
                >
                  Ta bort
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
