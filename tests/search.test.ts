import { describe, expect, it } from "vitest";
import { createSearchMatcher, matchesSearchQuery, normalizeSearchText } from "../lib/utils/search";

describe("search utilities", () => {
  it("normalizes common Arabic letter variants and diacritics", () => {
    expect(normalizeSearchText("إدارةُ سماوة")).toBe("اداره سماوه");
    expect(matchesSearchQuery(["إدارة المشاريع"], "اداره")).toBe(true);
    expect(matchesSearchQuery(["مشروع تدريبي"], "تدريبى")).toBe(true);
  });

  it("matches English text case-insensitively", () => {
    expect(matchesSearchQuery(["Samawah Team App"], "team app")).toBe(true);
    expect(matchesSearchQuery(["Revenue KPI"], "revenue")).toBe(true);
  });

  it("matches all query terms across multiple fields", () => {
    const matcher = createSearchMatcher("سماوه 2026");

    expect(matcher(["رادار الأداء", "سماوة", "٢٠٢٦"])).toBe(true);
    expect(matcher(["رادار الأداء", "سماوة", 2025])).toBe(false);
  });
});
