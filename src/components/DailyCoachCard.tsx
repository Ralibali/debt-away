import { useEffect, useMemo, useState } from "react";
import { Check, Flame, ShieldCheck, Sparkles } from "lucide-react";
import type { DailyNumber } from "@/lib/daily";
import { kr } from "@/lib/format";

const STORAGE_KEY = "skuldfri:daily-checkins";

const THOUGHTS = [
  "Du behöver inte vinna hela månaden idag. Bara nästa beslut.",
  "Varje krona du inte behöver låna är framtida frihet.",
  "En bra ekonomisk dag är inte en perfekt dag — den är medveten.",
  "Marginal byggs i små beslut långt innan den syns på kontot.",
  "Att vänta ett dygn är också ett ekonomiskt beslut.",
  "Pengar som får ett jobb innan de spenderas är svårare att tappa bort.",
  "Målet är inte att aldrig unna dig något. Målet är att du väljer när.",
] as const;

const MISSIONS = [
  "Vänta 24 timmar med ett köp som inte är planerat.",
  "Öppna appen innan dagens första spontanköp.",
  "Gör ett köp mindre automatiskt: fråga ‘vill jag fortfarande ha det i morgon?’",
  "Skydda dagens fria belopp — inget behöver maxas bara för att det finns.",
  "Om du avstår ett köp idag: låt pengarna få stanna kvar utan att ersättas av ett annat köp.",
] as const;

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function readCheckins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function streakFor(checkins: string[]) {
  const completed = new Set(checkins);
  let streak = 0;
  const cursor = new Date();
  if (!completed.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (completed.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function DailyCoachCard({ daily }: { daily: DailyNumber }) {
  const [checkins, setCheckins] = useState<string[]>([]);
  const today = localDateKey();

  useEffect(() => setCheckins(readCheckins()), []);

  const seed = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return y * 372 + m * 31 + d;
  }, [today]);

  const thought = THOUGHTS[seed % THOUGHTS.length];
  const mission = MISSIONS[seed % MISSIONS.length];
  const done = checkins.includes(today);
  const streak = streakFor(checkins);

  const coaching =
    daily.remaining <= 0
      ? "I dag är uppgiften enkel: undvik att göra månaden dyrare. Det räcker."
      : daily.perDay < 200
        ? `Du har ${kr(daily.perDay)} per dag i nuvarande fas. Skydda marginalen före impulsen.`
        : `Du har ${kr(daily.perDay)} per dag i nuvarande fas. Du får använda pengar — men medvetet.`;

  function completeToday() {
    if (done) return;
    const next = Array.from(new Set([...checkins, today])).sort().slice(-90);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setCheckins(next);
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-signal" />
            <div className="label-xs">Dagens ekonomiska coach</div>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 text-12 text-muted-foreground" title="Daglig check-in">
              <Flame className="size-3.5" />
              <span className="num">{streak}</span> dagar
            </div>
          )}
        </div>
        <p className="mt-3 max-w-2xl text-18 font-medium leading-snug">{thought}</p>
        <p className="mt-2 text-13 text-muted-foreground">{coaching}</p>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-13 font-medium">
            <ShieldCheck className="size-4 text-saving" />
            Dagens lilla uppdrag
          </div>
          <p className="mt-1 text-13 text-muted-foreground">{mission}</p>
        </div>
        <button
          type="button"
          onClick={completeToday}
          disabled={done}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] border border-border bg-card px-4 text-13 font-medium transition-colors hover:bg-accent disabled:cursor-default disabled:bg-accent disabled:text-muted-foreground"
        >
          <Check className="size-4" />
          {done ? "Klar för idag" : "Jag tar den idag"}
        </button>
      </div>
    </section>
  );
}
