export type HolidayId =
  | "mothersDay"
  | "fathersDay"
  | "easterWestern"
  | "easterOrthodox"
  | "hanukkah"
  | "ramadan"
  | "eidAlFitr";

export type HolidayOccurrence = {
  id: HolidayId;
  label: string;
  date: Date;
};

function startOfToday(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function daysBetween(target: Date, base: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const t = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  return Math.round((t - b) / msPerDay);
}

function nthWeekdayOfMonth(year: number, monthIndex: number, weekday: number, nth: number) {
  const first = new Date(year, monthIndex, 1);
  const firstDay = first.getDay();
  const offset = (weekday - firstDay + 7) % 7;
  const day = 1 + offset + (nth - 1) * 7;
  return new Date(year, monthIndex, day);
}

export function mothersDay(year: number) {
  // US: second Sunday in May
  return nthWeekdayOfMonth(year, 4, 0, 2);
}

export function fathersDay(year: number) {
  // US: third Sunday in June
  return nthWeekdayOfMonth(year, 5, 0, 3);
}

export function westernEaster(year: number) {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function orthodoxEaster(year: number) {
  // Meeus algorithm for Julian Easter, converted to Gregorian (valid for modern years).
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;

  // Julian calendar date
  const julian = new Date(Date.UTC(year, month - 1, day));
  // Convert Julian -> Gregorian by adding the century-dependent offset.
  // For 1900–2099 this is 13 days.
  const gregorianOffsetDays = year >= 2100 ? 14 : year >= 1900 ? 13 : 12;
  const gregorian = new Date(julian.getTime() + gregorianOffsetDays * 24 * 60 * 60 * 1000);
  return new Date(gregorian.getUTCFullYear(), gregorian.getUTCMonth(), gregorian.getUTCDate());
}

function calendarFormatter(calendar: "hebrew" | "islamic") {
  return new Intl.DateTimeFormat("en-u-ca-" + calendar, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function extractMonthDayForCalendar(date: Date, calendar: "hebrew" | "islamic") {
  const formatter = calendarFormatter(calendar);
  const parts = formatter.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  return { month, day };
}

function findNextCalendarMatch(
  calendar: "hebrew" | "islamic",
  base: Date,
  horizonDays: number,
  matcher: (month: string, day: string) => boolean
) {
  const start = startOfToday(base);
  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const { month, day } = extractMonthDayForCalendar(date, calendar);
    if (matcher(month, day)) return date;
  }
  return null;
}

export function nextHanukkahStart(baseDate = new Date()) {
  // 25 Kislev
  return findNextCalendarMatch("hebrew", baseDate, 370, (month, day) => {
    return month.toLowerCase().includes("kislev") && day === "25";
  });
}

export function nextRamadanStart(baseDate = new Date()) {
  // 1 Ramadan
  return findNextCalendarMatch("islamic", baseDate, 370, (month, day) => {
    return month.toLowerCase().includes("ramadan") && day === "1";
  });
}

export function nextEidAlFitr(baseDate = new Date()) {
  // 1 Shawwal
  return findNextCalendarMatch("islamic", baseDate, 370, (month, day) => {
    return month.toLowerCase().includes("shawwal") && day === "1";
  });
}

export function getUpcomingHolidays(baseDate = new Date(), horizonDays = 21): HolidayOccurrence[] {
  const today = startOfToday(baseDate);
  const year = today.getFullYear();

  const candidates: HolidayOccurrence[] = [
    { id: "mothersDay", label: "Mother’s Day", date: mothersDay(year) },
    { id: "fathersDay", label: "Father’s Day", date: fathersDay(year) },
    { id: "easterWestern", label: "Easter", date: westernEaster(year) },
    { id: "easterOrthodox", label: "Greek Easter", date: orthodoxEaster(year) },
  ];

  const hanukkah = nextHanukkahStart(today);
  if (hanukkah) candidates.push({ id: "hanukkah", label: "Hanukkah", date: hanukkah });

  const ramadan = nextRamadanStart(today);
  if (ramadan) candidates.push({ id: "ramadan", label: "Ramadan", date: ramadan });

  const eid = nextEidAlFitr(today);
  if (eid) candidates.push({ id: "eidAlFitr", label: "Eid al-Fitr", date: eid });

  return candidates
    .map((h) => ({ ...h, date: startOfToday(h.date) }))
    .filter((h) => {
      const delta = daysBetween(h.date, today);
      return delta >= 0 && delta <= horizonDays;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

