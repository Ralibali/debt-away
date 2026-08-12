import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  useAccounts,
  useCategories,
  useDeleteTransaction,
  useSaveTransaction,
  useTransactions,
} from "@/lib/data";
import { kr, manad, monthStartISO, todayISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/transaktioner")({
  head: () => ({
    meta: [
      { title: "Transaktioner — Skuldfri" },
      { name: "description", content: "Registrera inkomster och utgifter och filtrera per månad." },
      { property: "og:title", content: "Transaktioner — Skuldfri" },
      {
        property: "og:description",
        content: "Registrera inkomster och utgifter och filtrera per månad.",
      },
    ],
  }),
  component: TransactionsPage,
});

function shiftMonth(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1))
    .toISOString()
    .slice(0, 10);
}

function TransactionsPage() {
  const [month, setMonth] = useState(monthStartISO());
  const [categoryFilter, setCategoryFilter] = useState("");
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions(month, categoryFilter || null);
  const save = useSaveTransaction();
  const del = useDeleteTransaction();

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [recurring, setRecurring] = useState(false);

  const catById = new Map(categories.map((c) => [c.id, c]));
  const sum = transactions.reduce((s, t) => s + t.amount, 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed === 0) {
      toast.error("Ange ett belopp (negativt = utgift)");
      return;
    }
    const cat = categoryId ? catById.get(categoryId) : undefined;
    const signed = cat ? (cat.kind === "utgift" ? -Math.abs(parsed) : Math.abs(parsed)) : parsed;
    await save.mutateAsync({
      occurred_at: date,
      amount: signed,
      description: description.trim() || null,
      category_id: categoryId || null,
      account_id: accountId || null,
      is_recurring: recurring,
    });
    setAmount("");
    setDescription("");
    toast.success("Transaktion sparad");
  }

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-base font-semibold tracking-tight">Transaktioner</h1>

      <form onSubmit={add} className="panel space-y-2 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input
            inputMode="decimal"
            placeholder="Belopp"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Kategori…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.kind})
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Konto…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          placeholder="Beskrivning"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
            />
            Återkommande
          </label>
          <Button type="submit" size="sm" disabled={save.isPending}>
            Lägg till
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="flex items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </Button>
          <span className="min-w-32 text-center capitalize">{manad(month)}</span>
          <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </Button>
        </div>
        <select
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">Alla kategorier</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="num ml-auto text-sm font-medium">{kr(sum)}</span>
      </div>

      <div className="panel divide-y divide-border/60">
        {transactions.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            Inga transaktioner den här månaden.
          </p>
        )}
        {transactions.map((t) => (
          <div key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate">
                  {t.description || catById.get(t.category_id ?? "")?.name || "Utan beskrivning"}
                </span>
                {t.source === "import" && (
                  <span className="label-xs shrink-0 rounded-[4px] border border-border px-1 py-px text-[0.6rem]">
                    import
                  </span>
                )}
                {t.is_locked && <Lock className="size-3 shrink-0 text-muted-foreground" />}
              </div>
              <div className="num text-[0.7rem] text-muted-foreground">
                {t.occurred_at}
                {t.category_id ? ` · ${catById.get(t.category_id)?.name ?? ""}` : ""}
                {t.is_recurring ? " · återkommande" : ""}
              </div>
            </div>
            <span
              className={`num font-medium ${t.amount < 0 ? "text-foreground" : "text-primary"}`}
            >
              {kr(t.amount)}
            </span>
            <button
              aria-label="Ta bort"
              disabled={t.is_locked}
              title={t.is_locked ? "Låst rad — lås upp först" : "Ta bort"}
              className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30"
              onClick={() => del.mutate(t.id)}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
