function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseIsoMonthDay(value: string): { month: number; day: number } | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day || Number.isNaN(month) || Number.isNaN(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { month, day };
}

export function daysUntilDate(target: Date, baseDate = new Date()): number {
  const base = startOfDay(baseDate);
  const t = startOfDay(target);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((t.getTime() - base.getTime()) / msPerDay);
}

export function getNextBirthdayFromIso(birthdayIso: string, baseDate = new Date()) {
  const parts = parseIsoMonthDay(birthdayIso);
  if (!parts) return null;

  const base = startOfDay(baseDate);
  const thisYear = new Date(base.getFullYear(), parts.month - 1, parts.day);
  if (thisYear.getMonth() !== parts.month - 1 || thisYear.getDate() !== parts.day) return null;
  const target = thisYear < base ? new Date(base.getFullYear() + 1, parts.month - 1, parts.day) : thisYear;
  if (target.getMonth() !== parts.month - 1 || target.getDate() !== parts.day) return null;

  return { target, daysUntilBirthday: daysUntilDate(target, base), year: target.getFullYear(), iso: formatYmd(target) };
}

export function getNextChildBirthday(birthday: Date): Date {
  const base = startOfDay(new Date());
  const month = birthday.getMonth();
  const day = birthday.getDate();
  const thisYear = new Date(base.getFullYear(), month, day);
  if (thisYear.getMonth() !== month || thisYear.getDate() !== day) return thisYear;
  return thisYear < base ? new Date(base.getFullYear() + 1, month, day) : thisYear;
}

