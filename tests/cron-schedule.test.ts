import { describe, expect, it } from "vitest";
import {
  getCronScheduleContext,
  isAllowedCronWeekday,
  overdueTaskReminderWeekdays,
  taskUpdateReminderWeekdays,
} from "../lib/notifications/cron-schedule";

describe("cron schedule helpers", () => {
  it("uses the configured timezone when resolving schedule dates", () => {
    const context = getCronScheduleContext(new Date("2026-05-18T06:00:00.000Z"));

    expect(context).toMatchObject({
      date: "2026-05-18",
      weekday: 1,
      timezone: "Africa/Cairo",
    });
  });

  it("allows task update reminders on Monday and Wednesday", () => {
    expect(isAllowedCronWeekday(1, taskUpdateReminderWeekdays)).toBe(true);
    expect(isAllowedCronWeekday(3, taskUpdateReminderWeekdays)).toBe(true);
    expect(isAllowedCronWeekday(0, taskUpdateReminderWeekdays)).toBe(false);
  });

  it("allows overdue task reminders on Sunday, Tuesday, and Thursday", () => {
    expect(isAllowedCronWeekday(0, overdueTaskReminderWeekdays)).toBe(true);
    expect(isAllowedCronWeekday(2, overdueTaskReminderWeekdays)).toBe(true);
    expect(isAllowedCronWeekday(4, overdueTaskReminderWeekdays)).toBe(true);
    expect(isAllowedCronWeekday(1, overdueTaskReminderWeekdays)).toBe(false);
  });
});
