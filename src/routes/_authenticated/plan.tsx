import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useBudgets, useCategories, useLoans, useTransactions, useParameters } from "@/lib/data";
import { ScenarioLibrary } from "@/components/ScenarioLibrary";
import { summarize } from "@/lib/budget";
import { compare, effectiveRate, monthlyChecklist } from "@/lib/payoff";
import { kr, manad, monthStartISO, procent } from "@/lib/format";
import { useCoach, useLatestInsight, type Json, type StrategyAdvice } from "@/lib/coach";
import { CoachPanel } from "@/components/CoachPanel";
import { StrategyComparison } from "@/components/charts/StrategyComparison";
import { DebtStaircase } from "@/components/charts/DebtStaircase";
import { InterestVsPrincipal } from "@/components/charts/InterestVsPrincipal";
import { PaymentSchedule } from "@/components/PaymentSchedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";


type Strategy3 = "avalanche" | "snowball" | "hybrid";

const STRATEGY_LABEL: Record<Strategy3, string> = {
  avalanche: "Lavin",
  snowball: "Snöboll",
  hybrid: "Hybrid",
};

const STRATEGY_HINT: Record<Strategy3, string> = {
  avalanche: "Högst effektiv ränta först",
  snowball: "Lägst saldo först",
  hybrid: "Stäng en liten rad, sedan lavin",
};

