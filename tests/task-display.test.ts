import { describe, expect, it } from "vitest";
import { getTaskDisplayLines } from "../lib/tasks/display";

describe("task display lines", () => {
  it("uses the sub task as the primary display line and category as the section line", () => {
    expect(
      getTaskDisplayLines({
        title: "تطوير المنصة",
        subTask: "إصلاح تدفق المهام",
        category: "إدارة المشاريع",
      })
    ).toEqual({
      primary: "إصلاح تدفق المهام",
      secondary: "إدارة المشاريع",
    });
  });

  it("falls back to the task title when the sub task is missing", () => {
    expect(
      getTaskDisplayLines({
        title: "متابعة الفريق",
        subTask: "",
        category: "تشغيل",
      })
    ).toEqual({
      primary: "متابعة الفريق",
      secondary: "تشغيل",
    });
  });

  it("keeps the task title visible when only a sub task exists", () => {
    expect(
      getTaskDisplayLines({
        title: "تطوير المنصة",
        subTask: "تحسين عرض البورد",
        category: null,
      })
    ).toEqual({
      primary: "تحسين عرض البورد",
      secondary: "تطوير المنصة",
    });
  });
});
