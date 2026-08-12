import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCategories, useUpdateTransaction } from "@/lib/data";
import {
  useCareSchedule,
  useSavePhaseBudget,
  useSaveWeeklyReview,
  useTransactionsInRange,
  useWeeklyReviews,
} from "@/lib/rhythm";
import {
  PHASE_LABELS,
  isHandoverDay,
  nextHandover,
  nextPhaseWindow,
  phaseWindow,
  previousSamePhase,
} from "@/lib/phase";
import { datum, kr, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/avstamning")({
  head: () => ({
    meta: [
      { title: "Veckoavstämning — Skuldfri" },
      {
        name: "description",
        content:
          "Tre frågor på överlämningsdagen: kategorisera osäkra poster, vad blev dyrare och vad kommer nästa fas.",
      },
      { property: "og:title", content: "Veckoavstämning — Skuldfri" },
      {
        property: "og:description",
        content: "Fem minuter, tre frågor, en gång per fas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Avstamning,
});

function Avstamning() {
  const today = todayISO();
  const { data: schedule } = useCareSchedule();
  const { data: categories = [] } = useCategories();
  const updateTx = useUpdateTransaction();
  const savePhaseBudget = useSavePhaseBudget();
  const saveReview = useSaveWeeklyReview();
  const { data: reviews = [] } = useWeeklyReviews();

  const window = phaseWindow(today, schedule);
  const previous = previousSamePhase(today, schedule);
  const next = nextPhaseWindow(today, schedule);
  const { data: nowTx = [] } = useTransactionsInRange(window.start, window.end);
  const { data: prevTx = [] } = useTransactionsInRange(previous.start, previous.end);

  const uncategorized = nowTx.filter((t) => !t.category_id);
  const expenseCats = categories.filter((c) => c.kind === "utgift");

  /** Kategorier som kostade mer den här fasen än samma fas förra gången. */
  const heavier = useMemo(() => {
    const sum = (rows: typeof nowTx) => {
      const m = new Map<string, number>();
      for (const t of rows) {
        if (!t.category_id || t.amount >= 0) continue;
        m.set(t.category_id, (m.get(t.category_id) ?? 0) + Math.abs(t.amount));
      }
      return m;
    };
    const a = sum(nowTx);
    const b = sum(prevTx);
    return [...a.entries()]
      .map(([id, now]) => ({ id, now: Math.round(now), before: Math.round(b.get(id) ?? 0) }))
      .filter((r) => r.now > r.before)
      .sort((x, y) => y.now - y.before - (x.now - x.before));
  }, [nowTx, prevTx]);

  const [picked, setPicked] = useState<string[]>([]);
  const [plans, setPlans] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const done = reviews.some((r) => r.phase_start === window.start);
  const name = (id: string) => categories.find((c) => c.id === id)?.name ?? "Okänd";

  function save() {
    const planned_next = Object.entries(plans)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([category_id, v]) => ({ category_id, amount: Number(v) }));
    saveReview.mutate({
      phase_start: window.start,
      phase: window.phase,
      overspent_category_ids: picked,
      planned_next,
    });
    for (const p of planned_next) {
      savePhaseBudget.mutate({ category_id: p.category_id, phase: next.phase, planned: p.amount });
    }
    setSaved(true);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-24">Veckoavstämning</h1>
        <p className="mt-1 text-13 text-muted-foreground">
          {PHASE_LABELS[window.phase]} {datum(window.start)} – {datum(window.end)}.{" "}
          {isHandoverDay(today, schedule)
            ? "Idag är överlämningsdag."
            : `Nästa överlämning ${datum(nextHandover(today, schedule))}.`}
        </p>
      </div>

      <section className="panel p-4">
        <div className="label-xs">1 · Osäkra poster</div>
        <p className="mt-1 text-13 text-muted-foreground">
          {uncategorized.length === 0
            ? "Allt den här fasen är kategoriserat."
            : `${uncategorized.length} poster saknar kategori.`}
        </p>
        <ul className="mt-4 space-y-2">
          {uncategorized.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-1 items-center gap-2 border-t border-border pt-2 sm:grid-cols-[minmax(0,1fr)_6rem_12rem]"
            >
              <span className="truncate text-15">{t.description || t.raw_description || "–"}</span>
              <span className="num text-13 text-muted-foreground">{kr(t.amount)}</span>
              <select
                defaultValue=""
                onChange={(e) =>
                  e.target.value && updateTx.mutate({ id: t.id, category_id: e.target.value })
                }
                className="rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
              >
                <option value="">Välj kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel p-4">
        <div className="label-xs">2 · Vad blev dyrare än förra {PHASE_LABELS[window.phase].toLowerCase()}n?</div>
        {heavier.length === 0 ? (
          <p className="mt-1 text-13 text-muted-foreground">
            Ingen kategori ligger över samma fas förra gången.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {heavier.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-4 border-t border-border pt-2">
                <label className="flex items-center gap-2 text-15">
                  <input
                    type="checkbox"
                    checked={picked.includes(h.id)}
                    onChange={(e) =>
                      setPicked((p) =>
                        e.target.checked ? [...p, h.id] : p.filter((x) => x !== h.id),
                      )
                    }
                  />
                  {name(h.id)}
                </label>
                <span className="num text-13 text-muted-foreground">
                  {kr(h.now)} mot {kr(h.before)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel p-4">
        <div className="label-xs">
          3 · Vad kommer nästa {PHASE_LABELS[next.phase].toLowerCase()}?
        </div>
        <p className="mt-1 text-13 text-muted-foreground">
          {datum(next.start)} – {datum(next.end)}. Beloppen blir fasbudget och dras från nästa
          fas siffra.
        </p>
        <ul className="mt-4 space-y-2">
          {expenseCats.map((c) => (
            <li key={c.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-2">
              <span className="truncate text-15">{c.name}</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={plans[c.id] ?? ""}
                onChange={(e) => setPlans({ ...plans, [c.id]: e.target.value })}
                className="num rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={save}
          className="rounded-[6px] bg-signal px-4 py-2 text-15 font-medium text-primary-foreground"
        >
          Spara avstämningen
        </button>
        {(saved || done) && (
          <span className="text-13 text-muted-foreground">
            Sparad för den här fasen. <Link to="/dashboard" className="underline underline-offset-4">Till översikten</Link>
          </span>
        )}
      </div>
    </div>
  );
}
