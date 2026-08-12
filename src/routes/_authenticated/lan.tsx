import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { useLoans, useSaveLoan, useDeleteLoan, useParameters } from "@/lib/data";
import { effectiveRate, rateExplanation, minimumPayment, type Loan, type LoanKind } from "@/lib/payoff";
import { kr, procent, LOAN_KIND_LABELS } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/lan")({
  head: () => ({
    meta: [
      { title: "Lån — Skuldfri" },
      { name: "description", content: "Alla dina lån med nominell och effektiv ränta." },
      { property: "og:title", content: "Lån — Skuldfri" },
      { property: "og:description", content: "Alla dina lån med nominell och effektiv ränta." },
    ],
  }),
  component: LoansPage,
});

type FormState = {
  id?: string;
  name: string;
  kind: LoanKind;
  has_collateral: boolean;
  is_revolving: boolean;
  original_amount: string;
  current_balance: string;
  credit_limit: string;
  nominal_rate: string;
  min_payment: string;
  min_payment_pct: string;
  monthly_fee: string;
  payment_day: string;
  interest_daily: boolean;
  notes: string;
};

const EMPTY: FormState = {
  name: "",
  kind: "privatlan",
  has_collateral: false,
  is_revolving: false,
  original_amount: "",
  current_balance: "",
  credit_limit: "",
  nominal_rate: "",
  min_payment: "",
  min_payment_pct: "",
  monthly_fee: "0",
  payment_day: "27",
  interest_daily: false,
  notes: "",
};

