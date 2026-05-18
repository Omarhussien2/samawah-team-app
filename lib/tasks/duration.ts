export interface TaskDateDuration {
  days: number | null;
  isValidRange: boolean;
  hasBothDates: boolean;
  label: string;
}

function parseDateOnly(date: string | null | undefined) {
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
}

export function formatDays(days: number) {
  return new Intl.NumberFormat("ar-EG-u-nu-arab", {
    maximumFractionDigits: 0,
  }).format(days);
}

export function getTaskDateDuration({
  startDate,
  endDate,
}: {
  startDate?: string | null;
  endDate?: string | null;
}): TaskDateDuration {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate);
  const hasBothDates = start !== null && end !== null;

  if (!hasBothDates) {
    return {
      days: null,
      isValidRange: true,
      hasBothDates,
      label: "أضف تاريخ البداية والنهاية",
    };
  }

  if (end < start) {
    return {
      days: null,
      isValidRange: false,
      hasBothDates,
      label: "تاريخ النهاية قبل البداية",
    };
  }

  const days = Math.round((end - start) / 86_400_000) + 1;

  return {
    days,
    isValidRange: true,
    hasBothDates,
    label: days === 1 ? "يوم واحد" : days === 2 ? "يومان" : `${formatDays(days)} أيام`,
  };
}
