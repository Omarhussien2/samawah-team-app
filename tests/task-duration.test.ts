import { describe, expect, it } from "vitest";
import { getTaskDateDuration } from "../lib/tasks/duration";

describe("task date duration", () => {
  it("counts the same start and end date as one day", () => {
    expect(getTaskDateDuration({ startDate: "2026-05-18", endDate: "2026-05-18" })).toMatchObject({
      days: 1,
      isValidRange: true,
      label: "يوم واحد",
    });
  });

  it("counts calendar duration inclusively", () => {
    expect(getTaskDateDuration({ startDate: "2026-05-18", endDate: "2026-05-20" })).toMatchObject({
      days: 3,
      isValidRange: true,
      label: "٣ أيام",
    });
  });

  it("marks an end date before the start date as invalid", () => {
    expect(getTaskDateDuration({ startDate: "2026-05-20", endDate: "2026-05-18" })).toMatchObject({
      days: null,
      isValidRange: false,
      label: "تاريخ النهاية قبل البداية",
    });
  });

  it("waits for both dates before calculating duration", () => {
    expect(getTaskDateDuration({ startDate: "2026-05-18", endDate: null })).toMatchObject({
      days: null,
      isValidRange: true,
      hasBothDates: false,
    });
  });
});
