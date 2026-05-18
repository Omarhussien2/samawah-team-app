const DEFAULT_TIMEZONE = "Africa/Cairo";

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export const taskUpdateReminderWeekdays = [1, 3];
export const overdueTaskReminderWeekdays = [0, 2, 4];

export interface CronScheduleContext {
  date: string;
  weekday: number;
  timezone: string;
}

export function getCronScheduleContext(
  date = new Date(),
  timezone = DEFAULT_TIMEZONE
): CronScheduleContext {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const weekday = weekdayMap[part("weekday")] ?? date.getUTCDay();

  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    weekday,
    timezone,
  };
}

export function isAllowedCronWeekday(weekday: number, allowedWeekdays: number[]): boolean {
  return allowedWeekdays.includes(weekday);
}
