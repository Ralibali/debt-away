/**
 * Avbetalningsmotor — ren TypeScript, inga sidoeffekter, ingen fetch.
 * All beräkningslogik för lån och avbetalningsplaner bor här.
 */
import { DEFAULT_PARAMETERS, type UserParameters } from "@/lib/parameters";

export type LoanKind = "csn" | "billan" | "privatlan" | "kreditkort" | "kontokredit";

export interface Loan {
  id: string;
  name: string;
  kind: LoanKind;
  has_collateral: boolean;
  is_revolving: boolean;
  original_amount: number | null;
  current_balance: number;
  credit_limit: number | null;
  /** Nominell årsränta i procent, t.ex. 12.5 */
  nominal_rate: number;
  min_payment: number | null;
  /** Procent av saldo per månad (revolving) */
  min_payment_pct: number | null;
  monthly_fee: number | null;
  payment_day: number | null;
  interest_daily: boolean;
  notes?: string | null;
}

export interface PerLoanResult {
  loanId: string;
  name: string;
  /** Månadsindex (1-baserat) då lånet nådde 0, null om det aldrig betalas av */
  payoffMonth: number | null;
  payoffDate: string | null;
  totalInterest: number;
  neverPaidOff: boolean;
}

export interface ScheduleRow {
  /** 1-baserat månadsindex */
  month: number;
  /** ISO-datum (YYYY-MM-01) */
  date: string;
  /** Saldo per lån-id vid månadens slut */
  balances: Record<string, number>;
  totalBalance: number;
  interestPaid: number;
  principalPaid: number;
  paid: number;
}

export type Strategy = "avalanche" | "snowball" | "hybrid" | "baseline";

export interface PayoffResult {
  strategy: Strategy;
  extraPerMonth: number;
  /** Antal månader tills skuldfri, null om det inte går inom 600 månader */
  months: number | null;
  debtFreeDate: string | null;
  totalInterest: number;
  totalPaid: number;
  perLoan: PerLoanResult[];
  schedule: ScheduleRow[];
  /** Lån som aldrig blir avbetalda med nuvarande betalning */
  neverPaidOff: string[];
  /** Betalningsordning (lån-id) i den ordning de blev avbetalda */
  order: string[];
}

export const MAX_MONTHS = 600;
/** Golv för minimibetalning på revolving-lån */
export const REVOLVING_MIN_FLOOR = 150;

/**
 * Effektiv ränta efter skatt.
 *
 * Avdragsnivåerna kommer från användarens parametrar. Standard 2026:
 * 30 % för lån MED säkerhet, 0 % för lån utan säkerhet (avdraget avskaffat).
 * Studielån (CSN) har aldrig varit avdragsgilla.
 *
 * OBS: Avdraget är 30 % upp till 100 000 kr i räntekostnad per år, därefter
 * 21 %. Den brytpunkten är medvetet INTE inbyggd — den är irrelevant vid
 * dessa lånestorlekar, men dokumenteras här.
 */
export function effectiveRate(loan: Loan, p: UserParameters = DEFAULT_PARAMETERS): number {
  // CSN: aldrig avdragsgill
  if (loan.kind === "csn") return loan.nominal_rate;
  const deduction = loan.has_collateral ? p.ranteavdrag_sakerhet : p.ranteavdrag_utan_sakerhet;
  return loan.nominal_rate * (1 - deduction);
}

export function rateExplanation(loan: Loan, p: UserParameters = DEFAULT_PARAMETERS): string {
  if (loan.kind === "csn")
    return "Studielån är inte avdragsgilla — effektiv ränta = nominell ränta.";
  const pct = (loan.has_collateral ? p.ranteavdrag_sakerhet : p.ranteavdrag_utan_sakerhet) * 100;
  const label = loan.has_collateral ? "Lån med säkerhet (pant)" : "Lån utan säkerhet";
  if (pct <= 0)
    return `${label}: inget ränteavdrag (avskaffat från 2026) — effektiv ränta = nominell ränta.`;
  return `${label} ger ${pct.toFixed(0).replace(".", ",")} % ränteavdrag — effektiv ränta = nominell × ${(
    1 - pct / 100
  )
    .toFixed(2)
    .replace(".", ",")}.`;
}

