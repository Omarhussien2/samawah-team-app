import { describe, expect, it } from "vitest";
import {
  buildNotificationDedupeKey,
  resolveNotificationPriority,
} from "../lib/notifications/rule-utils";

describe("notification rule utils", () => {
  it("builds stable dedupe keys from meaningful parts only", () => {
    expect(buildNotificationDedupeKey(" Project ", null, "Overdue Tasks", 2026)).toBe(
      "project:overdue-tasks:2026"
    );
  });

  it("maps scores to notification priorities", () => {
    expect(resolveNotificationPriority(15)).toBe("low");
    expect(resolveNotificationPriority(40)).toBe("medium");
    expect(resolveNotificationPriority(70)).toBe("high");
    expect(resolveNotificationPriority(90)).toBe("critical");
  });
});
