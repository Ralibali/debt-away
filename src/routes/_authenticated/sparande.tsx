import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  SAVINGS_KIND_LABELS,
  SCHABLON_KINDS,
  depositsInYear,
  needsReconciliation,
  useDeleteSavingsAccount,
  useSaveSavingsAccount,
  useSaveSnapshots,
  useSavingsAccounts,
  useSavingsSnapshots,
  valueOn,
  type SavingsKind,
} from "@/lib/savings";
import { ISK_LATEST_YEAR, iskTax, quarterDates } from "@/lib/isk";
import { capitalAdvice } from "@/lib/capital";
import { summarize } from "@/lib/budget";
import { useBudgets, useCategories, useLoans, useTransactions } from "@/lib/data";
import { kr, monthStartISO, procent, todayISO } from "@/lib/format";
import { FribeloppMeter } from "@/components/charts/FribeloppMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/sparande")({
  head: () => ({
    meta: [
      { title: "Sparande — Skuldfri" },
      {
        name: "description",
        content:
          "Manuell månadsavstämning av sparkonton, ISK-schablonskatt och var överskottet gör mest nytta.",
      },
      { property: "og:title", content: "Sparande — Skuldfri" },
      {
        property: "og:description",
        content: "Månadsavstämning, ISK-skatt och kopplingen mellan sparande och skuld.",
      },
    ],
  }),
  component: SavingsPage,
});

const KINDS = Object.keys(SAVINGS_KIND_LABELS) as SavingsKind[];

