export interface BudgetTask {
  cost?: number | string | null;
}

export interface BudgetProject {
  total_budget?: number | string | null;
}

export interface ProjectBudgetSummary {
  totalBudget: number;
  spent: number;
  remaining: number;
  overBudgetAmount: number;
  usagePct: number | null;
  hasBudget: boolean;
  hasExpenses: boolean;
  isOverBudget: boolean;
}

export function normalizeMoney(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "string"
      ? value.trim() === ""
        ? Number.NaN
        : Number(value)
      : value;

  if (typeof numericValue !== "number" || !Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, numericValue);
}

export function getTaskExpense(task: BudgetTask) {
  return normalizeMoney(task.cost);
}

export function sumTaskExpenses(tasks: BudgetTask[]) {
  return tasks.reduce((sum, task) => sum + getTaskExpense(task), 0);
}

export function getProjectBudgetSummary(project: BudgetProject, tasks: BudgetTask[]): ProjectBudgetSummary {
  const totalBudget = normalizeMoney(project.total_budget);
  const spent = sumTaskExpenses(tasks);
  const remaining = Math.max(totalBudget - spent, 0);
  const overBudgetAmount = Math.max(spent - totalBudget, 0);
  const usagePct = totalBudget > 0 ? Math.round((spent / totalBudget) * 100) : null;

  return {
    totalBudget,
    spent,
    remaining,
    overBudgetAmount,
    usagePct,
    hasBudget: totalBudget > 0,
    hasExpenses: spent > 0,
    isOverBudget: usagePct !== null && usagePct > 100,
  };
}
