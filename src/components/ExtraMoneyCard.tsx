import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Banknote, Check, Plus, Trash2, Zap } from "lucide-react";
import { kr } from "@/lib/format";

const STORAGE_KEY = "skuldfri:extra-money-v1";
const SOURCES = ["Övertid", "Sålt något", "Återbetalning", "Annat"] as const;

type Source = (typeof SOURCES)[number];

type ExtraMoneyEntry = {
  id: string;
  amount: number;
  source: Source;
  date: string;
  allocated: boolean;
};

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

function readEntries(): ExtraMoneyEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ExtraMoneyEntry =>
        item &&
        typeof item.id === "string" &&
        typeof item.amount === "number" &&
        typeof item.source === "string" &&
        typeof item.date === "string" &&
        typeof item.allocated === "boolean",
    );
  } catch {
    return [];
  }
}

function persist(entries: ExtraMoneyEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-100)));
}

export function ExtraMoneyCard() {
  const [entries, setEntries] = useState<ExtraMoneyEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<Source>("Övertid");
  const [open, setOpen] = useState(false);

  useEffect(() => setEntries(readEntries()), []);

  const currentMonth = monthKey();
  const monthEntries = useMemo(
    () => entries.filter((entry) => entry.date.startsWith(currentMonth)).sort((a, b) => b.date.localeCompare(a.date)),
    [entries, currentMonth],
  );
  const monthTotal = monthEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const allocated = monthEntries.filter((entry) => entry.allocated).reduce((sum, entry) => sum + entry.amount, 0);
  const unallocated = monthTotal - allocated;

  function addEntry() {
    const value = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const entry: ExtraMoneyEntry = {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
      amount: Math.round(value),
      source,
      date: localDateKey(),
      allocated: false,
    };
    const next = [...entries, entry];
    persist(next);
    setEntries(next);
    setAmount("");
    setOpen(false);
  }

  function markAllocated(id: string) {
    const next = entries.map((entry) => (entry.id === id ? { ...entry, allocated: true } : entry));
    persist(next);
    setEntries(next);
  }

  function remove(id: string) {
    const next = entries.filter((entry) => entry.id !== id);
    persist(next);
    setEntries(next);
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-signal" />
            <div className="label-xs">Extra pengar får ett jobb</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex min-h-9 items-center gap-1 rounded-[6px] border border-border px-2.5 text-12 font-medium hover:bg-accent"
          >
            <Plus className="size-3.5" />
            Logga
          </button>
        </div>
        <p className="mt-2 text-13 text-muted-foreground">
          {monthTotal > 0
            ? `Du har skapat ${kr(monthTotal)} extra den här månaden. Bestäm vart de ska innan de hinner bli vardagspengar.`
            : "Övertid, något du säljer eller pengar tillbaka? Logga dem innan de smälter in i vardagskonsumtionen."}
        </p>
      </div>

      {open && (
        <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as Source)}
            className="h-11 rounded-[6px] border border-input bg-background px-3 text-13"
          >
            {SOURCES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && addEntry()}
            inputMode="decimal"
            placeholder="Belopp som faktiskt landade hos dig"
            className="num h-11 min-w-0 rounded-[6px] border border-input bg-background px-3 text-13 outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={addEntry}
            className="h-11 rounded-[6px] bg-signal px-4 text-13 font-medium text-primary-foreground"
          >
            Ge ett jobb
          </button>
        </div>
      )}

      {monthTotal > 0 && (
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="p-4">
            <div className="label-xs">Inte placerat än</div>
            <div className="num mt-1 text-18">{kr(unallocated)}</div>
          </div>
          <div className="p-4">
            <div className="label-xs">Markerat till skuld</div>
            <div className="num mt-1 text-18">{kr(allocated)}</div>
          </div>
        </div>
      )}

      {monthEntries.length > 0 && (
        <ul className="divide-y divide-border">
          {monthEntries.slice(0, 4).map((entry) => (
            <li key={entry.id} className="flex items-center gap-3 p-3">
              <Banknote className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-13 font-medium">{entry.source}</div>
                <div className="text-[0.7rem] text-muted-foreground">{entry.date}</div>
              </div>
              <div className="num text-13">{kr(entry.amount)}</div>
              {entry.allocated ? (
                <span className="inline-flex items-center gap-1 text-[0.7rem] text-saving">
                  <Check className="size-3.5" /> Till skuld
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => markAllocated(entry.id)}
                  className="rounded-[6px] border border-border px-2 py-1.5 text-[0.7rem] font-medium hover:bg-accent"
                >
                  Använt till skuld
                </button>
              )}
              <button type="button" onClick={() => remove(entry.id)} className="p-1 text-muted-foreground" aria-label="Ta bort">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 p-4 text-12 text-muted-foreground">
        <span>Planeringslogg på den här enheten — den flyttar inga pengar.</span>
        {unallocated > 0 && (
          <Link to="/lan" className="shrink-0 font-medium text-foreground underline underline-offset-4">
            Registrera betalning →
          </Link>
        )}
      </div>
    </section>
  );
}
