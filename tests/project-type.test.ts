import { describe, expect, it } from "vitest";
import { getProjectType, getProjectTypeLabel, inferProjectTypeFromName, mapProjectType } from "@/lib/utils";

describe("project type helpers", () => {
  it("normalizes Arabic and English project type values", () => {
    expect(mapProjectType("داخلي")).toBe("internal");
    expect(mapProjectType("مشروع داخلي")).toBe("internal");
    expect(mapProjectType("internal")).toBe("internal");
    expect(mapProjectType("خارجي")).toBe("external");
    expect(mapProjectType("external")).toBe("external");
    expect(mapProjectType("")).toBe("internal");
    expect(mapProjectType("غير محدد")).toBe("internal");
  });

  it("returns Arabic project type labels", () => {
    expect(getProjectTypeLabel("internal")).toBe("مشروع داخلي");
    expect(getProjectTypeLabel("external")).toBe("مشروع خارجي");
  });

  it("infers current external projects from their Arabic names", () => {
    expect(inferProjectTypeFromName("أكوا")).toBe("external");
    expect(inferProjectTypeFromName("البنك المركزي")).toBe("external");
    expect(inferProjectTypeFromName("رصد - هداية ثون")).toBe("external");
    expect(inferProjectTypeFromName("هاكاثون هداية")).toBe("external");
    expect(inferProjectTypeFromName("مؤسسة الجفالي")).toBe("external");
    expect(inferProjectTypeFromName("مبرة منى، مشروع الأمير متعب ")).toBe("external");
    expect(inferProjectTypeFromName("متجر سماوة")).toBe("internal");
  });

  it("prefers stored project type when the database column exists", () => {
    expect(getProjectType({ name: "متجر سماوة", project_type: "external" })).toBe("external");
  });
});
