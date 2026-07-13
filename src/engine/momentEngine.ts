import type { Moment, Person } from "../models/Person";
import { parseLocalDate } from "../utils/date";
import { compareDisplayNamesByFirstName, displayNameOrFallback } from "../utils/displayName";
import { eventKey } from "../utils/eventKey";

export type UpcomingMomentType = "birthday" | "anniversary" | "childBirthday" | "custom";

export type UpcomingMomentEvent = {
  id: string;
  personId: string;
  personName: string;
  momentType: UpcomingMomentType;
  label: string;
  eventDate: string;
};

function joinNamesAlphabetically(...names: string[]) {
  return names
    .map((name) => displayNameOrFallback(name, "").trim())
    .filter(Boolean)
    .sort(compareDisplayNamesByFirstName)
    .join(" & ");
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function parseYmdParts(value: string) {
  const [yStr, mStr, dStr] = value.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!yStr || !mStr || !dStr) return null;
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function getNextRecurringOccurrence(value: string, baseDate: Date) {
  const parts = parseYmdParts(value);
  if (!parts) return null;

  const year = startOfDay(baseDate).getFullYear();
  const thisYear = new Date(year, parts.m - 1, parts.d);
  if (thisYear.getMonth() !== parts.m - 1 || thisYear.getDate() !== parts.d) return null;

  if (thisYear >= startOfDay(baseDate)) {
    return thisYear;
  }

  const nextYear = new Date(year + 1, parts.m - 1, parts.d);
  if (nextYear.getMonth() !== parts.m - 1 || nextYear.getDate() !== parts.d) return null;
  return nextYear;
}

function dedupeMoments(moments: Moment[]) {
  const seen = new Set<string>();
  return moments.filter((moment) => {
    const key = [moment.id, moment.type, moment.label.trim(), moment.date, moment.recurring ? "1" : "0"].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getUpcomingMoments(people: Person[], today = new Date(), horizonDays = 30): UpcomingMomentEvent[] {
  const baseDate = startOfDay(today);
  const horizonDate = addDays(baseDate, horizonDays);
  const events: UpcomingMomentEvent[] = [];

  for (const person of people) {
    if (!person?.id || !person.name?.trim()) continue;

    const birthday = (person.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
    if (birthday?.date) {
      const next = getNextRecurringOccurrence(birthday.date, baseDate);
      if (next && next > addDays(baseDate, 1) && next <= horizonDate) {
        events.push({
          id: eventKey(person.id, "birthday", formatYmd(next)),
          personId: person.id,
          personName: displayNameOrFallback(person.name),
          momentType: "birthday",
          label: `${possessive(displayNameOrFallback(person.name))} birthday`,
          eventDate: formatYmd(next),
        });
      }
    }

    const anniversaryMonthDay = (person.anniversary ?? "").trim();
    const anniversaryMoment = (person.moments ?? []).find((moment) => moment.type === "anniversary") ?? null;
    const anniversaryIso = anniversaryMonthDay ? `0000-${anniversaryMonthDay}` : (anniversaryMoment?.date ?? "").trim();
    if (anniversaryIso) {
      const next = getNextRecurringOccurrence(anniversaryIso, baseDate);
      if (next && next > addDays(baseDate, 1) && next <= horizonDate) {
        const partnerId = (person.partnerId ?? "").trim();
        const partner = partnerId ? people.find((candidate) => candidate.id === partnerId) ?? null : null;
        const partnerMonthDay = (partner?.anniversary ?? "").trim();
        const partnerMoment = (partner?.moments ?? []).find((moment) => moment.type === "anniversary") ?? null;
        const partnerIso = partnerMonthDay ? `0000-${partnerMonthDay}` : (partnerMoment?.date ?? "").trim();
        const partnerNext = partnerIso ? getNextRecurringOccurrence(partnerIso, baseDate) : null;
        const isSharedPair =
          Boolean(partner?.id) &&
          partnerNext !== null &&
          formatYmd(partnerNext) === formatYmd(next);
        if (isSharedPair && person.id.localeCompare(partner!.id, undefined, { sensitivity: "base" }) > 0) {
          // Skip the duplicate anniversary moment from the reverse partner record.
        } else {
          const anniversaryName = isSharedPair ? joinNamesAlphabetically(person.name, partner?.name ?? "") : displayNameOrFallback(person.name);

          events.push({
            id: eventKey(person.id, "anniversary", formatYmd(next)),
            personId: person.id,
            personName: anniversaryName,
            momentType: "anniversary",
            label: `${possessive(anniversaryName)} anniversary`,
            eventDate: formatYmd(next),
          });
        }
      }
    }

    for (const child of person.children ?? []) {
      const childName = (child.name ?? "").trim();
      const birthdayValue = (child.birthday ?? child.birthdate ?? "").trim();
      if (!childName || !birthdayValue) continue;
      const next = getNextRecurringOccurrence(birthdayValue, baseDate);
      if (next && next > addDays(baseDate, 1) && next <= horizonDate) {
        events.push({
          id: eventKey(person.id, "childBirthday", formatYmd(next)),
          personId: person.id,
          personName: displayNameOrFallback(person.name),
          momentType: "childBirthday",
          label: `${displayNameOrFallback(childName, childName)}'s birthday`,
          eventDate: formatYmd(next),
        });
      }
    }

    const customMoments = dedupeMoments([
      ...(person.moments ?? []).filter((moment) => moment.type === "custom"),
      ...(person.importantDates ?? []).filter((moment) => moment.type === "custom"),
    ]);

    for (const moment of customMoments) {
      const next = moment.recurring
        ? getNextRecurringOccurrence(moment.date, baseDate)
        : parseLocalDate(moment.date);
      if (!next || next <= addDays(baseDate, 1) || next > horizonDate) continue;
      events.push({
        id: eventKey(person.id, "custom", formatYmd(next)),
        personId: person.id,
        personName: displayNameOrFallback(person.name),
        momentType: "custom",
        label: `${moment.label} for ${displayNameOrFallback(person.name)}`,
        eventDate: formatYmd(next),
      });
    }
  }

  events.sort((a, b) => {
    if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate);
    return a.personName.localeCompare(b.personName, undefined, { sensitivity: "base" });
  });

  return events;
}
