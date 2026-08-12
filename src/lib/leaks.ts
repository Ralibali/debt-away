/**
 * Utgiftsläckor — ren TypeScript, ingen AI.
 *
 * All identifiering och alla belopp räknas fram här. Språkmodellen får bara
 * den färdiga kandidatlistan och gör klassificering, prioritering och
 * formulering — den räknar aldrig.
 */

import type { Budget, Category, Transaction } from "@/lib/data";

export type LeakKind = "recurring" | "over_budget" | "small_spend" | "share_shift";

export interface LeakCandidate {
  kind: LeakKind;
  /** Kort maskinell etikett, t.ex. "Spotify" eller "Mat & dryck" */
  label: string;
  /** Belopp per månad i kronor — alltid positivt, alltid uträknat i kod */
  monthly_amount: number;
  /** Faktaunderlag i klartext, skickas med till modellen */
  detail: string;
}

export interface LeakInput {
  monthly_income: number;
  monthly_expenses: number;
  candidates: LeakCandidate[];
}

const DAY = 86_400_000;

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Gemener, siffror och skiljetecken bort, mellanslag ihopdragna. */
export function normalizeDescription(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[0-9]+/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expenses(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.amount < 0);
}

/**
 * Återkommande poster: samma normaliserade beskrivning med 2+ träffar och
 * ett genomsnittligt intervall på 28–33 dagar.
 *
 * "Inte rörts på 60 dagar men dras fortfarande" tolkas mot den data vi har:
 * beloppet är oförändrat sedan minst 60 dagar tillbaka och dragningen pågår
 * fortfarande (senaste träffen inom de senaste 40 dagarna).
 */
export function recurringCandidates(
  transactions: Transaction[],
  today: Date = new Date(),
): LeakCandidate[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of expenses(transactions)) {
    const key = normalizeDescription(t.description);
    if (key.length < 3) continue;
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const out: LeakCandidate[] = [];
  for (const [key, list] of groups) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(toDate(sorted[i - 1]!.occurred_at), toDate(sorted[i]!.occurred_at)));
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap < 28 || avgGap > 33) continue;

    const amounts = sorted.map((t) => Math.abs(t.amount));
    const monthly = round(amounts.reduce((s, a) => s + a, 0) / amounts.length);
    const last = sorted[sorted.length - 1]!;
    const first = sorted[0]!;
    const sinceLast = daysBetween(toDate(last.occurred_at), today);
    const spanDays = daysBetween(toDate(first.occurred_at), toDate(last.occurred_at));
    const unchanged = new Set(amounts.map((a) => Math.round(a))).size === 1;
    const stale = unchanged && spanDays >= 60 && sinceLast <= 40;

    out.push({
      kind: "recurring",
      label: (last.description ?? key).trim(),
      monthly_amount: monthly,
      detail: stale
        ? `Dras varje månad (${sorted.length} gånger, snitt ${Math.round(avgGap)} dagar). Beloppet är oförändrat sedan ${spanDays} dagar och dragningen pågår fortfarande — en klassisk bortglömd prenumeration.`
        : `Dras varje månad (${sorted.length} gånger, snitt ${Math.round(avgGap)} dagar). Senast för ${sinceLast} dagar sedan.`,
    });
  }
  return out.sort((a, b) => b.monthly_amount - a.monthly_amount);
}

/** Kategorier som legat över budget tre månader i rad. */
export function overBudgetCandidates(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  today: Date = new Date(),
): LeakCandidate[] {
  const months: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }

  const spent = new Map<string, number>();
  for (const t of expenses(transactions)) {
    if (!t.category_id) continue;
    const key = `${t.category_id}|${monthKey(t.occurred_at)}`;
    spent.set(key, (spent.get(key) ?? 0) + Math.abs(t.amount));
  }
  const planned = new Map<string, number>();
  for (const b of budgets) planned.set(`${b.category_id}|${monthKey(b.month)}`, b.planned);

  const out: LeakCandidate[] = [];
  for (const c of categories) {
    if (c.kind !== "utgift") continue;
    const overs: number[] = [];
    for (const m of months) {
      const p = planned.get(`${c.id}|${m}`);
      const s = spent.get(`${c.id}|${m}`) ?? 0;
      if (p == null || p <= 0) break;
      if (s <= p) break;
      overs.push(s - p);
    }
    if (overs.length < 3) continue;
    const avgOver = round(overs.reduce((s, o) => s + o, 0) / overs.length);
    out.push({
      kind: "over_budget",
      label: c.name,
      monthly_amount: avgOver,
      detail: `Över budget tre månader i rad. Snittöverdrag ${Math.round(avgOver)} kr/mån.`,
    });
  }
  return out.sort((a, b) => b.monthly_amount - a.monthly_amount);
}

