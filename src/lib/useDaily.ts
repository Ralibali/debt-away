/**
 * Samlar allt som den dagliga siffran behöver. Ett ställe, så att notisen och
 * översikten alltid visar exakt samma tal.
 */

import { useMemo } from "react";
import {
  useAccounts,
  useBudgets,
  useCategories,
  useLoans,
  useParameters,
  useScenarios,
  useTransactions,
} from "@/lib/data";
import { computeDaily, type DailyNumber } from "@/lib/daily";
import { usePhaseBudgets, useSinkingFunds, useCareSchedule } from "@/lib/rhythm";
import { monthStartISO, todayISO } from "@/lib/format";

export function useDaily(): { daily: DailyNumber; today: string } {
  const today = todayISO();
  const month = monthStartISO();
  const { data: accounts = [] } = useAccounts();
  const { data: loans = [] } = useLoans();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const { data: funds = [] } = useSinkingFunds();
  const { data: phaseBudgets = [] } = usePhaseBudgets();
  const { data: schedule } = useCareSchedule();
  const { data: params } = useParameters();
  const { data: scenarios = [] } = useScenarios();

  const extraToDebt = scenarios.length > 0 ? Number(scenarios[0]!.extra_per_month) : 0;

  const daily = useMemo(
    () =>
      computeDaily({
        accounts,
        loans,
        categories,
        budgets,
        transactions,
        funds,
        phaseBudgets,
        extraToDebt,
        schedule,
        today,
        params,
      }),
    [
      accounts,
      loans,
      categories,
      budgets,
      transactions,
      funds,
      phaseBudgets,
      extraToDebt,
      schedule,
      today,
      params,
    ],
  );

  return { daily, today };
}
