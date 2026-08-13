import { effectiveRate, minimumPayment, simulate, type Loan } from "@/lib/payoff";
import type { UserParameters } from "@/lib/parameters";

export interface ConsolidationOffer {
  nominalRate: number;
  effectiveRate: number | null;
  termMonths: number;
  monthlyFee: number;
  setupFee: number;
}

export interface ConsolidationComparison {
  loanCount: number;
  balance: number;
  weightedCurrentRate: number;
  currentMonthlyMinimum: number;
  currentMonths: number | null;
  currentTotalPaid: number | null;
  offerMonthlyPayment: number;
  offerTotalPaid: number;
  offerFinanceCost: number;
  totalDifference: number | null;
  monthlyDifference: number;
}

export function unsecuredConsumerLoans(loans: Loan[]): Loan[] {
  return loans.filter(
    (loan) =>
      loan.current_balance > 0 &&
      !loan.has_collateral &&
      loan.kind !== "csn" &&
      (loan.kind === "privatlan" || loan.kind === "kreditkort" || loan.kind === "kontokredit"),
  );
}

function annuityPayment(principal: number, annualNominalPct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = Math.max(0, annualNominalPct) / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function compareConsolidationOffer(
  loans: Loan[],
  offer: ConsolidationOffer,
  params?: UserParameters,
): ConsolidationComparison {
  const candidates = unsecuredConsumerLoans(loans);
  const balance = candidates.reduce((sum, loan) => sum + loan.current_balance, 0);
  const weightedCurrentRate =
    balance > 0
      ? candidates.reduce(
          (sum, loan) => sum + effectiveRate(loan, params) * loan.current_balance,
          0,
        ) / balance
      : 0;
  const currentMonthlyMinimum = candidates.reduce(
    (sum, loan) => sum + minimumPayment(loan, loan.current_balance) + (loan.monthly_fee ?? 0),
    0,
  );
  const current = simulate(candidates, 0, "baseline", new Date(), params);
  const term = Math.max(1, Math.round(offer.termMonths));
  const basePayment = annuityPayment(balance, offer.nominalRate, term);
  const offerMonthlyPayment = basePayment + Math.max(0, offer.monthlyFee);
  const offerTotalPaid = offerMonthlyPayment * term + Math.max(0, offer.setupFee);
  const offerFinanceCost = Math.max(0, offerTotalPaid - balance);
  const currentTotalPaid = current.months == null ? null : current.totalPaid;

  return {
    loanCount: candidates.length,
    balance: Math.round(balance),
    weightedCurrentRate,
    currentMonthlyMinimum: Math.round(currentMonthlyMinimum),
    currentMonths: current.months,
    currentTotalPaid: currentTotalPaid == null ? null : Math.round(currentTotalPaid),
    offerMonthlyPayment: Math.round(offerMonthlyPayment),
    offerTotalPaid: Math.round(offerTotalPaid),
    offerFinanceCost: Math.round(offerFinanceCost),
    totalDifference:
      currentTotalPaid == null ? null : Math.round(offerTotalPaid - currentTotalPaid),
    monthlyDifference: Math.round(offerMonthlyPayment - currentMonthlyMinimum),
  };
}