function SavingsPage() {
  const { data: accounts = [], isLoading } = useSavingsAccounts();
  const { data: snapshots = [] } = useSavingsSnapshots();
  const saveAccount = useSaveSavingsAccount();
  const deleteAccount = useDeleteSavingsAccount();
  const saveSnapshots = useSaveSnapshots();

  const { data: loans = [] } = useLoans();
  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const summary = summarize(categories, budgets, transactions);

  const [form, setForm] = useState({
    name: "",
    provider: "",
    kind: "isk" as SavingsKind,
    current_value: "",
    target_value: "",
    interest_rate: "",
    is_buffer: false,
  });

  const [draft, setDraft] = useState<Record<string, { value: string; deposits: string }>>({});
  const [snapshotDate, setSnapshotDate] = useState(monthStartISO());

  const dueForReconciliation = needsReconciliation(snapshots, accounts);

  const total = accounts.reduce((s, a) => s + a.current_value, 0);

  const isk = useMemo(() => {
    const year = new Date().getUTCFullYear();
    const schablonAccounts = accounts.filter((a) => SCHABLON_KINDS.includes(a.kind));
    const ids = schablonAccounts.map((a) => a.id);
    const today = todayISO();
    const quarterValues = quarterDates(year).map((d) => {
      if (d > today) return null;
      const values = schablonAccounts
        .map((a) => valueOn(snapshots, a.id, d))
        .filter((v): v is number => v != null);
      return values.length ? values.reduce((x, y) => x + y, 0) : null;
    });
    return iskTax(
      { quarterValues, depositsThisYear: depositsInYear(snapshots, ids, year) },
      year in { [ISK_LATEST_YEAR]: 1 } ? year : year,
    );
  }, [accounts, snapshots]);

  const advice = capitalAdvice({
    loans,
    savings: accounts,
    avgMonthlyExpenses: summary.actualExpense || summary.plannedExpense,
    monthlySurplus: summary.plannedSurplus,
  });

  async function submitReconciliation() {
    const rows = accounts
      .map((a) => {
        const d = draft[a.id];
        const raw = d?.value ?? String(a.current_value);
        const value = Number(String(raw).replace(",", "."));
        if (!Number.isFinite(value)) return null;
        return {
          account_id: a.id,
          snapshot_date: snapshotDate,
          value,
          deposits_since_last: Number(String(d?.deposits ?? "0").replace(",", ".")) || 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r != null);
    await saveSnapshots.mutateAsync(rows);
    setDraft({});
    toast.success("Avstämning sparad");
  }

  return (
    <div className="space-y-8">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
        <h1 className="truncate text-24">Sparande</h1>
        <span className="num shrink-0 text-18">{kr(total)}</span>
      </header>

      {dueForReconciliation && accounts.length > 0 && (
        <p className="panel p-4 text-15">
          Månadens avstämning är inte gjord. Fyll i saldona nedan — förra månadens värden
          ligger redan i fälten, det tar under en minut.
        </p>
      )}

      {isLoading ? (
        <p className="text-13 text-muted-foreground">Laddar…</p>
      ) : accounts.length === 0 ? (
        <div className="panel p-6">
          <p className="text-15">Inga sparkonton inlagda än.</p>
          <p className="mt-1 text-13 text-muted-foreground">
            Lägg till ditt första konto nedan så räknas buffert, schablonskatt och
            nettoförmögenhet fram. Ett värde per konto och månad räcker.
          </p>
        </div>
      ) : (
        <>
          <section className="panel overflow-hidden">
            <div className="p-4 pb-0">
              <div className="label-xs">Avstämning</div>
              <p className="mt-1 text-13 text-muted-foreground">
                Ett totalvärde per konto. Inga innehav, inga kurser.
              </p>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-15">
                <thead>
                  <tr className="border-y border-border text-left">
                    <th className="label-xs px-4 py-2 font-normal">Konto</th>
                    <th className="label-xs px-4 py-2 text-right font-normal">Värde</th>
                    <th className="label-xs px-4 py-2 text-right font-normal">Insatt</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div className="font-medium">{a.name}</div>
                        <div className="text-13 text-muted-foreground">
                          {SAVINGS_KIND_LABELS[a.kind]}
                          {a.provider ? ` · ${a.provider}` : ""}
                          {a.is_buffer ? " · buffert" : ""}
                          {a.interest_rate != null ? ` · ${procent(a.interest_rate)}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          className="num h-9 w-32 text-right"
                          inputMode="decimal"
                          aria-label={`Värde för ${a.name}`}
                          value={draft[a.id]?.value ?? String(a.current_value)}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [a.id]: {
                                value: e.target.value,
                                deposits: d[a.id]?.deposits ?? "0",
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          className="num h-9 w-24 text-right"
                          inputMode="decimal"
                          aria-label={`Insatt sedan förra avstämningen på ${a.name}`}
                          value={draft[a.id]?.deposits ?? "0"}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [a.id]: {
                                value: d[a.id]?.value ?? String(a.current_value),
                                deposits: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4">
              <Input
                type="date"
                className="h-9 w-40"
                aria-label="Avstämningsdatum"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
              />
              <Button onClick={submitReconciliation} disabled={saveSnapshots.isPending}>
                Spara avstämning
              </Button>
            </div>
          </section>

          <FribeloppMeter result={isk} />

          <section className="panel p-4">
            <div className="label-xs">Överskottet</div>
            <p className="mt-2 max-w-prose text-15">{advice.message}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 md:grid-cols-4">
              <div>
                <dt className="label-xs">Buffert</dt>
                <dd className="num mt-1 text-15">{kr(advice.bufferValue)}</dd>
                <dd className="text-13 text-muted-foreground">
                  mål {kr(advice.bufferTarget)}
                </dd>
              </div>
              <div>
                <dt className="label-xs">Dyraste skuld</dt>
                <dd className="num mt-1 text-15">{procent(advice.costliestDebtRate)}</dd>
                <dd className="truncate text-13 text-muted-foreground">
                  {advice.costliestDebtName ?? "ingen skuld"}
                </dd>
              </div>
              <div>
                <dt className="label-xs">Bästa sparränta</dt>
                <dd className="num mt-1 text-15">{procent(advice.bestSavingsRate)}</dd>
                <dd className="truncate text-13 text-muted-foreground">
                  {advice.bestSavingsName ?? "ingen ränta angiven"}
                </dd>
              </div>
              <div>
                <dt className="label-xs">Skillnad per år</dt>
                <dd className="num mt-1 text-15">{kr(advice.yearlyGainIfRedirected)}</dd>
                <dd className="text-13 text-muted-foreground">
                  på {kr(advice.surplusAboveBuffer)} per månad
                </dd>
              </div>
            </dl>
          </section>

          <section className="panel overflow-hidden">
            <div className="label-xs p-4 pb-0">Konton</div>
            <table className="mt-4 w-full text-15">
              <thead>
                <tr className="border-y border-border text-left">
                  <th className="label-xs px-4 py-2 font-normal">Konto</th>
                  <th className="label-xs px-4 py-2 text-right font-normal">Värde</th>
                  <th className="label-xs px-4 py-2 text-right font-normal">Mål</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-13 text-muted-foreground">
                        {SAVINGS_KIND_LABELS[a.kind]}
                        {a.provider ? ` · ${a.provider}` : ""}
                      </div>
                    </td>
                    <td className="num px-4 py-2 text-right">{kr(a.current_value)}</td>
                    <td className="num px-4 py-2 text-right text-muted-foreground">
                      {a.target_value != null ? kr(a.target_value) : "–"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="text-13 text-muted-foreground underline underline-offset-4"
                        onClick={() => deleteAccount.mutate(a.id)}
                      >
                        Ta bort
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <section className="panel space-y-4 p-4">
        <div className="label-xs">Nytt konto</div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            placeholder="Namn, t.ex. ISK långsiktigt"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Leverantör, t.ex. Avanza"
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
          />
          <select
            className="h-9 rounded-[6px] border border-input bg-card px-2 text-15"
            aria-label="Kontotyp"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as SavingsKind })}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {SAVINGS_KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <Input
            className="num"
            inputMode="decimal"
            placeholder="Nuvarande värde"
            value={form.current_value}
            onChange={(e) => setForm({ ...form, current_value: e.target.value })}
          />
          <Input
            className="num"
            inputMode="decimal"
            placeholder="Målbelopp (valfritt)"
            value={form.target_value}
            onChange={(e) => setForm({ ...form, target_value: e.target.value })}
          />
          <Input
            className="num"
            inputMode="decimal"
            placeholder="Ränta i procent (sparkonto)"
            value={form.interest_rate}
            onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-15 text-muted-foreground">
          <input
            type="checkbox"
            checked={form.is_buffer}
            onChange={(e) => setForm({ ...form, is_buffer: e.target.checked })}
          />
          Räknas som buffert
        </label>
        <Button
          onClick={async () => {
            if (!form.name.trim()) {
              toast.error("Kontot behöver ett namn");
              return;
            }
            await saveAccount.mutateAsync({
              name: form.name.trim(),
              provider: form.provider.trim() || null,
              kind: form.kind,
              current_value: Number(form.current_value.replace(",", ".")) || 0,
              target_value: form.target_value
                ? Number(form.target_value.replace(",", "."))
                : null,
              interest_rate: form.interest_rate
                ? Number(form.interest_rate.replace(",", "."))
                : null,
              is_buffer: form.is_buffer || form.kind === "buffert",
            });
            setForm({
              name: "",
              provider: "",
              kind: "isk",
              current_value: "",
              target_value: "",
              interest_rate: "",
              is_buffer: false,
            });
            toast.success("Konto tillagt");
          }}
        >
          Lägg till konto
        </Button>
      </section>
    </div>
  );
}
