export function getMothersDay(year: number): Date {
  // Mother’s Day in the US is the 2nd Sunday in May
  const d = new Date(year, 4, 1); // May 1
  const day = d.getDay();
  const firstSunday = day === 0 ? 1 : 8 - day;
  return new Date(year, 4, firstSunday + 7); // second Sunday
}

export function getFathersDay(year: number): Date {
  // Father's Day in the US is the 3rd Sunday in June
  const d = new Date(year, 5, 1); // June 1
  const day = d.getDay();
  const firstSunday = day === 0 ? 1 : 8 - day;
  return new Date(year, 5, firstSunday + 14); // third Sunday
}

export function daysUntil(date: Date): number {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