/** Minimibetalning exkl. avgift för ett givet saldo. */
export function minimumPayment(loan: Loan, balance: number): number {
  if (balance <= 0) return 0;
  let base = 0;
  if (loan.is_revolving && loan.min_payment_pct != null && loan.min_payment_pct > 0) {
    base = Math.max((balance * loan.min_payment_pct) / 100, REVOLVING_MIN_FLOOR);
  } else if (loan.min_payment != null) {
    base = loan.min_payment;
  }
  return Math.min(base, balance + monthlyInterest(loan, balance));
}

export function monthlyFee(loan: Loan): number {
  return loan.monthly_fee ?? 0;
}

/** Ränta för en månad på ett givet ingående saldo. */
export function monthlyInterest(loan: Loan, balance: number): number {
  if (balance <= 0) return 0;
  const r = loan.nominal_rate / 100;
  if (loan.interest_daily) {
    // Dag-för-dag-ränta (CSN). 365 dagar/år, ~30,4 dagar/månad.
    return balance * (Math.pow(1 + r / 365, 365 / 12) - 1);
  }
  return (balance * r) / 12;
}

/** Aktuell räntekostnad per månad för hela låneportföljen. */
export function currentMonthlyInterest(loans: Loan[]): number {
  return loans.reduce((sum, l) => sum + monthlyInterest(l, l.current_balance), 0);
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + months, 1));
  return d;
}

function isoMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Hur många månader tills lånet är slutbetalt om hela extrabeloppet läggs här. */
function monthsToClear(
  entry: { loan: Loan; balance: number },
  availableExtra: number,
  limit = 4,
): number {
  let balance = entry.balance;
  for (let m = 1; m <= limit; m++) {
    const interest = monthlyInterest(entry.loan, balance);
    const payment = minimumPayment(entry.loan, balance) + availableExtra;
    const next = Math.max(0, balance + interest - payment);
    if (next <= 0.005) return m;
    if (next >= balance - 0.005) return Infinity;
    balance = next;
  }
  return Infinity;
}

function pickTarget(
  active: { loan: Loan; balance: number }[],
  strategy: Strategy,
  availableExtra: number,
  p: UserParameters = DEFAULT_PARAMETERS,
): string | null {
  if (active.length === 0) return null;
  if (strategy === "baseline") return null;

  if (strategy === "hybrid") {
    // Ta minsta saldot först om det kan slutbetalas inom 3 månader med
    // tillgängligt extrabelopp — en tidig avklarad rad utan nämnvärd
    // räntekostnad. Därefter ren lavin.
    const smallest = [...active].sort((a, b) => a.balance - b.balance)[0]!;
    if (monthsToClear(smallest, availableExtra) <= 3) return smallest.loan.id;
    return pickTarget(active, "avalanche", availableExtra, p);
  }

  const sorted = [...active].sort((a, b) => {
    if (strategy === "avalanche") {
      const diff = effectiveRate(b.loan, p) - effectiveRate(a.loan, p);
      if (Math.abs(diff) > 1e-9) return diff;
      return a.balance - b.balance;
    }
    const diff = a.balance - b.balance;
    if (Math.abs(diff) > 1e-9) return diff;
    return effectiveRate(b.loan, p) - effectiveRate(a.loan, p);
  });
  return sorted[0]!.loan.id;
}

/**
 * Simulera avbetalning månad för månad.
 *
 * - Minimibetalning + avgift betalas på varje lån.
 * - Hela extrabeloppet läggs på ETT mållån enligt vald strategi.
 * - När ett lån når 0 rullas dess minimibetalning vidare till nästa mållån
 *   (snöbollseffekten).
 */
