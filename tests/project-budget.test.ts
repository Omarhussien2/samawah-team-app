import { describe, expect, it } from "vitest";
import { getProjectBudgetSummary, getTaskExpense, normalizeMoney, sumTaskExpenses } from "../lib/projects/budget";

describe("project budget helpers", () => {
  it("normalizes invalid and negative money values to zero", () => {
    expect(normalizeMoney(null)).toBe(0);
    expect(normalizeMoney("")).toBe(0);
    expect(normalizeMoney("not-a-number")).toBe(0);
    expect(normalizeMoney(-250)).toBe(0);
    expect(normalizeMoney("1250.5")).toBe(1250.5);
  });

  it("sums task expenses using the same non-negative rule", () => {
    expect(
      sumTaskExpenses([
        { cost: 100 },
        { cost: "250.5" },
        { cost: null },
        { cost: -75 },
      ])
    ).toBe(350.5);
    expect(getTaskExpense({ cost: undefined })).toBe(0);
  });

  it("calculates usage, remaining budget, and over-budget amount", () => {
    const summary = getProjectBudgetSummary({ total_budget: 1_000 }, [{ cost: 250 }, { cost: 300 }]);

    expect(summary).toMatchObject({
      totalBudget: 1000,
      spent: 550,
      remaining: 450,
      overBudgetAmount: 0,
      usagePct: 55,
      hasBudget: true,
      hasExpenses: true,
      isOverBudget: false,
    });
  });

  it("marks projects as over budget when expenses exceed the budget", () => {
    const summary = getProjectBudgetSummary({ total_budget: 500 }, [{ cost: 400 }, { cost: 200 }]);

    expect(summary.remaining).toBe(0);
    expect(summary.overBudgetAmount).toBe(100);
    expect(summary.usagePct).toBe(120);
    expect(summary.isOverBudget).toBe(true);
  });

  it("keeps usage unavailable when the project has no budget", () => {
    const summary = getProjectBudgetSummary({ total_budget: 0 }, [{ cost: 200 }]);

    expect(summary.usagePct).toBeNull();
    expect(summary.hasBudget).toBe(false);
    expect(summary.hasExpenses).toBe(true);
  });
});
