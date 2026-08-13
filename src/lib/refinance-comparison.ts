import type { Loan } from "@/lib/payoff";
import { effectiveRate } from "@/lib/payoff";
import type { UserParameters } from "@/lib/parameters";

export interface RefinanceComparison {
  loanCount: number;
  balance: number;
  weightedRate: number;
  comparisonCeiling: number;
  illustrativeMonthlyInterestDifference: number;
}

export function refinanceComparison(
  loans: Loan[],
  requiredImprovementPctPoints: number,
  params?: UserParameters,
): RefinanceComparison {
  const candidates = loans.filter(
    (loan) =>
      loan.current_balance > 0 &&
      !loan.has_collateral &&
      loan.kind !== "csn" &&
      (loan.kind === "privatlan" || loan.kind === "kreditkort" || loan.kind === "kontokredit"),
  );

  const balance = candidates.reduce((sum, loan) => sum + loan.current_balance, 0);
  const weightedRate =
    balance > 0
      ? candidates.reduce(
          (sum, loan) => sum + effectiveRate(loan, params) * loan.current_balance,
          0,
        ) / balance
      : 0;

  const improvement = Math.max(0, requiredImprovementPctPoints);
  const comparisonCeiling = Math.max(0, weightedRate - improvement);
  const illustrativeMonthlyInterestDifference =
    balance > 0 ? Math.max(0, (balance * improvement) / 100 / 12) : 0;

  return {
    loanCount: candidates.length,
    balance,
    weightedRate,
    comparisonCeiling,
    illustrativeMonthlyInterestDifference,
  };
}
