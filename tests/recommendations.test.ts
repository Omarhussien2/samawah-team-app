import { describe, expect, it } from "vitest";
import {
  buildRecommendationDedupeKey,
  getExistingRecommendationKeys,
  matchRecommendationRowsToProjects,
  parseRecommendationImportText,
  splitRecommendationBullets,
} from "../lib/recommendations/tasks";

describe("recommendation helpers", () => {
  it("splits pasted bullet recommendations into separate items", () => {
    expect(splitRecommendationBullets("• تحديث المهام.• إرسال العقد\n- متابعة الاعتماد")).toEqual([
      "تحديث المهام.",
      "إرسال العقد",
      "متابعة الاعتماد",
    ]);
  });

  it("parses a pasted project recommendations table", () => {
    const rows = parseRecommendationImportText([
      "المشروع\tالتوصيات",
      "البنك المركزي\t• إرسال العقد فور اعتماده.• عدم تأخير الملف.",
      "تقريرك\t- تفعيل الحسابات",
    ].join("\n"));

    expect(rows).toEqual([
      { projectName: "البنك المركزي", text: "إرسال العقد فور اعتماده." },
      { projectName: "البنك المركزي", text: "عدم تأخير الملف." },
      { projectName: "تقريرك", text: "تفعيل الحسابات" },
    ]);
  });

  it("matches Arabic project names after normalization", () => {
    const [matched] = matchRecommendationRowsToProjects(
      [{ projectName: "البنك المركزى", text: "إرسال العقد" }],
      [{ id: "project-1", name: "البنك المركزي" }]
    );

    expect(matched).toMatchObject({
      projectId: "project-1",
      matchedProjectName: "البنك المركزي",
      matchStatus: "matched",
    });
  });

  it("marks ambiguous partial project matches as ambiguous", () => {
    const [matched] = matchRecommendationRowsToProjects(
      [{ projectName: "منصة", text: "توصية" }],
      [
        { id: "project-1", name: "منصة إدارة المشاريع" },
        { id: "project-2", name: "منصة المؤثرين" },
      ]
    );

    expect(matched.matchStatus).toBe("ambiguous");
    expect(matched.projectId).toBeNull();
  });

  it("builds stable duplicate keys for the same meeting recommendation", () => {
    const existingKeys = getExistingRecommendationKeys([
      {
        project_id: "project-1",
        title: "إرسال العقد فور اعتماده",
        source_meeting_title: "اجتماع الإدارة",
        source_meeting_date: "2026-06-17",
      },
    ]);

    expect(existingKeys.has(buildRecommendationDedupeKey({
      projectId: "project-1",
      text: "ارسال العقد فور اعتماده",
      meetingTitle: "اجتماع الادارة",
      meetingDate: "2026-06-17T00:00:00.000Z",
    }))).toBe(true);
  });
});
