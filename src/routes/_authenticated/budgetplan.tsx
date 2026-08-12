import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useBudgets, useCategories, useLoans, useTransactions } from "@/lib/data";
import { summarize } from "@/lib/budget";
import { minimumPayment, monthlyFee } from "@/lib/payoff";
import { useCoach, useLatestInsight, type BudgetPlan, type Json } from "@/lib/coach";
import { kr, manad, monthStartISO } from "@/lib/format";
import { CoachPanel } from "@/components/CoachPanel";

export const Route = createFileRoute("/_authenticated/budgetplan")({
  head: () => ({
    meta: [
      { title: "Budget utan skam — Skuldfri" },
      {
        name: "description",
        content:
          "En budget som utgår från vad du faktiskt har kvar efter fasta kostnader och minimibetalningar.",
      },
      { property: "og:title", content: "Budget utan skam — Skuldfri" },
      {
        property: "og:description",
        content: "Realistiska ramar, veckoavstämning på tio minuter och färdiga repliker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShameFreeBudget,
});

function prevMonths(month: string, n: number): string[] {
  const d = new Date(`${month}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (i + 1), 1)).toISOString().slice(0, 7),
  );
}

function ShameFreeBudget() {
  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: monthTx = [] } = useTransactions(month, null);
  const { data: allTx = [] } = useTransactions(null, null);
  const { data: loans = [] } = useLoans();
  const [open, setOpen] = useState(false);

  const s = summarize(categories, budgets, monthTx);

  const minimums = useMemo(
    () =>
      loans
        .filter((l) => l.current_balance > 0.005)
        .reduce((sum, l) => sum + minimumPayment(l, l.current_balance) + monthlyFee(l), 0),
    [loans],
  );

  const fixed = useMemo(
    () =>
      s.lines
        .filter((l) => l.category.kind === "utgift" && l.category.is_fixed)
        .reduce((sum, l) => sum + (l.planned || l.actual), 0),
    [s.lines],
  );

  const income = s.plannedIncome || s.actualIncome;
  const disposable = Math.max(0, Math.round(income - fixed - minimums));
  const debtShare = income > 0 ? Math.round((minimums / income) * 100) : 0;

  const history = useMemo(() => {
    const keys = prevMonths(month, 3);
    return categories
      .filter((c) => c.kind === "utgift")
      .map((c) => ({
        kategori: c.name,
        fast: c.is_fixed,
        utfall: keys.map((k) => ({
          manad: k,
          belopp: Math.round(
            allTx
              .filter((t) => t.amount < 0 && t.category_id === c.id && t.occurred_at.slice(0, 7) === k)
              .reduce((sum, t) => sum + Math.abs(t.amount), 0),
          ),
        })),
      }))
      .filter((row) => row.utfall.some((u) => u.belopp > 0));
  }, [categories, allTx, month]);

  const input = useMemo(
    () => ({
      manad: month,
      inkomst: Math.round(income),
      fasta_kostnader: Math.round(fixed),
      minimibetalningar_lan: Math.round(minimums),
      skuldandel_av_inkomst_procent: debtShare,
      disponibelt: disposable,
      historik: history,
    }),
    [month, income, fixed, minimums, debtShare, disposable, history],
  );

  const cached = useLatestInsight<BudgetPlan>("budget");
  const coach = useCoach<BudgetPlan>("budget");
  const plan = coach.data ?? cached.data?.payload ?? null;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-base font-semibold tracking-tight">Budget utan skam</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {manad(month)} · ramarna utgår från din verklighet, inte från 50/30/20
        </p>
      </div>

      <div className="panel p-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="label-xs">Inkomst</div>
            <div className="num font-medium">{kr(income)}</div>
          </div>
          <div>
            <div className="label-xs">Fasta kostnader</div>
            <div className="num font-medium">{kr(fixed)}</div>
          </div>
          <div>
            <div className="label-xs">Minimibetalningar lån</div>
            <div className="num font-medium">{kr(minimums)}</div>
          </div>
          <div>
            <div className="label-xs">Skuldandel av inkomst</div>
            <div className="num font-medium">{debtShare} %</div>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-primary/10 p-2.5">
          <div className="label-xs">Disponibelt att fördela</div>
          <div className="num text-xl font-semibold text-primary">{kr(disposable)}</div>
        </div>
        {debtShare > 20 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Skulderna tar {debtShare} % av inkomsten. Då går det inte att lägga 20 % åt sidan — och
            det är inget personligt misslyckande, det är ett räknefel i mallen.
          </p>
        )}
      </div>

      <CoachPanel
        title="Förslag på ramar"
        subtitle="Coachen fördelar bara det disponibla beloppet ovan."
        hasResult={plan != null}
        pending={coach.isPending}
        error={coach.error}
        cachedAt={cached.data?.created_at ?? null}
        disabled={disposable <= 0}
        disabledReason="Det finns inget disponibelt belopp att fördela den här månaden."
        onRun={(force) => coach.mutate({ input: input as unknown as Json, force })}
      />

      {plan && (
        <>
          <div className="panel p-3">
            <p className="text-sm font-medium leading-snug">{plan.headline}</p>
            <div className="mt-2 rounded-md bg-accent/60 p-2.5">
              <div className="label-xs">Får spenderas utan motivering</div>
              <div className="num text-lg font-semibold">{kr(plan.guilt_free_amount)}/vecka</div>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <div className="label-xs px-3 pt-3">Ramar</div>
            <ul className="mt-2">
              {plan.buckets.map((b, i) => (
                <li key={i} className="border-b border-border/60 px-3 py-2 last:border-0">
                  <div className="flex justify-between gap-2">
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className="num text-sm">{kr(b.monthly_limit)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{b.rationale}</div>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-border px-3 py-2 text-xs">
              <span className="text-muted-foreground">Summa ramar</span>
              <span className="num font-medium">
                {kr(plan.buckets.reduce((sum, b) => sum + b.monthly_limit, 0))} av{" "}
                {kr(disposable)}
              </span>
            </div>
          </div>

          <div className="panel p-3">
            <div className="label-xs">Veckoavstämning, tio minuter</div>
            <ul className="mt-1.5 space-y-1">
              {plan.weekly_review.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  · {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel p-3">
            <button
              className="label-xs underline underline-offset-2"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Dölj repliker" : "Repliker för sociala situationer"}
            </button>
            {open && (
              <ul className="mt-2 space-y-2">
                {plan.scripts.map((sc, i) => (
                  <li key={i}>
                    <div className="text-xs font-medium">{sc.situation}</div>
                    <div className="mt-0.5 rounded-md bg-accent/60 p-2 text-xs italic">
                      ”{sc.text}”
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
