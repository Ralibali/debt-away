import type { Budget, Category, Transaction } from "@/lib/data";

export interface CategoryLine {
  category: Category;
  planned: number;
  actual: number;
  diff: number;
}

export interface BudgetSummary {
  lines: CategoryLine[];
  plannedIncome: number;
  plannedExpense: number;
  actualIncome: number;
  actualExpense: number;
  plannedSurplus: number;
  actualSurplus: number;
}

/** Ren beräkning av budgetraderna och överskottet för en månad. */
export function summarize(
  categories: Category[],
  budgets: Budget[],
  transactions: Transaction[],
): BudgetSummary {
  const plannedBy = new Map(budgets.map((b) => [b.category_id, b.planned]));
  const actualBy = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category_id) continue;
    actualBy.set(t.category_id, (actualBy.get(t.category_id) ?? 0) + Math.abs(t.amount));
  }

  const lines: CategoryLine[] = categories.map((category) => {
    const planned = plannedBy.get(category.id) ?? 0;
    const actual = actualBy.get(category.id) ?? 0;
    return { category, planned, actual, diff: planned - actual };
  });

  const sum = (kind: "inkomst" | "utgift", key: "planned" | "actual") =>
    lines.filter((l) => l.category.kind === kind).reduce((s, l) => s + l[key], 0);

  const plannedIncome = sum("inkomst", "planned");
  const plannedExpense = sum("utgift", "planned");
  const actualIncome = sum("inkomst", "actual");
  const actualExpense = sum("utgift", "actual");

  return {
    lines,
    plannedIncome,
    plannedExpense,
    actualIncome,
    actualExpense,
    plannedSurplus: plannedIncome - plannedExpense,
    actualSurplus: actualIncome - actualExpense,
  };
}
