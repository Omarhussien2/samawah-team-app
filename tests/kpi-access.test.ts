import { describe, expect, it } from "vitest";
import { canAccessKpiCenter } from "@/lib/auth/kpi-access";

describe("KPI access allowlist", () => {
  it("allows the temporary KPI users", () => {
    expect(canAccessKpiCenter({ id: "36185351-6c30-4e3d-9558-c8a7d5387762", email: null, full_name: null })).toBe(true);
    expect(canAccessKpiCenter({ id: "unknown", email: "omarsamawah@gmail.com", full_name: null })).toBe(true);
    expect(canAccessKpiCenter({ id: "unknown", email: null, full_name: "محمد بارحمة" })).toBe(true);
  });

  it("blocks users outside the KPI allowlist", () => {
    expect(
      canAccessKpiCenter({
        id: "87a9b48c-c8e2-4f37-a135-53082931d8ce",
        email: "t.alzahrani@samawah1.sa",
        full_name: "ترنيم الزهراني",
      })
    ).toBe(false);
    expect(
      canAccessKpiCenter({
        id: "5d5bc39d-92c2-497e-be58-937981d6d954",
        email: "sa0880888@gmail.com",
        full_name: "شهد المطرفي",
      })
    ).toBe(false);
    expect(canAccessKpiCenter(null)).toBe(false);
  });
});
