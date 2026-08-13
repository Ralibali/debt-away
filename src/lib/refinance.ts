/**
 * Jämförelsestöd för osäkrade lån.
 *
 * Funktionen identifierar vilka lån som kan jämföras tillsammans och räknar
 * på ett manuellt inmatat alternativ. Den rekommenderar aldrig en långivare
 * eller ett nytt lån; användaren behöver kontrollera effektiv ränta, avgifter
 * och återbetalningsplan i ett faktiskt erbjudande.
 */

import { simulate, type Loan } from "@/lib/payoff";
import { DEFAULT_PARAMETERS, type UserParameters } from "@/lib/parameters";

export type LoanComparisonStatus = "inga" | "ett" | "flera";

export interface LoanComparisonAnalysis {
  loans: Loan[];
  status: LoanComparisonStatus;
  totalBalance: number;
  weightedNominalRate: number;
  highestNominalRate: number;
  currentAnnualInterest: number;
  currentAnnualFees: number;
  baselineMonths: number | null;
  baselineTotalPaid: number | null;
  baselineCost: number | null;
}

export interface LoanOfferInput {
  nominalRate: number;
  termMonths: number;
  setupFee?: number;
  monthlyFee?: number;
}

export interface LoanOfferResult {
  monthlyPayment: number;
  totalPaid: number;
  totalCost: number;
  savingVsCurrent: number | null;
  monthsDifference: number | null;
  firstYearCostDifferenceApprox: number;
}

function round(n: number): number {
  return Math.round(n);
}

function isComparisonCandidate(loan: Loan): boolean {
  return loan.current_balance > 0.005 && loan.kind !== "csn" && !loan.has_collateral;
}

export function analyzeLoanComparison(
  loans: Loan[],
  p: UserParameters = DEFAULT_PARAMETERS,
): LoanComparisonAnalysis {
  const candidates = loans.filter(isComparisonCandidate);
  const totalBalance = candidates.reduce((sum, loan) => sum + loan.current_balance, 0);
  const weightedNominalRate =
    totalBalance > 0
      ? candidates.reduce(
          (sum, loan) => sum + loan.current_balance * loan.nominal_rate,
          0,
        ) / totalBalance
      : 0;
  const highestNominalRate = candidates.reduce(
    (max, loan) => Math.max(max, loan.nominal_rate),
    0,
  );
  const currentAnnualInterest = candidates.reduce(
    (sum, loan) => sum + loan.current_balance * (loan.nominal_rate / 100),
    0,
  );
  const currentAnnualFees = candidates.reduce(
    (sum, loan) => sum + (loan.monthly_fee ?? 0) * 12,
    0,
  );

  const baseline =
    candidates.length > 0 ? simulate(candidates, 0, "baseline", new Date(), p) : null;
  const baselineTotalPaid = baseline?.months ? baseline.totalPaid : null;
  const baselineCost =
    baselineTotalPaid == null ? null : Math.max(0, baselineTotalPaid - totalBalance);

  const status: LoanComparisonStatus =
    candidates.length === 0 ? "inga" : candidates.length === 1 ? "ett" : "flera";

  return {
    loans: candidates,
    status,
    totalBalance: round(totalBalance),
    weightedNominalRate,
    highestNominalRate,
    currentAnnualInterest: round(currentAnnualInterest),
    currentAnnualFees: round(currentAnnualFees),
    baselineMonths: baseline?.months ?? null,
    baselineTotalPaid: baselineTotalPaid == null ? null : round(baselineTotalPaid),
    baselineCost: baselineCost == null ? null : round(baselineCost),
  };
}

function annuityPayment(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

export function compareLoanOffer(
  analysis: LoanComparisonAnalysis,
  input: LoanOfferInput,
): LoanOfferResult {
  const principal = analysis.totalBalance;
  const termMonths = Math.max(0, Math.round(input.termMonths));
  const nominalRate = Math.max(0, Number(input.nominalRate) || 0);
  const setupFee = Math.max(0, Number(input.setupFee) || 0);
  const monthlyFee = Math.max(0, Number(input.monthlyFee) || 0);

  if (principal <= 0 || termMonths <= 0) {
    return {
      monthlyPayment: 0,
      totalPaid: 0,
      totalCost: 0,
      savingVsCurrent: null,
      monthsDifference: null,
      firstYearCostDifferenceApprox: 0,
    };
  }

  const paymentExFee = annuityPayment(principal, nominalRate, termMonths);
  const monthlyPayment = paymentExFee + monthlyFee;
  const totalPaid = paymentExFee * termMonths + monthlyFee * termMonths + setupFee;
  const totalCost = totalPaid - principal;
  const savingVsCurrent =
    analysis.baselineTotalPaid == null ? null : analysis.baselineTotalPaid - totalPaid;
  const monthsDifference =
    analysis.baselineMonths == null ? null : termMonths - analysis.baselineMonths;

  const newFirstYearCostApprox = principal * (nominalRate / 100) + monthlyFee * 12 + setupFee;
  const currentFirstYearCostApprox = analysis.currentAnnualInterest + analysis.currentAnnualFees;

  return {
    monthlyPayment: round(monthlyPayment),
    totalPaid: round(totalPaid),
    totalCost: round(totalCost),
    savingVsCurrent: savingVsCurrent == null ? null : round(savingVsCurrent),
    monthsDifference,
    firstYearCostDifferenceApprox: round(currentFirstYearCostApprox - newFirstYearCostApprox),
  };
}
