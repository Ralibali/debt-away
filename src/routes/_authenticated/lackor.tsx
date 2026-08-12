import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useBudgets, useCategories, useTransactions } from "@/lib/data";
import { buildLeakInput } from "@/lib/leaks";
import { useCoach, useLatestInsight, type LeaksPayload, type Json } from "@/lib/coach";
import { kr, manad, monthStartISO } from "@/lib/format";
import { CoachPanel } from "@/components/CoachPanel";

export const Route = createFileRoute("/_authenticated/lackor")({
  head: () => ({
    meta: [
      { title: "Utgiftsläckor — Skuldfri" },
      {
        name: "description",
        content:
          "Automatisk detektering av prenumerationer, budgetöverdrag och småköp i din transaktionshistorik.",
      },
      { property: "og:title", content: "Utgiftsläckor — Skuldfri" },
      {
        property: "og:description",
        content: "Hitta pengarna som läcker varje månad och få en 30-dagarsplan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaksPage,
});

const DIFF_COLOR: Record<string, string> = {
  lätt: "text-primary",
  medel: "text-foreground",
  svår: "text-muted-foreground",
};

function LeaksPage() {
  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(null, null);
  const [openDetail, setOpenDetail] = useState(false);

  const input = useMemo(
    () => buildLeakInput(categories, budgets, transactions, month),
    [categories, budgets, transactions, month],
  );

  const cached = useLatestInsight<LeaksPayload>("leaks");
  const coach = useCoach<LeaksPayload>("leaks");
  const result = coach.data ?? cached.data?.payload ?? null;

  const detected = input.candidates.reduce((s, c) => s + c.monthly_amount, 0);
  const totalSaving = result?.leaks.reduce((s, l) => s + l.monthly_saving, 0) ?? 0;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-base font-semibold tracking-tight">Utgiftsläckor</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {manad(month)} · {input.candidates.length} kandidater hittade i {transactions.length}{" "}
          transaktioner
        </p>
      </div>

      <div className="panel p-3">
        <div className="label-xs">Möjligt att kapa per månad (uträknat i appen)</div>
        <div className="num text-xl font-semibold text-primary">{kr(detected)}</div>
        <button
          className="mt-1 text-xs text-muted-foreground underline underline-offset-2"
          onClick={() => setOpenDetail((v) => !v)}
        >
          {openDetail ? "Dölj underlaget" : "Visa underlaget"}
        </button>
        {openDetail && (
          <ul className="mt-2 space-y-1.5">
            {input.candidates.map((c, i) => (
              <li key={i} className="border-b border-border/60 pb-1.5 text-xs last:border-0">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="num">{kr(c.monthly_amount)}</span>
                </div>
                <div className="text-muted-foreground">{c.detail}</div>
              </li>
            ))}
            {input.candidates.length === 0 && (
              <li className="text-xs text-muted-foreground">
                Inga läckor hittade ännu. Lägg in fler{" "}
                <Link to="/transaktioner" className="text-primary">
                  transaktioner
                </Link>{" "}
                så blir mönstren synliga.
              </li>
            )}
          </ul>
        )}
      </div>

      <CoachPanel
        title="Prioritering och 30-dagarsplan"
        subtitle="Coachen sorterar kandidaterna efter hur ont det gör att kapa dem."
        hasResult={result != null}
        pending={coach.isPending}
        error={coach.error}
        cachedAt={cached.data?.created_at ?? null}
        disabled={input.candidates.length === 0}
        disabledReason="Behöver minst en kandidat för att kunna prioritera."
        onRun={(force) => coach.mutate({ input: input as unknown as Json, force })}
      />

      {result && (
        <>
          <div className="panel overflow-hidden">
            <div className="flex items-baseline justify-between px-3 pt-3">
              <span className="label-xs">Läckor</span>
              <span className="num text-sm font-semibold text-primary">
                {kr(totalSaving)}/mån
              </span>
            </div>
            <ul className="mt-2">
              {result.leaks.map((l, i) => (
                <li key={i} className="border-b border-border/60 px-3 py-2 last:border-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-sm font-medium">{l.label}</span>
                      <span className="ml-1.5 rounded bg-accent px-1 text-[0.65rem] text-muted-foreground">
                        {l.priority === 1 ? "gör först" : l.priority === 2 ? "sedan" : "sist"}
                      </span>
                    </div>
                    <span className="num text-sm">{kr(l.monthly_saving)}</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{l.action}</div>
                  <div className="mt-0.5 text-[0.7rem]">
                    <span className={DIFF_COLOR[l.difficulty] ?? ""}>{l.difficulty}</span>
                    <span className="text-muted-foreground"> · påverkan {l.life_impact}</span>
                  </div>
                </li>
              ))}
            </ul>
            {totalSaving > 0 && (
              <div className="border-t border-border px-3 py-2">
                <Link
                  to="/plan"
                  search={{ extra: Math.round(totalSaving) }}
                  className="text-xs font-medium text-primary"
                >
                  Lägg {kr(totalSaving)}/mån på avbetalningsplanen →
                </Link>
              </div>
            )}
          </div>

          <div className="panel p-3">
            <div className="label-xs">30 dagar, lättast först</div>
            <div className="mt-2 space-y-2">
              {result.plan.map((w) => (
                <div key={w.week}>
                  <div className="text-xs font-medium">Vecka {w.week}</div>
                  <ul className="mt-0.5 space-y-0.5">
                    {w.actions.map((a, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        · {a}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
