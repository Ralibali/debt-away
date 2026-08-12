import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Plus, Trash2 } from "lucide-react";
import { useCategories, useParameters } from "@/lib/data";
import {
  useCareSchedule,
  useDeleteIntention,
  useDeleteSinkingFund,
  useFulfillIntention,
  useIntentionEvents,
  useIntentions,
  useSaveCareSchedule,
  useSaveIntention,
  useSaveSinkingFund,
  useSinkingFunds,
  useTransactionsInRange,
} from "@/lib/rhythm";
import { PHASE_LABELS, nextHandover, phaseWindow, previousSamePhase } from "@/lib/phase";
import { fundProgress, totalMonthlyAccrual } from "@/lib/sinking";
import { TRIGGER_LABELS, statuses, type TriggerType } from "@/lib/intentions";
import { wins } from "@/lib/wins";
import { datum, kr, todayISO } from "@/lib/format";
import { useDaily } from "@/lib/useDaily";
import { DailyNumberPanel } from "@/components/DailyNumberPanel";

export const Route = createFileRoute("/_authenticated/rytm")({
  head: () => ({
    meta: [
      { title: "Rytm — Skuldfri" },
      {
        name: "description",
        content:
          "Tvåveckorsrytmen: barnvecka mot ensamvecka, buffertposter för oregelbundna kostnader och egna när-då-regler.",
      },
      { property: "og:title", content: "Rytm — Skuldfri" },
      {
        property: "og:description",
        content: "Fas mot fas, buffertposter och genomförandeintentioner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rytm,
});

const TRIGGERS: TriggerType[] = ["payday", "date", "phase_start", "transaction"];

function Rytm() {
  const today = todayISO();
  const { daily } = useDaily();
  const { data: schedule } = useCareSchedule();
  const { data: params } = useParameters();
  const { data: categories = [] } = useCategories();
  const saveSchedule = useSaveCareSchedule();
  const { data: funds = [] } = useSinkingFunds();
  const saveFund = useSaveSinkingFund();
  const deleteFund = useDeleteSinkingFund();
  const { data: intentions = [] } = useIntentions();
  const { data: events = [] } = useIntentionEvents();
  const saveIntention = useSaveIntention();
  const deleteIntention = useDeleteIntention();
  const fulfill = useFulfillIntention();

  const window = phaseWindow(today, schedule);
  const previous = previousSamePhase(today, schedule);
  const { data: nowTx = [] } = useTransactionsInRange(window.start, window.end);
  const { data: prevTx = [] } = useTransactionsInRange(previous.start, previous.end);

  const spend = (rows: { amount: number }[]) =>
    Math.round(rows.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0));
  const nowSpend = spend(nowTx);
  const prevSpend = spend(prevTx);

  const [form, setForm] = useState(schedule);
  const [fundForm, setFundForm] = useState({ name: "", annual_estimate: "", next_expected: "" });
  const [intForm, setIntForm] = useState({
    trigger_text: "",
    action_text: "",
    trigger_type: "payday" as TriggerType,
    day: "25",
  });

  const progress = useMemo(() => fundProgress(funds, today), [funds, today]);
  const list = statuses(intentions, events, today, schedule, params);
  const winList = wins({
    window,
    wishlist: [],
    intentionEvents: events,
    transactions: nowTx,
    extraPayments: [],
  });

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "–";

  return (
    <div className="space-y-8">
      <h1 className="text-24">Rytm</h1>

      <DailyNumberPanel daily={daily} />

      <section className="panel p-4">
        <div className="label-xs">Fasen just nu</div>
        <div className="mt-2 text-18">
          {PHASE_LABELS[window.phase]}, dag {window.dayIndex} av {window.length}
        </div>
        <p className="mt-1 text-13 text-muted-foreground">
          {datum(window.start)} – {datum(window.end)} · nästa överlämning{" "}
          {datum(nextHandover(today, schedule))}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-13">
          <div>
            <div className="label-xs">Utgifter denna fas</div>
            <div className="num mt-1 text-18">{kr(nowSpend)}</div>
          </div>
          <div>
            <div className="label-xs">Samma fas förra gången</div>
            <div className="num mt-1 text-18">{kr(prevSpend)}</div>
            <div className="mt-1 text-muted-foreground">
              {datum(previous.start)} – {datum(previous.end)}
            </div>
          </div>
        </div>
        <p className="mt-3 text-13 text-muted-foreground">
          Jämförelsen görs alltid fas mot fas — en barnvecka jämförs aldrig med en ensamvecka.
        </p>
      </section>

      {winList.length > 0 && (
        <section className="panel p-4">
          <div className="label-xs">Det här hände den här fasen</div>
          <ul className="mt-2 space-y-1 text-15">
            {winList.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel p-4">
        <div className="label-xs">Vårdnadsschema</div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="text-13">
            <span className="label-xs">Cykelns start</span>
            <input
              type="date"
              value={form.cycle_start}
              onChange={(e) => setForm({ ...form, cycle_start: e.target.value })}
              className="mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="text-13">
            <span className="label-xs">Cykel, dagar</span>
            <input
              type="number"
              value={form.cycle_days}
              onChange={(e) => setForm({ ...form, cycle_days: Number(e.target.value) })}
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="text-13">
            <span className="label-xs">Barn-dagar</span>
            <input
              type="number"
              value={form.child_days}
              onChange={(e) => setForm({ ...form, child_days: Number(e.target.value) })}
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="text-13">
            <span className="label-xs">Överlämning, veckodag</span>
            <select
              value={form.handover_weekday}
              onChange={(e) => setForm({ ...form, handover_weekday: Number(e.target.value) })}
              className="mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-1.5"
            >
              {["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"].map(
                (d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <button
          onClick={() => saveSchedule.mutate(form)}
          className="mt-4 rounded-[6px] bg-signal px-4 py-2 text-15 font-medium text-primary-foreground"
        >
          Spara schema
        </button>
      </section>

      <section className="panel p-4">
        <div className="label-xs">Buffertposter</div>
        <p className="mt-1 text-13 text-muted-foreground">
          Oregelbundna kostnader — kläder, jul, fritidsutrustning. Avsättningen dras redan från
          veckans siffra, {kr(totalMonthlyAccrual(funds))} per månad totalt.
        </p>
        <ul className="mt-4 space-y-3">
          {progress.map(({ fund: f, progress: pct }) => (
            <li key={f.id}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-15">{f.name}</span>
                <span className="num text-13 text-muted-foreground">
                  {kr(f.current_balance)} av {kr(f.annual_estimate)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full bg-background">
                <div className="h-full bg-saving" style={{ width: `${Math.min(100, pct * 100)}%` }} />
              </div>
              <div className="mt-1 flex items-center justify-between text-13 text-muted-foreground">
                <span>
                  {kr(f.monthly_accrual)} per månad
                  {f.next_expected ? ` · nästa utgift ${datum(f.next_expected)}` : ""}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      saveFund.mutate({
                        id: f.id,
                        current_balance: f.current_balance + f.monthly_accrual,
                      })
                    }
                    className="underline underline-offset-4"
                  >
                    Bokför månadens avsättning
                  </button>
                  <button onClick={() => deleteFund.mutate(f.id)} aria-label="Ta bort">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </li>

          ))}
        </ul>
        <div className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 sm:grid-cols-[minmax(0,1fr)_8rem_9rem_auto]">
          <input
            placeholder="Namn"
            value={fundForm.name}
            onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
            className="rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
          />
          <input
            type="number"
            placeholder="Per år"
            value={fundForm.annual_estimate}
            onChange={(e) => setFundForm({ ...fundForm, annual_estimate: e.target.value })}
            className="num rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
          />
          <input
            type="date"
            value={fundForm.next_expected}
            onChange={(e) => setFundForm({ ...fundForm, next_expected: e.target.value })}
            className="rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
          />
          <button
            onClick={() => {
              if (!fundForm.name.trim() || !fundForm.annual_estimate) return;
              saveFund.mutate({
                name: fundForm.name.trim(),
                annual_estimate: Number(fundForm.annual_estimate),
                current_balance: 0,
                next_expected: fundForm.next_expected || null,
              });
              setFundForm({ name: "", annual_estimate: "", next_expected: "" });
            }}
            className="flex items-center justify-center gap-1 rounded-[6px] border border-border px-3 py-1.5 text-13"
          >
            <Plus className="size-3.5" /> Lägg till
          </button>
        </div>
      </section>

      <section className="panel p-4">
        <div className="label-xs">När X, då Y</div>
        <p className="mt-1 text-13 text-muted-foreground">
          Egna regler. Appen bekräftar när något blev gjort och säger ingenting när det inte blev
          det.
        </p>
        <ul className="mt-4 space-y-3">
          {list.map((s) => (
            <li key={s.intention.id} className="border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-15">
                    När {s.intention.trigger_text}, då {s.intention.action_text}.
                  </div>
                  <div className="mt-1 text-13 text-muted-foreground">
                    {TRIGGER_LABELS[s.intention.trigger_type]}
                    {s.due ? ` · nästa avstämning ${datum(s.due)}` : ""} · gjort{" "}
                    {s.intention.fulfilled_count} gånger
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {s.due && !s.event?.fulfilled && (
                    <button
                      onClick={() => fulfill.mutate({ intention: s.intention, due_on: s.due! })}
                      className="flex items-center gap-1 rounded-[6px] border border-border px-2 py-1 text-13"
                    >
                      <Check className="size-3.5" /> Gjort
                    </button>
                  )}
                  {s.event?.fulfilled && (
                    <span className="text-13 text-saving">Gjort {datum(s.due)}</span>
                  )}
                  <button
                    onClick={() => deleteIntention.mutate(s.intention.id)}
                    aria-label="Ta bort"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              placeholder="lönen kommer"
              value={intForm.trigger_text}
              onChange={(e) => setIntForm({ ...intForm, trigger_text: e.target.value })}
              className="rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
            />
            <input
              placeholder="flyttar jag 1 500 kr till kortskulden"
              value={intForm.action_text}
              onChange={(e) => setIntForm({ ...intForm, action_text: e.target.value })}
              className="rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
            <select
              value={intForm.trigger_type}
              onChange={(e) =>
                setIntForm({ ...intForm, trigger_type: e.target.value as TriggerType })
              }
              className="rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
            >
              {TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
            {intForm.trigger_type === "date" && (
              <input
                type="number"
                min={1}
                max={28}
                value={intForm.day}
                onChange={(e) => setIntForm({ ...intForm, day: e.target.value })}
                className="num rounded-[6px] border border-border bg-background px-2 py-1.5 text-13"
              />
            )}
            <button
              onClick={() => {
                if (!intForm.trigger_text.trim() || !intForm.action_text.trim()) return;
                saveIntention.mutate({
                  trigger_text: intForm.trigger_text.trim(),
                  action_text: intForm.action_text.trim(),
                  trigger_type: intForm.trigger_type,
                  trigger_config:
                    intForm.trigger_type === "date" ? { day: Number(intForm.day) } : {},
                  active: true,
                });
                setIntForm({ ...intForm, trigger_text: "", action_text: "" });
              }}
              className="rounded-[6px] border border-border px-3 py-1.5 text-13"
            >
              Lägg till regel
            </button>
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <p className="text-13 text-muted-foreground">
          Fasbudgetarna sätts i veckoavstämningen, kategori för kategori (t.ex.{" "}
          {categoryName(categories[0]!.id)}).
        </p>
      )}
    </div>
  );
}