export function simulate(
  loans: Loan[],
  extraPerMonth: number,
  strategy: Strategy,
  startDate: Date = new Date(),
): PayoffResult {
  const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const balances = new Map<string, number>();
  const interestPerLoan = new Map<string, number>();
  const payoffMonth = new Map<string, number>();
  const order: string[] = [];

  for (const l of loans) {
    balances.set(l.id, Math.max(0, l.current_balance));
    interestPerLoan.set(l.id, 0);
  }

  const schedule: ScheduleRow[] = [];
  let totalInterest = 0;
  let totalPaid = 0;
  let freedMinimums = 0;
  let months: number | null = null;
  const never = new Set<string>();

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const active = loans
      .filter((l) => (balances.get(l.id) ?? 0) > 0.005 && !never.has(l.id))
      .map((l) => ({ loan: l, balance: balances.get(l.id) ?? 0 }));

    if (active.length === 0) {
      months = m - 1;
      break;
    }

    const extraAvailable = extraPerMonth + freedMinimums;
    const targetId = pickTarget(active, strategy, extraAvailable);
    let extraPool = extraAvailable;
    let monthInterest = 0;
    let monthPaid = 0;
    let monthPrincipal = 0;

    for (const { loan, balance } of active) {
      const interest = monthlyInterest(loan, balance);
      let payment = minimumPayment(loan, balance) + monthlyFee(loan);
      if (loan.id === targetId) payment += extraPool;

      const owed = balance + interest;
      const applied = Math.min(payment, owed + monthlyFee(loan));
      // Avgiften går inte till skulden
      const toDebt = Math.max(0, Math.min(applied - monthlyFee(loan), owed));
      const newBalance = Math.max(0, owed - toDebt);

      if (loan.id === targetId) extraPool = 0;

      monthInterest += interest;
      monthPaid += applied;
      monthPrincipal += Math.max(0, balance - newBalance);
      interestPerLoan.set(loan.id, (interestPerLoan.get(loan.id) ?? 0) + interest);
      totalInterest += interest;
      totalPaid += applied;

      if (newBalance <= 0.005) {
        balances.set(loan.id, 0);
        payoffMonth.set(loan.id, m);
        order.push(loan.id);
        freedMinimums += minimumPayment(loan, balance) + monthlyFee(loan);
      } else {
        // Stillastående lån: betalningen täcker inte ens räntan och lånet är
        // inte mål för extraamortering → betalas aldrig av.
        if (newBalance >= balance - 0.005 && loan.id !== targetId) {
          never.add(loan.id);
        }
        balances.set(loan.id, newBalance);
      }
    }

    const snapshot: Record<string, number> = {};
    let total = 0;
    for (const l of loans) {
      const b = balances.get(l.id) ?? 0;
      snapshot[l.id] = Math.round(b * 100) / 100;
      total += b;
    }

    schedule.push({
      month: m,
      date: isoMonth(addMonths(start, m - 1)),
      balances: snapshot,
      totalBalance: Math.round(total * 100) / 100,
      interestPaid: Math.round(monthInterest * 100) / 100,
      principalPaid: Math.round(monthPrincipal * 100) / 100,
      paid: Math.round(monthPaid * 100) / 100,
    });

    const remaining = loans.filter((l) => (balances.get(l.id) ?? 0) > 0.005);
    if (remaining.length === 0) {
      months = m;
      break;
    }
    if (remaining.every((l) => never.has(l.id))) {
      break;
    }
  }

  const perLoan: PerLoanResult[] = loans.map((l) => {
    const pm = payoffMonth.get(l.id) ?? null;
    return {
      loanId: l.id,
      name: l.name,
      payoffMonth: pm,
      payoffDate: pm ? isoMonth(addMonths(start, pm - 1)) : null,
      totalInterest: Math.round((interestPerLoan.get(l.id) ?? 0) * 100) / 100,
      neverPaidOff: pm === null,
    };
  });

  return {
    strategy,
    extraPerMonth,
    months,
    debtFreeDate: months ? isoMonth(addMonths(start, months - 1)) : null,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    perLoan,
    schedule,
    neverPaidOff: perLoan.filter((p) => p.neverPaidOff).map((p) => p.loanId),
    order,
  };
}

