import { describe, expect, it } from "vitest";
import { formatHours, getTaskHourSummary } from "../lib/tasks/hours";

describe("task hour summary", () => {
  it("calculates remaining hours and utilization when planned hours exist", () => {
    expect(getTaskHourSummary({ plannedHours: 8, actualHours: 3.5 })).toMatchObject({
      planned: 8,
      actual: 3.5,
      remaining: 4.5,
      overrun: 0,
      utilization: 44,
      hasPlan: true,
      isOverPlan: false,
      label: "ضمن المخطط",
    });
  });

  it("flags overrun without blocking actual hours beyond the plan", () => {
    expect(getTaskHourSummary({ plannedHours: 4, actualHours: 5.25 })).toMatchObject({
      remaining: 0,
      overrun: 1.25,
      utilization: 131,
      isOverPlan: true,
      label: "زائد عن المخطط",
    });
  });

  it("does not calculate utilization when no plan exists", () => {
    expect(getTaskHourSummary({ plannedHours: 0, actualHours: 2 })).toMatchObject({
      remaining: null,
      utilization: null,
      hasPlan: false,
      label: "بدون مخطط",
    });
  });

  it("formats quarter-hour decimals for Arabic display", () => {
    expect(formatHours(2.75)).toBe("٢٫٧٥");
    expect(formatHours(3)).toBe("٣");
  });
});
