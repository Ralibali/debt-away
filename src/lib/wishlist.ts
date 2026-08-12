/** Impulsbroms — kylregler, humörstatistik och beslutsblad. Ingen AI. */

export type Mood = "stress" | "tristess" | "firande" | "belöning" | "behov";
export type Decision = "köpt" | "avstått" | "väntar";

export const MOODS: Mood[] = ["stress", "tristess", "firande", "belöning", "behov"];

export interface WishlistItem {
  id: string;
  item: string;
  price: number;
  url: string | null;
  added_at: string;
  cooldown_until: string;
  mood: string | null;
  decision: Decision;
  decided_at: string | null;
}

/** Kylperiod i dagar, satt av priset. Under 500 → 48 h, 500–2 000 → 7 d, över → 30 d. */
export function cooldownDays(price: number): number {
  if (price < 500) return 2;
  if (price <= 2000) return 7;
  return 30;
}

export function cooldownUntil(price: number, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + cooldownDays(price));
  return d.toISOString().slice(0, 10);
}

export function cooldownLabel(price: number): string {
  const d = cooldownDays(price);
  return d === 2 ? "48 timmar" : `${d} dagar`;
}

export function isCoolingDown(item: WishlistItem, today: Date = new Date()): boolean {
  return item.cooldown_until > today.toISOString().slice(0, 10);
}

export function daysLeft(item: WishlistItem, today: Date = new Date()): number {
  const end = new Date(`${item.cooldown_until}T00:00:00Z`).getTime();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

/** Förläng kylperioden med samma längd som ursprungsregeln. */
export function extendCooldown(item: WishlistItem, today: Date = new Date()): string {
  const base = new Date(`${item.cooldown_until}T00:00:00Z`);
  const from = base.getTime() > today.getTime() ? base : today;
  return cooldownUntil(item.price, from);
}

export interface MoodStat {
  mood: string;
  total: number;
  avstatt: number;
  kopt: number;
  /** Andel avstådda av avgjorda köp, 0–1 */
  restraintRate: number;
  savedAmount: number;
}

/**
 * Humörstatistik — visas först när loggen är minst 30 dagar gammal, eftersom
 * det är där mönstret börjar betyda något.
 */
export function moodStats(items: WishlistItem[]): MoodStat[] {
  const map = new Map<string, MoodStat>();
  for (const i of items) {
    const mood = i.mood ?? "okänt";
    const s = map.get(mood) ?? {
      mood,
      total: 0,
      avstatt: 0,
      kopt: 0,
      restraintRate: 0,
      savedAmount: 0,
    };
    s.total += 1;
    if (i.decision === "avstått") {
      s.avstatt += 1;
      s.savedAmount += i.price;
    }
    if (i.decision === "köpt") s.kopt += 1;
    map.set(mood, s);
  }
  return [...map.values()]
    .map((s) => ({
      ...s,
      restraintRate: s.avstatt + s.kopt > 0 ? s.avstatt / (s.avstatt + s.kopt) : 0,
    }))
    .sort((a, b) => b.restraintRate - a.restraintRate || b.total - a.total);
}

export function loggingDays(items: WishlistItem[], today: Date = new Date()): number {
  if (items.length === 0) return 0;
  const first = items
    .map((i) => new Date(i.added_at).getTime())
    .reduce((a, b) => Math.min(a, b), Infinity);
  return Math.floor((today.getTime() - first) / 86_400_000);
}

export function savedTotal(items: WishlistItem[]): number {
  return Math.round(items.filter((i) => i.decision === "avstått").reduce((s, i) => s + i.price, 0));
}

export const DECISION_QUESTIONS = [
  { key: "within30", text: "Behöver jag det inom 30 dagar?" },
  { key: "alternative", text: "Finns det något jag redan har som gör samma sak?" },
  { key: "hours", text: "Är det värt så många timmar av min lön?" },
  { key: "weekly", text: "Ryms det i veckobeloppet?" },
] as const;

export type DecisionKey = (typeof DECISION_QUESTIONS)[number]["key"];

/**
 * Beslutsblad: frågan "finns något som gör samma sak" är omvänd — ett ja där
 * är ett skäl att avstå. Tre eller fler nej → avstått.
 */
export function decisionVerdict(answers: Partial<Record<DecisionKey, boolean>>): {
  noCount: number;
  answered: number;
  verdict: "avstått" | "väntar" | null;
} {
  const normalized: boolean[] = [];
  for (const q of DECISION_QUESTIONS) {
    const a = answers[q.key];
    if (a == null) continue;
    normalized.push(q.key === "alternative" ? !a : a);
  }
  const noCount = normalized.filter((v) => !v).length;
  if (normalized.length < DECISION_QUESTIONS.length) {
    return { noCount, answered: normalized.length, verdict: null };
  }
  return { noCount, answered: normalized.length, verdict: noCount >= 3 ? "avstått" : "väntar" };
}

/** Vad kostar det i timmar av nettolönen? */
export function hoursOfWork(price: number, netHourlyWage: number): number | null {
  if (!netHourlyWage || netHourlyWage <= 0) return null;
  return Math.round((price / netHourlyWage) * 10) / 10;
}