export interface ComparisonResult {
  baseline: PayoffResult;
  avalanche: PayoffResult;
  snowball: PayoffResult;
  hybrid: PayoffResult;
  chosen: PayoffResult;
  /** Sparade månader jämfört med baseline (null om baseline aldrig blir klar) */
  monthsSaved: number | null;
  /** Sparade räntekronor jämfört med baseline */
  interestSaved: number;
}

/** Kör baseline + alla tre strategierna så att UI kan visa skillnaden. */
export function compare(
  loans: Loan[],
  extraPerMonth: number,
  strategy: "avalanche" | "snowball" | "hybrid",
  startDate: Date = new Date(),
): ComparisonResult {
  const baseline = simulate(loans, 0, "baseline", startDate);
  const avalanche = simulate(loans, extraPerMonth, "avalanche", startDate);
  const snowball = simulate(loans, extraPerMonth, "snowball", startDate);
  const hybrid = simulate(loans, extraPerMonth, "hybrid", startDate);
  const chosen =
    strategy === "avalanche" ? avalanche : strategy === "snowball" ? snowball : hybrid;
  return {
    baseline,
    avalanche,
    snowball,
    hybrid,
    chosen,
    monthsSaved:
      baseline.months != null && chosen.months != null ? baseline.months - chosen.months : null,
    interestSaved: Math.round((baseline.totalInterest - chosen.totalInterest) * 100) / 100,
  };
}

export interface ChecklistRow {
  loanId: string;
  name: string;
  /** Minimibetalning inkl. avgift */
  minimum: number;
  /** Extraamortering som ska läggas på just detta lån denna månad */
  extra: number;
  total: number;
  isTarget: boolean;
  payment_day: number | null;
}

/**
 * Månadens betalningschecklista — härledd direkt ur simuleringens första
 * månad, aldrig ur en språkmodell.
 */
export function monthlyChecklist(
  loans: Loan[],
  extraPerMonth: number,
  strategy: Strategy,
): ChecklistRow[] {
  const active = loans
    .filter((l) => l.current_balance > 0.005)
    .map((l) => ({ loan: l, balance: l.current_balance }));
  const targetId = pickTarget(active, strategy, extraPerMonth);
  return active.map(({ loan, balance }) => {
    const minimum =
      Math.round((minimumPayment(loan, balance) + monthlyFee(loan)) * 100) / 100;
    const isTarget = loan.id === targetId;
    const owed = balance + monthlyInterest(loan, balance);
    const extra = isTarget
      ? Math.round(Math.min(extraPerMonth, Math.max(0, owed - minimum + monthlyFee(loan))) * 100) /
        100
      : 0;
    return {
      loanId: loan.id,
      name: loan.name,
      minimum,
      extra,
      total: Math.round((minimum + extra) * 100) / 100,
      isTarget,
      payment_day: loan.payment_day,
    };
  });
}

/** Lån med revolverande kredit och positiv effektiv ränta. */
export function revolvingWithInterest(loans: Loan[]): Loan[] {
  return loans.filter(
    (l) => l.is_revolving && l.current_balance > 0.005 && effectiveRate(l) > 0,
  );
}

/** Lånet med högst effektiv ränta (och saldo kvar). */
export function highestRateLoan(loans: Loan[]): Loan | null {
  const withBalance = loans.filter((l) => l.current_balance > 0.005);
  if (withBalance.length === 0) return null;
  return [...withBalance].sort((a, b) => effectiveRate(b) - effectiveRate(a))[0]!;
}