/** Småposter under 200 kr som tillsammans passerar 5 % av månadsutgifterna. */
export function smallSpendCandidate(
  transactions: Transaction[],
  month: string,
): LeakCandidate | null {
  const key = month.slice(0, 7);
  const inMonth = expenses(transactions).filter((t) => monthKey(t.occurred_at) === key);
  if (inMonth.length === 0) return null;
  const total = inMonth.reduce((s, t) => s + Math.abs(t.amount), 0);
  const small = inMonth.filter((t) => Math.abs(t.amount) < 200);
  const smallTotal = small.reduce((s, t) => s + Math.abs(t.amount), 0);
  if (total <= 0 || smallTotal <= total * 0.05) return null;
  return {
    kind: "small_spend",
    label: "Småköp under 200 kr",
    monthly_amount: round(smallTotal),
    detail: `${small.length} köp under 200 kr blir ${Math.round(smallTotal)} kr — ${Math.round(
      (smallTotal / total) * 100,
    )} % av månadens utgifter.`,
  };
}

/** Kategoriandel av inkomst jämfört med snittet för föregående tre månader. */
export function shareShiftCandidates(
  categories: Category[],
  transactions: Transaction[],
  month: string,
): LeakCandidate[] {
  const key = month.slice(0, 7);
  const d = toDate(month);
  const prevKeys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    prevKeys.push(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7),
    );
  }

  const incomeIn = (mk: string) =>
    transactions
      .filter((t) => t.amount > 0 && monthKey(t.occurred_at) === mk)
      .reduce((s, t) => s + t.amount, 0);

  const income = incomeIn(key);
  if (income <= 0) return [];

  const out: LeakCandidate[] = [];
  for (const c of categories) {
    if (c.kind !== "utgift") continue;
    const spentIn = (mk: string) =>
      expenses(transactions)
        .filter((t) => t.category_id === c.id && monthKey(t.occurred_at) === mk)
        .reduce((s, t) => s + Math.abs(t.amount), 0);

    const now = spentIn(key);
    if (now <= 0) continue;
    const shares: number[] = [];
    for (const mk of prevKeys) {
      const inc = incomeIn(mk);
      if (inc > 0) shares.push(spentIn(mk) / inc);
    }
    if (shares.length === 0) continue;
    const prevShare = shares.reduce((s, v) => s + v, 0) / shares.length;
    const nowShare = now / income;
    const deltaKr = round((nowShare - prevShare) * income);
    if (deltaKr <= 0 || nowShare - prevShare < 0.01) continue;
    out.push({
      kind: "share_shift",
      label: c.name,
      monthly_amount: deltaKr,
      detail: `Tar nu ${(nowShare * 100).toFixed(1)} % av inkomsten mot ${(prevShare * 100).toFixed(
        1,
      )} % de tre föregående månaderna — ${Math.round(deltaKr)} kr mer per månad.`,
    });
  }
  return out.sort((a, b) => b.monthly_amount - a.monthly_amount);
}

/** Allt underlag som skickas till modellen. Alla belopp är redan uträknade. */
export function buildLeakInput(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
  month: string,
  today: Date = new Date(),
): LeakInput {
  const key = month.slice(0, 7);
  const monthTx = transactions.filter((t) => monthKey(t.occurred_at) === key);
  const monthly_income = round(
    monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0),
  );
  const monthly_expenses = round(
    monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0),
  );

  const small = smallSpendCandidate(transactions, month);
  const candidates: LeakCandidate[] = [
    ...recurringCandidates(transactions, today),
    ...overBudgetCandidates(categories, budgets, transactions, today),
    ...(small ? [small] : []),
    ...shareShiftCandidates(categories, transactions, month),
  ];

  return { monthly_income, monthly_expenses, candidates };
}
