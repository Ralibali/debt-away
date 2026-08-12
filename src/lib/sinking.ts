/**
 * Buffertposter — kläder, aktiviteter, jul, skolstart. Förutsägbara kostnader
 * som annars kommer ryckvis. Avsättningen dras från "kvar att spendera" varje
 * månad även om pengarna ligger kvar på lönekontot.
 */

import { daysInMonth, toDate } from "@/lib/phase";

export interface SinkingFund {
  id: string;
  name: string;
  annual_estimate: number;
  current_balance: number;
  monthly_accrual: number;
  next_expected: string | null;
}

export function totalMonthlyAccrual(funds: SinkingFund[]): number {
  return funds.reduce((s, f) => s + (f.monthly_accrual || f.annual_estimate / 12), 0);
}

/**
 * Kvarvarande avsättning den här månaden, proportionellt mot dagarna som är
 * kvar. Den del av månaden som redan passerat räknas som avsatt.
 */
export function remainingAccrualThisMonth(funds: SinkingFund[], todayISO: string): number {
  const total = totalMonthlyAccrual(funds);
  if (total <= 0) return 0;
  const dim = daysInMonth(todayISO);
  const day = toDate(todayISO).getUTCDate();
  const daysLeft = Math.max(0, dim - day + 1);
  return Math.round((total * daysLeft) / dim);
}

export interface FundProgress {
  fund: SinkingFund;
  /** Andel av årsmålet som redan finns avsatt, 0–1 */
  progress: number;
  /** Kvar till årsmålet */
  remaining: number;
  daysUntilExpected: number | null;
}

/** Framsteg visas från faktiskt läge, aldrig från noll. */
export function fundProgress(funds: SinkingFund[], todayISO: string): FundProgress[] {
  return funds.map((fund) => {
    const target = Math.max(0, fund.annual_estimate);
    const progress = target > 0 ? Math.min(1, Math.max(0, fund.current_balance / target)) : 0;
    const daysUntilExpected = fund.next_expected
      ? Math.round(
          (toDate(fund.next_expected).getTime() - toDate(todayISO).getTime()) / 86_400_000,
        )
      : null;
    return {
      fund,
      progress,
      remaining: Math.max(0, target - fund.current_balance),
      daysUntilExpected,
    };
  });
}
