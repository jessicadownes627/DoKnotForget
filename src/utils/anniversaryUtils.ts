import { daysUntil } from "./holidayUtils";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoMonthDay(value: string): { month: number; day: number } | null {
  const trimmed = value.trim();
  const parts = trimmed.split("-");
  if (parts.length !== 2) return null;
  const month = Number(parts[0]);
  const day = Number(parts[1]);
  if (!month || !day || Number.isNaN(month) || Number.isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
}

export function getNextAnniversary(isoMonthDay: string): Date | null {
  const parts = parseIsoMonthDay(isoMonthDay);
  if (!parts) return null;

  const base = startOfDay(new Date());
  const thisYear = new Date(base.getFullYear(), parts.month - 1, parts.day);
  if (thisYear.getMonth() !== parts.month - 1 || thisYear.getDate() !== parts.day) return null;
  const target = thisYear < base ? new Date(base.getFullYear() + 1, parts.month - 1, parts.day) : thisYear;
  if (target.getMonth() !== parts.month - 1 || target.getDate() !== parts.day) return null;
  return target;
}

export { daysUntil };