export const Route = createFileRoute("/_authenticated/plan")({
  validateSearch: (search: Record<string, unknown>): { extra?: number } => {
    const raw = Number(search["extra"]);
    return Number.isFinite(raw) && raw > 0 ? { extra: Math.round(raw) } : {};
  },
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
  const { extra: extraFromSearch } = Route.useSearch();
  const { data: loans = [] } = useLoans();
  const { data: params } = useParameters();
  const [extra, setExtra] = useState(extraFromSearch ?? 1000);
  const [strategy, setStrategy] = useState<Strategy3>("avalanche");

  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const surplus = summarize(categories, budgets, transactions).plannedSurplus;


  const result = useMemo(
    () => compare(loans, extra, strategy, new Date(), params),
    [loans, extra, strategy, params],
  );
  const checklist = useMemo(
    () => monthlyChecklist(loans, extra, strategy, params),
    [loans, extra, strategy],
  );
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

        <div className="grid grid-cols-3 gap-2">
          {(["avalanche", "snowball", "hybrid"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={`rounded-md border px-2.5 py-2 text-left text-[0.7rem] transition-colors ${
                strategy === s
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              <div className="text-sm font-medium">{STRATEGY_LABEL[s]}</div>
              {STRATEGY_HINT[s]}
              <div className="num mt-1 text-foreground">
                {result[s].months ?? "–"} mån · {kr(result[s].totalInterest)} ränta
              </div>
            </button>
          ))}
        </div>
      </div>

      <StrategyCoach
        result={result}
        strategy={strategy}
        extra={extra}
        onPick={(s) => setStrategy(s)}
      />

      <div className="panel overflow-hidden">
        <div className="label-xs px-3 pt-3">Att betala den här månaden</div>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Lån</th>
              <th className="px-3 py-1.5 text-right font-medium">Minimum</th>
              <th className="px-3 py-1.5 text-right font-medium">Extra</th>
              <th className="px-3 py-1.5 text-right font-medium">Totalt</th>
            </tr>
          </thead>
          <tbody>
            {checklist.map((row) => (
              <tr key={row.loanId} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">
                    {row.name}
                    {row.isTarget && (
                      <span className="ml-1.5 rounded bg-primary/15 px-1 text-[0.65rem] text-primary">
                        målet
                      </span>
                    )}
                  </div>
                  {row.payment_day != null && (
                    <div className="text-[0.7rem] text-muted-foreground">
                      Förfaller den {row.payment_day}:e
                    </div>
                  )}
                </td>
                <td className="num px-3 py-2 text-right">{kr(row.minimum)}</td>
                <td className="num px-3 py-2 text-right text-primary">
                  {row.extra > 0 ? kr(row.extra) : "–"}
                </td>
                <td className="num px-3 py-2 text-right font-medium">{kr(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <td className="px-3 py-2 text-xs text-muted-foreground">Summa denna månad</td>
              <td colSpan={3} className="num px-3 py-2 text-right font-semibold">
                {kr(checklist.reduce((s, r) => s + r.total, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="panel overflow-hidden">
        <div className="label-xs px-3 pt-3">Strategijämförelse vid {kr(extra)}/mån extra</div>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">Strategi</th>
                <th className="px-3 py-1.5 text-right font-medium">Skuldfri</th>
                <th className="px-3 py-1.5 text-right font-medium">Månader</th>
                <th className="px-3 py-1.5 text-right font-medium">Total ränta</th>
                <th className="px-3 py-1.5 text-right font-medium">Mot utan extra</th>
              </tr>
            </thead>
            <tbody>
              {(["avalanche", "snowball", "hybrid"] as const).map((s) => {
                const r = result[s];
                const diff = baseline.totalInterest - r.totalInterest;
                const monthsDiff =
                  baseline.months != null && r.months != null ? baseline.months - r.months : null;
                return (
                  <tr
                    key={s}
                    className={`border-b border-border/60 last:border-0 ${
                      strategy === s ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <button className="text-left" onClick={() => setStrategy(s)}>
                        <span className="font-medium">{STRATEGY_LABEL[s]}</span>
                        {strategy === s && (
                          <span className="ml-1.5 rounded bg-primary/15 px-1 text-[0.65rem] text-primary">
                            vald
                          </span>
                        )}
                        <div className="text-[0.7rem] text-muted-foreground">
                          {STRATEGY_HINT[s]}
                        </div>
                      </button>
                    </td>
                    <td className="num px-3 py-2 text-right">
                      {r.debtFreeDate ? manad(r.debtFreeDate) : "–"}
                    </td>
                    <td className="num px-3 py-2 text-right">{r.months ?? "–"}</td>
                    <td className="num px-3 py-2 text-right font-medium">{kr(r.totalInterest)}</td>
                    <td className="num px-3 py-2 text-right text-primary">
                      {diff > 0 ? `−${kr(diff)}` : "±0 kr"}
                      {monthsDiff != null && monthsDiff > 0 && (
                        <div className="text-[0.7rem] text-muted-foreground">
                          {monthsDiff} mån tidigare
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="font-medium">Utan extra</span>
                  <div className="text-[0.7rem] text-muted-foreground">Endast minimibetalningar</div>
                </td>
                <td className="num px-3 py-2 text-right">
                  {baseline.debtFreeDate ? manad(baseline.debtFreeDate) : "–"}
                </td>
                <td className="num px-3 py-2 text-right">{baseline.months ?? "–"}</td>
                <td className="num px-3 py-2 text-right font-medium">
                  {kr(baseline.totalInterest)}
                </td>
                <td className="num px-3 py-2 text-right text-muted-foreground">referens</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <StrategyComparison result={result} />


      <DebtStaircase result={chosen} />

      <InterestVsPrincipal result={chosen} />

      <PaymentSchedule result={chosen} loans={loans} />



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
                    {loan ? procent(effectiveRate(loan, params)) : "–"}
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

      <ScenarioLibrary
        loans={loans}
        params={params}
        extra={extra}
        strategy={strategy}
        onLoad={(e, s) => {
          setExtra(e);
          setStrategy(s);
        }}
      />

    </div>
  );
}

function StrategyCoach({
  result,
  strategy,
  extra,
  onPick,
}: {
  result: ReturnType<typeof compare>;
  strategy: Strategy3;
  extra: number;
  onPick: (s: Strategy3) => void;
}) {
  const cached = useLatestInsight<StrategyAdvice>("strategy");
  const coach = useCoach<StrategyAdvice>("strategy");
  const advice = coach.data ?? cached.data?.payload ?? null;

  const input = useMemo(
    () => ({
      extra_per_manad: kr(extra),
      vald_strategi: STRATEGY_LABEL[strategy],
      strategier: (["avalanche", "snowball", "hybrid"] as const).map((s) => ({
        nyckel: s,
        namn: STRATEGY_LABEL[s],
        manader: result[s].months,
        skuldfri: manad(result[s].debtFreeDate),
        total_ranta: kr(result[s].totalInterest),
        ordning: result[s].perLoan
          .filter((p) => !p.neverPaidOff)
          .sort((a, b) => (a.payoffMonth ?? 0) - (b.payoffMonth ?? 0))
          .map((p) => p.name),
      })),
    }),
    [result, strategy, extra],
  );

  return (
    <CoachPanel
      title="Vilken strategi passar dig?"
      subtitle="Siffrorna kommer från simuleringen ovan. Coachen jämför dem, räknar inte om dem."
      hasResult={advice != null}
      pending={coach.isPending}
      error={coach.error}
      cachedAt={cached.data?.created_at ?? null}
      onRun={(force) => coach.mutate({ input: input as unknown as Json, force })}
    >
      {advice && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">{advice.text}</p>
          {advice.recommended !== strategy && (
            <Button size="sm" variant="secondary" onClick={() => onPick(advice.recommended)}>
              Byt till {STRATEGY_LABEL[advice.recommended]}
            </Button>
          )}
        </div>
      )}
    </CoachPanel>
  );
}