function n(v: string): number | null {
  if (v.trim() === "") return null;
  const parsed = Number(v.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function LoanForm({ initial, onDone }: { initial: FormState; onDone: () => void }) {
  const [f, setF] = useState<FormState>(initial);
  const save = useSaveLoan();

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const balance = n(f.current_balance);
    const rate = n(f.nominal_rate);
    if (!f.name.trim() || balance == null || rate == null) {
      toast.error("Namn, saldo och ränta krävs.");
      return;
    }
    try {
      await save.mutateAsync({
        id: f.id,
        name: f.name.trim(),
        kind: f.kind,
        has_collateral: f.has_collateral,
        is_revolving: f.is_revolving,
        original_amount: n(f.original_amount),
        current_balance: balance,
        credit_limit: n(f.credit_limit),
        nominal_rate: rate,
        min_payment: n(f.min_payment),
        min_payment_pct: n(f.min_payment_pct),
        monthly_fee: n(f.monthly_fee) ?? 0,
        payment_day: n(f.payment_day),
        interest_daily: f.interest_daily,
        notes: f.notes.trim() || null,
      } as Partial<Loan> & { id?: string });
      toast.success(f.id ? "Lånet uppdaterat" : "Lånet sparat");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunde inte spara");
    }
  }

  const field = "space-y-1";

  return (
    <form onSubmit={submit} className="panel space-y-3 p-3">
      <div className={field}>
        <Label htmlFor="name">Namn</Label>
        <Input id="name" value={f.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className={field}>
          <Label htmlFor="kind">Typ</Label>
          <select
            id="kind"
            className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={f.kind}
            onChange={(e) => {
              const kind = e.target.value as LoanKind;
              setF((prev) => ({
                ...prev,
                kind,
                is_revolving: kind === "kreditkort" || kind === "kontokredit",
                interest_daily: kind === "csn",
                has_collateral: kind === "billan" ? prev.has_collateral : false,
              }));
            }}
          >
            {Object.entries(LOAN_KIND_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className={field}>
          <Label htmlFor="rate">Nominell ränta (%)</Label>
          <Input
            id="rate"
            inputMode="decimal"
            value={f.nominal_rate}
            onChange={(e) => set("nominal_rate", e.target.value)}
          />
        </div>
        <div className={field}>
          <Label htmlFor="balance">Aktuellt saldo</Label>
          <Input
            id="balance"
            inputMode="decimal"
            value={f.current_balance}
            onChange={(e) => set("current_balance", e.target.value)}
          />
        </div>
        <div className={field}>
          <Label htmlFor="orig">Ursprungsbelopp</Label>
          <Input
            id="orig"
            inputMode="decimal"
            value={f.original_amount}
            onChange={(e) => set("original_amount", e.target.value)}
          />
        </div>
        {f.is_revolving && (
          <>
            <div className={field}>
              <Label htmlFor="limit">Kreditgräns</Label>
              <Input
                id="limit"
                inputMode="decimal"
                value={f.credit_limit}
                onChange={(e) => set("credit_limit", e.target.value)}
              />
            </div>
            <div className={field}>
              <Label htmlFor="pct">Min. betalning (% av saldo)</Label>
              <Input
                id="pct"
                inputMode="decimal"
                value={f.min_payment_pct}
                onChange={(e) => set("min_payment_pct", e.target.value)}
              />
            </div>
          </>
        )}
        <div className={field}>
          <Label htmlFor="min">Min. betalning (kr/mån)</Label>
          <Input
            id="min"
            inputMode="decimal"
            value={f.min_payment}
            onChange={(e) => set("min_payment", e.target.value)}
          />
        </div>
        <div className={field}>
          <Label htmlFor="fee">Avgift (kr/mån)</Label>
          <Input
            id="fee"
            inputMode="decimal"
            value={f.monthly_fee}
            onChange={(e) => set("monthly_fee", e.target.value)}
          />
        </div>
        <div className={field}>
          <Label htmlFor="day">Förfallodag (1–28)</Label>
          <Input
            id="day"
            inputMode="numeric"
            value={f.payment_day}
            onChange={(e) => set("payment_day", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-muted/50 p-2.5">
        <div className="flex items-center justify-between text-sm">
          <span>Lån med säkerhet (pant)</span>
          <Switch
            checked={f.has_collateral}
            onCheckedChange={(v) => set("has_collateral", v)}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Revolverande kredit</span>
          <Switch checked={f.is_revolving} onCheckedChange={(v) => set("is_revolving", v)} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span>Dag-för-dag-ränta (CSN)</span>
          <Switch checked={f.interest_daily} onCheckedChange={(v) => set("interest_daily", v)} />
        </div>
      </div>

      <div className={field}>
        <Label htmlFor="notes">Anteckning</Label>
        <Input id="notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          Spara
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Avbryt
        </Button>
      </div>
    </form>
  );
}

function toForm(l: Loan): FormState {
  return {
    id: l.id,
    name: l.name,
    kind: l.kind,
    has_collateral: l.has_collateral,
    is_revolving: l.is_revolving,
    original_amount: l.original_amount?.toString() ?? "",
    current_balance: l.current_balance.toString(),
    credit_limit: l.credit_limit?.toString() ?? "",
    nominal_rate: l.nominal_rate.toString(),
    min_payment: l.min_payment?.toString() ?? "",
    min_payment_pct: l.min_payment_pct?.toString() ?? "",
    monthly_fee: (l.monthly_fee ?? 0).toString(),
    payment_day: l.payment_day?.toString() ?? "",
    interest_daily: l.interest_daily,
    notes: l.notes ?? "",
  };
}

function LoansPage() {
  const { data: loans = [], isLoading } = useLoans();
  const { data: params } = useParameters();
  const del = useDeleteLoan();
  const [editing, setEditing] = useState<FormState | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-semibold tracking-tight">Lån</h1>
        {!editing && (
          <Button size="sm" onClick={() => setEditing({ ...EMPTY })}>
            <Plus className="mr-1 size-4" /> Nytt lån
          </Button>
        )}
      </div>

      {editing && (
        <LoanForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
      )}

      {isLoading && <p className="px-1 text-sm text-muted-foreground">Laddar…</p>}

      <div className="space-y-2">
        {loans.map((l) => (
          <div key={l.id} className="panel p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.name}</div>
                <div className="text-[0.7rem] text-muted-foreground">
                  {LOAN_KIND_LABELS[l.kind]}
                  {l.is_revolving ? " · revolverande" : ""}
                  {l.has_collateral ? " · pant" : ""}
                  {l.interest_daily ? " · dagsränta" : ""}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditing(toForm(l))}>
                  Ändra
                </Button>
                <button
                  aria-label="Ta bort"
                  className="rounded-md p-2 text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Ta bort ${l.name}?`)) del.mutate(l.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="label-xs">Saldo</div>
                <div className="num font-medium">{kr(l.current_balance)}</div>
              </div>
              <div>
                <div className="label-xs">Nominell</div>
                <div className="num font-medium">{procent(l.nominal_rate)}</div>
              </div>
              <div>
                <div className="label-xs">Effektiv</div>
                <div className="num font-medium text-primary">{procent(effectiveRate(l, params))}</div>
              </div>
            </div>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
              {rateExplanation(l)} Minimibetalning nu:{" "}
              {kr(minimumPayment(l, l.current_balance) + (l.monthly_fee ?? 0))}/mån.
            </p>
          </div>
        ))}
      </div>

      <p className="px-1 text-[0.7rem] leading-relaxed text-muted-foreground">
        Ränteavdraget är avskaffat för lån utan säkerhet från inkomståret 2026. Studielån har
        aldrig varit avdragsgilla. För lån med säkerhet gäller 30 % avdrag (upp till 100 000 kr i
        räntekostnad per år, därefter 21 % — brytpunkten är inte inbyggd här).
      </p>
    </div>
  );
}
