import { describe, expect, it } from "vitest";
import { getDateRollupPeriods, getRelatedKpiPeriods } from "../lib/kpis/periods";

describe("KPI periods", () => {
  it("rolls a monthly period into its containing quarter", () => {
    expect(getRelatedKpiPeriods("monthly", "2026-05-01", "2026-05-31")).toMatchObject([
      { periodType: "monthly", periodStart: "2026-05-01", periodEnd: "2026-05-31" },
      { periodType: "quarterly", periodStart: "2026-04-01", periodEnd: "2026-06-30" },
    ]);
  });

  it("finds month and quarter periods from a source record date", () => {
    expect(getDateRollupPeriods("2026-09-15")).toMatchObject([
      { periodType: "monthly", periodStart: "2026-09-01", periodEnd: "2026-09-30" },
      { periodType: "quarterly", periodStart: "2026-07-01", periodEnd: "2026-09-30" },
    ]);
  });
});
