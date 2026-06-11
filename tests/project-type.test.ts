import { describe, expect, it } from "vitest";
import { getProjectTypeLabel, mapProjectType } from "@/lib/utils";

describe("project type helpers", () => {
  it("normalizes Arabic and English project type values", () => {
    expect(mapProjectType("داخلي")).toBe("internal");
    expect(mapProjectType("مشروع داخلي")).toBe("internal");
    expect(mapProjectType("internal")).toBe("internal");
    expect(mapProjectType("خارجي")).toBe("external");
    expect(mapProjectType("external")).toBe("external");
    expect(mapProjectType("")).toBe("external");
  });

  it("returns Arabic project type labels", () => {
    expect(getProjectTypeLabel("internal")).toBe("مشروع داخلي");
    expect(getProjectTypeLabel("external")).toBe("مشروع خارجي");
  });
});
