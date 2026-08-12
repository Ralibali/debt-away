/**
 * Kopplingen mellan sparande och skuld. Körs i kod, aldrig av en språkmodell.
 * Regeln är hårdkodad och i denna ordning: buffert → dyr skuld → sparande.
 */

import { effectiveRate, type Loan } from "@/lib/payoff";
import type { SavingsAccount } from "@/lib/savings";

export type BufferStatus = "saknas" | "delvis" | "uppfylld";

export interface CapitalAdvice {
  bufferStatus: BufferStatus;
  /** 3 × genomsnittliga månadsutgifter */
  bufferTarget: number;
  bufferValue: number;
  /** Effektiv ränta på dyraste skulden, i procent */
  costliestDebtRate: number;
  costliestDebtName: string | null;
  /** Högsta angivna ränta bland sparkonton, i procent */
  bestSavingsRate: number;
  bestSavingsName: string | null;
  /** Månadsöverskott som är fritt när bufferten är fylld */
  surplusAboveBuffer: number;
  /** surplus × 12 × (skuldränta − sparränta) */
  yearlyGainIfRedirected: number;
  /** Vart överskottet gör mest nytta just nu */
  recommendation: "buffert" | "skuld" | "sparande";
  /** Neutral formulering, utan pekpinnar */
  message: string;
}

export interface CapitalInput {
  loans: Loan[];
  savings: SavingsAccount[];
  /** Genomsnittliga månadsutgifter, från transaktionerna */
  avgMonthlyExpenses: number;
  /** Månadsöverskott: inkomster − utgifter − minimibetalningar */
  monthlySurplus: number;
  /** Förväntad avkastning på investerat sparande (procent), t.ex. 7 */
  expectedReturn?: number;
}

export function capitalAdvice(input: CapitalInput): CapitalAdvice {
  const { loans, savings, avgMonthlyExpenses, monthlySurplus } = input;
  const expectedReturn = input.expectedReturn ?? 7;

  const bufferTarget = Math.round(avgMonthlyExpenses * 3);
  const bufferValue = savings
    .filter((s) => s.is_buffer || s.kind === "buffert")
    .reduce((sum, s) => sum + s.current_value, 0);

  const bufferStatus: BufferStatus =
    bufferTarget <= 0 || bufferValue >= bufferTarget
      ? "uppfylld"
      : bufferValue <= 0
        ? "saknas"
        : "delvis";

  const withBalance = loans.filter((l) => l.current_balance > 0.005);
  const costliest = withBalance.length
    ? [...withBalance].sort((a, b) => effectiveRate(b) - effectiveRate(a))[0]!
    : null;
  const costliestDebtRate = costliest ? effectiveRate(costliest) : 0;

  const cashAccounts = savings.filter(
    (s) => s.kind === "sparkonto" && s.interest_rate != null,
  );
  const best = cashAccounts.length
    ? [...cashAccounts].sort((a, b) => (b.interest_rate ?? 0) - (a.interest_rate ?? 0))[0]!
    : null;
  const bestSavingsRate = best?.interest_rate ?? 0;

  const surplusAboveBuffer = bufferStatus === "uppfylld" ? Math.max(0, monthlySurplus) : 0;
  const rateGap = (costliestDebtRate - bestSavingsRate) / 100;
  const yearlyGainIfRedirected = Math.max(0, surplusAboveBuffer * 12 * rateGap);

  let recommendation: CapitalAdvice["recommendation"];
  let message: string;

  if (bufferStatus !== "uppfylld") {
    recommendation = "buffert";
    const kvar = Math.max(0, bufferTarget - bufferValue);
    message =
      bufferTarget <= 0
        ? "Lägg in några månaders utgifter så räknas ett buffertmål fram."
        : `Buffertmålet är ${fmt(bufferTarget)} (tre månaders utgifter) och ${fmt(
            bufferValue,
          )} finns på plats. Överskottet gör mest nytta i bufferten tills de sista ${fmt(
            kvar,
          )} är där — annars finansieras nästa oväntade utgift av kontokrediten.`;
  } else if (costliest && costliestDebtRate > Math.max(bestSavingsRate, 0)) {
    recommendation = "skuld";
    message =
      `Din buffert är uppfylld. Ditt överskott ger mer nytta på ${costliest.name} ` +
      `(${num(costliestDebtRate)} % effektiv ränta) än på sparkontot ` +
      `(${num(bestSavingsRate)} %)` +
      (yearlyGainIfRedirected > 0
        ? ` — skillnaden är cirka ${fmt(yearlyGainIfRedirected)} per år.`
        : ".");
  } else if (costliest && costliestDebtRate < expectedReturn) {
    recommendation = "sparande";
    message =
      `Din buffert är uppfylld. Räntan på ${costliest.name} är ${num(costliestDebtRate)} %, ` +
      `lägre än en förväntad avkastning på ${num(expectedReturn)} % — överskottet arbetar ` +
      `troligen hårdare i sparandet, med den risk det innebär.`;
  } else {
    recommendation = "sparande";
    message =
      "Din buffert är uppfylld och det finns ingen dyrare skuld att lösa. Överskottet går till sparandet.";
  }

  return {
    bufferStatus,
    bufferTarget,
    bufferValue,
    costliestDebtRate,
    costliestDebtName: costliest?.name ?? null,
    bestSavingsRate,
    bestSavingsName: best?.name ?? null,
    surplusAboveBuffer,
    yearlyGainIfRedirected,
    recommendation,
    message,
  };
}

function fmt(v: number): string {
  return `${Math.round(v).toLocaleString("sv-SE")} kr`;
}

function num(v: number): string {
  return v.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}
