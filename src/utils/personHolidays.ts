import type { Person, PersonHolidayId } from "../models/Person";

export const PERSON_HOLIDAY_OPTIONS: Array<{ id: PersonHolidayId; label: string }> = [
  { id: "christmas", label: "Christmas" },
  { id: "easterWestern", label: "Easter (Western)" },
  { id: "easterOrthodox", label: "Greek Easter (Orthodox)" },
  { id: "hanukkah", label: "Hanukkah" },
  { id: "eidAlFitr", label: "Eid" },
  { id: "diwali", label: "Diwali" },
];

const PERSON_HOLIDAY_IDS = new Set<PersonHolidayId>(PERSON_HOLIDAY_OPTIONS.map((option) => option.id));

function religionMatches(tag: string | undefined, kind: "orthodox" | "western" | "jewish" | "muslim") {
  const normalized = (tag ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (kind === "orthodox") return normalized.includes("orthodox") || normalized.includes("greek");
  if (kind === "western") return normalized.includes("christian") || normalized.includes("catholic");
  if (kind === "jewish") return normalized.includes("jew") || normalized.includes("hebrew");
  if (kind === "muslim") return normalized.includes("islam") || normalized.includes("muslim");
  return false;
}

export function normalizeSelectedHolidays(value: unknown): PersonHolidayId[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<PersonHolidayId>();
  const next: PersonHolidayId[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!PERSON_HOLIDAY_IDS.has(item as PersonHolidayId)) continue;
    const holidayId = item as PersonHolidayId;
    if (seen.has(holidayId)) continue;
    seen.add(holidayId);
    next.push(holidayId);
  }

  return next;
}

export function getSelectedHolidays(person: Pick<Person, "selectedHolidays" | "religionCulture" | "religionTag">) {
  const explicit = normalizeSelectedHolidays(person.selectedHolidays);
  if (explicit.length) return explicit;

  const next = new Set<PersonHolidayId>();
  const legacyCulture = Array.isArray(person.religionCulture) ? person.religionCulture : [];

  if (legacyCulture.includes("christian")) {
    next.add("christmas");
    next.add("easterWestern");
  }
  if (legacyCulture.includes("orthodox")) {
    next.add("easterOrthodox");
  }
  if (legacyCulture.includes("jewish")) next.add("hanukkah");
  if (legacyCulture.includes("muslim")) next.add("eidAlFitr");

  if (next.size === 0) {
    if (religionMatches(person.religionTag, "western")) {
      next.add("christmas");
      next.add("easterWestern");
    }
    if (religionMatches(person.religionTag, "orthodox")) next.add("easterOrthodox");
    if (religionMatches(person.religionTag, "jewish")) next.add("hanukkah");
    if (religionMatches(person.religionTag, "muslim")) next.add("eidAlFitr");
  }

  return Array.from(next);
}

export function toggleHolidaySelection(current: PersonHolidayId[], holidayId: PersonHolidayId) {
  return current.includes(holidayId) ? current.filter((item) => item !== holidayId) : [...current, holidayId];
}

export function holidayOptionLabel(holidayId: PersonHolidayId) {
  return PERSON_HOLIDAY_OPTIONS.find((option) => option.id === holidayId)?.label ?? holidayId;
}
