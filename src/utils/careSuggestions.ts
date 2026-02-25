import type { Moment, Person } from "../models/Person";
import type { Child } from "../models/Person";
import { getUpcomingHolidays } from "./holidays";

export type CareSuggestionType =
  | "birthday"
  | "kidBirthday"
  | "holiday"
  | "followUp"
  | "question"
  | "parentHoliday"
  | "sensitive"
  | "rsvp"
  | "gift"
  | "checkin"
  | "anniversary"
  | "custom"
  | "schoolMilestone";

export type CareSuggestionAction =
  | { kind: "text"; personId: string; body?: string }
  | { kind: "view"; personId: string }
  | { kind: "giftIdeas"; personId: string };

export type CareCardType =
  | "childBirthday"
  | "personBirthday"
  | "holiday"
  | "schoolMilestone"
  | "sensitiveDate"
  | "anniversary"
  | "importantDate";

export type CareCard = {
  id: string;
  type: CareCardType;
  personId: string;
  childId?: string;
  date: string; // YYYY-MM-DD occurrence date
  title: string;
  message: string;
};

export type CareSuggestionQuestionOption = {
  id: string;
  label: string;
  patch?: Partial<Person>;
  apply?: (person: Person) => Person;
};

export type CareSuggestionQuestion = {
  id: string;
  prompt: string;
  options: CareSuggestionQuestionOption[];
  meta?: Record<string, string>;
};

export type CareSuggestion = {
  id: string;
  type: CareSuggestionType;
  personId: string;
  title: string;
  message: string;
  insight?: string;
  timelineCategory?: "soon" | "upcoming" | "later";
  cue?: "Milestone" | "Meaningful year" | "Big one";
  actionLabel: string;
  action: CareSuggestionAction;
  sortDaysUntil: number;
  question?: CareSuggestionQuestion;
};

function startOfToday(base = new Date()) {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function parseIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseYmd(value: string) {
  const [yStr, mStr, dStr] = value.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!yStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { y, m, d };
}

function toIsoDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const monthDayFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

function daysBetween(target: Date, base: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - base.getTime()) / msPerDay);
}

function firstName(person: Person) {
  const trimmed = person.name.trim();
  if (!trimmed) return "them";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function momentDisplayLabel(moment: Moment) {
  if (moment.type === "birthday") return "Birthday";
  if (moment.type === "anniversary") return "Anniversary";
  if (moment.type === "custom") return moment.label;
  return moment.type;
}

function childNameLabel(child: Child, parent: Person) {
  const trimmed = (child.name ?? "").trim();
  if (trimmed) return trimmed;
  const who = firstName(parent);
  return `A child in ${who}'s life`;
}

function getRecurringOccurrenceInNextDays(isoDate: string, today: Date, horizonDays: number) {
  const parts = parseYmd(isoDate);
  if (!parts) return null;
  const monthIndex = parts.m - 1;
  const day = parts.d;
  if (monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) return null;

  const thisYear = new Date(today.getFullYear(), monthIndex, day);
  if (thisYear.getMonth() !== monthIndex || thisYear.getDate() !== day) return null;

  const target = thisYear < today ? new Date(today.getFullYear() + 1, monthIndex, day) : thisYear;
  if (target.getMonth() !== monthIndex || target.getDate() !== day) return null;

  const daysUntil = daysBetween(target, today);
  if (daysUntil < 0 || daysUntil > horizonDays) return null;
  return { target, daysUntil, year: target.getFullYear(), birthYear: parts.y > 0 ? parts.y : null };
}

function religionMatches(tag: string | undefined, kind: "orthodox" | "western" | "jewish" | "muslim") {
  const normalized = (tag ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (kind === "orthodox") return normalized.includes("orthodox") || normalized.includes("greek");
  if (kind === "western") return normalized.includes("christian") || normalized.includes("catholic");
  if (kind === "jewish") return normalized.includes("jew") || normalized.includes("hebrew");
  if (kind === "muslim") return normalized.includes("islam") || normalized.includes("muslim");
  return false;
}

function resolvedReligionCulture(person: Person): Person["religionCulture"] | undefined {
  if (person.religionCulture) return person.religionCulture;

  // Back-compat: infer a best guess from legacy free-text.
  if (religionMatches(person.religionTag, "orthodox")) return "orthodox";
  if (religionMatches(person.religionTag, "western")) return "christian";
  if (religionMatches(person.religionTag, "jewish")) return "jewish";
  if (religionMatches(person.religionTag, "muslim")) return "muslim";
  return undefined;
}

function schoolEventLabel(type: string) {
  if (type === "firstDay") return "first day of school";
  if (type === "kGrad") return "kindergarten graduation";
  if (type === "5thMoveUp") return "5th grade moving-up";
  if (type === "8thGrad") return "8th grade graduation";
  if (type === "hsGrad") return "high school graduation";
  if (type === "communion") return "communion";
  if (type === "confirmation") return "confirmation";
  if (type === "barMitzvah") return "bar mitzvah";
  if (type === "batMitzvah") return "bat mitzvah";
  return "milestone";
}

function getOccurrenceInNextDays(moment: Moment, today: Date, horizonDays: number) {
  const parsed = parseIsoDate(moment.date);
  if (!parsed) return null;

  if (moment.recurring) {
    const month = parsed.getMonth();
    const day = parsed.getDate();

    const thisYear = new Date(today.getFullYear(), month, day);
    if (thisYear.getMonth() !== month || thisYear.getDate() !== day) return null;

    const target = thisYear < today ? new Date(today.getFullYear() + 1, month, day) : thisYear;
    if (target.getMonth() !== month || target.getDate() !== day) return null;

    const daysUntil = daysBetween(target, today);
    if (daysUntil < 0 || daysUntil > horizonDays) return null;
    return { target, daysUntil, year: target.getFullYear() };
  }

  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const daysUntil = daysBetween(target, today);
  if (daysUntil < 0 || daysUntil > horizonDays) return null;
  return { target, daysUntil, year: target.getFullYear() };
}

function formatInDays(daysUntil: number) {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

function birthdayTurningAge(moment: Moment, occurrenceYear: number) {
  const parts = parseYmd(moment.date);
  if (!parts || parts.y <= 0) return null;
  const turning = occurrenceYear - parts.y;
  return turning > 0 ? turning : null;
}

function isDecadeMilestone(age: number) {
  return age > 0 && age % 10 === 0;
}

function stableHash(seed: string) {
  // FNV-1a 32-bit.
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pickTemplate(templates: string[], seed: string) {
  if (!templates.length) return "";
  const idx = stableHash(seed) % templates.length;
  return templates[idx] ?? templates[0] ?? "";
}

function applyTemplate(template: string, vars: Record<string, string | number | undefined | null>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function milestoneInsight(turningAge: number | null) {
  if (!turningAge) return null;
  const milestones = new Set([5, 10, 13, 16, 18, 21]);
  return milestones.has(turningAge) ? "A milestone birthday — worth remembering." : null;
}

function parentInsight(person: Person) {
  const hasKids = Boolean(person.hasKids || (person.children?.length ?? 0) > 0);
  if (!hasKids) return null;
  if (person.parentRole === "mother") return "Her kids have a big week ahead.";
  if (person.parentRole === "father") return "His family may appreciate a quick check-in.";
  return "Their family may appreciate a quick check-in.";
}

function timelineCategoryFromDays(daysUntil: number): CareSuggestion["timelineCategory"] {
  if (daysUntil >= 0 && daysUntil <= 7) return "soon";
  if (daysUntil >= 8 && daysUntil <= 30) return "upcoming";
  if (daysUntil >= 31 && daysUntil <= 90) return "later";
  return undefined;
}

function sameMonthDay(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function generateFollowUpSuggestions(people: Person[], today: Date): CareSuggestion[] {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const suggestions: CareSuggestion[] = [];

  for (const person of people) {
    const who = firstName(person);

    // Child birthday follow-ups (yesterday)
    for (const child of person.children ?? []) {
      const birthday = (child.birthday ?? child.birthdate ?? "").trim();
      if (!birthday) continue;
      const parts = parseYmd(birthday);
      if (!parts) continue;
      const occurs = new Date(yesterday.getFullYear(), parts.m - 1, parts.d);
      if (!sameMonthDay(occurs, yesterday)) continue;

      const childLabel = childNameLabel(child, person);
      const turning = parts.y > 0 ? Math.max(0, yesterday.getFullYear() - parts.y) : null;
      const cue: CareSuggestion["cue"] = milestoneInsight(turning) ? "Milestone" : undefined;
      const action: CareSuggestionAction = person.phone
        ? { kind: "text", personId: person.id, body: `Thinking of you — hope ${childLabel} had a good birthday.` }
        : { kind: "view", personId: person.id };
      const actionLabel = person.phone ? "Send a message" : `View ${who}`;

      suggestions.push({
        id: `followUp_childBirthday_${person.id}_${child.id}_${toIsoDate(yesterday)}`,
        type: "followUp",
        personId: person.id,
        title: `Yesterday was ${childLabel}’s birthday`,
        message: "Want to send a quick follow-up?",
        insight: parentInsight(person) ?? undefined,
        cue,
        actionLabel,
        action,
        sortDaysUntil: -1,
      });
    }

    // Anniversary follow-ups (yesterday)
    const anniversaryMoment = (person.moments ?? []).find((m) => m.type === "anniversary") ?? null;
    if (anniversaryMoment?.date) {
      const parsed = parseIsoDate(anniversaryMoment.date);
      if (parsed) {
        const month = parsed.getMonth();
        const day = parsed.getDate();
        const occurs = new Date(yesterday.getFullYear(), month, day);
        if (sameMonthDay(occurs, yesterday)) {
          const years = (() => {
            const parts = parseYmd(anniversaryMoment.date);
            if (!parts || parts.y <= 0) return null;
            return Math.max(0, yesterday.getFullYear() - parts.y);
          })();
          const cue: CareSuggestion["cue"] =
            years === 20 || years === 25 ? "Big one" : years === 5 || years === 10 ? "Meaningful year" : undefined;
          const action: CareSuggestionAction = person.phone
            ? { kind: "text", personId: person.id, body: `Thinking of you, ${who}.` }
            : { kind: "view", personId: person.id };
          const actionLabel = person.phone ? "Send a message" : `View ${who}`;

          suggestions.push({
            id: `followUp_anniversary_${person.id}_${anniversaryMoment.id}_${toIsoDate(yesterday)}`,
            type: "followUp",
            personId: person.id,
            title: `${who}’s anniversary was yesterday`,
            message: "A little check-in could mean a lot.",
            cue,
            actionLabel,
            action,
            sortDaysUntil: -1,
          });
        }
      }
    }

    // Sensitive date follow-ups (yesterday)
    for (const moment of mergeUniqueMoments(person)) {
      if (!(moment.type === "custom" && moment.category === "sensitive")) continue;
      const parsed = parseIsoDate(moment.date);
      if (!parsed) continue;

      const occurs = moment.recurring
        ? new Date(yesterday.getFullYear(), parsed.getMonth(), parsed.getDate())
        : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());

      if (!sameMonthDay(occurs, yesterday)) continue;
      const action: CareSuggestionAction = person.phone
        ? { kind: "text", personId: person.id, body: `Thinking of you today, ${who}.` }
        : { kind: "view", personId: person.id };
      const actionLabel = person.phone ? "Send a message" : `View ${who}`;

      suggestions.push({
        id: `followUp_sensitive_${person.id}_${moment.id}_${toIsoDate(yesterday)}`,
        type: "followUp",
        personId: person.id,
        title: `Yesterday may have been a difficult day for ${who}`,
        message: "Want to send a short note?",
        actionLabel,
        action,
        sortDaysUntil: -1,
      });
    }
  }

  return suggestions;
}

function mergeUniqueMoments(person: Person) {
  const byId = new Map<string, Moment>();
  const all = [
    ...(person.moments ?? []),
    ...(person.importantDates ?? []),
    ...(person.sensitiveMoments ?? []),
  ];
  for (const m of all) {
    if (!m?.id) continue;
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return Array.from(byId.values());
}

export function generateCareFeed(people: Person[], baseDate = new Date()): CareCard[] {
  const today = startOfToday(baseDate);
  const horizonDays = 21;
  const schoolHorizonDays = 60;

  const cards: Array<CareCard & { sortDaysUntil: number; sortPriority: number }> = [];
  const upcomingHolidays = getUpcomingHolidays(today, horizonDays);

  for (const person of people) {
    const who = firstName(person);
    const hasKids = Boolean(person.hasKids || (person.children?.length ?? 0) > 0);
    const culture = resolvedReligionCulture(person);

    // Children’s birthdays (within 21 days)
    for (const child of person.children ?? []) {
      const birthday = (child.birthday ?? child.birthdate ?? "").trim();
      if (!birthday) continue;
      const occ = getRecurringOccurrenceInNextDays(birthday, today, horizonDays);
      if (!occ) continue;

      const childLabel = childNameLabel(child, person);
      const turning = occ.birthYear ? Math.max(0, occ.year - occ.birthYear) : null;
      const title =
        turning && turning > 0
          ? `${childLabel} turns ${turning} ${formatInDays(occ.daysUntil)} · ${monthDayFormatter.format(
              occ.target
            )}`
          : `${childLabel}'s birthday is ${formatInDays(occ.daysUntil)} · ${monthDayFormatter.format(occ.target)}`;

      cards.push({
        id: `care_childBirthday_${person.id}_${child.id}_${toIsoDate(occ.target)}`,
        type: "childBirthday",
        personId: person.id,
        childId: child.id,
        date: toIsoDate(occ.target),
        title,
        message: "Send a kind note?",
        sortDaysUntil: occ.daysUntil,
        sortPriority: 0,
      });
    }

    // Person birthday (within 21 days)
    const birthdayMoment = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
    if (birthdayMoment?.date) {
      const occ = getOccurrenceInNextDays(birthdayMoment, today, horizonDays);
      if (occ) {
        const turning = birthdayTurningAge(birthdayMoment, occ.year);
        const milestone = turning && isDecadeMilestone(turning) ? ` · Turning ${turning}` : "";
        const title =
          turning !== null
            ? `${who} turns ${turning} ${formatInDays(occ.daysUntil)} · ${monthDayFormatter.format(
                occ.target
              )}${milestone}`
            : `${who}'s birthday is ${formatInDays(occ.daysUntil)} · ${monthDayFormatter.format(occ.target)}`;

        cards.push({
          id: `care_personBirthday_${person.id}_${birthdayMoment.id}_${toIsoDate(occ.target)}`,
          type: "personBirthday",
          personId: person.id,
          date: toIsoDate(occ.target),
          title,
          message: "Reach out?",
          sortDaysUntil: occ.daysUntil,
          sortPriority: 1,
        });
      }
    }

    // Holidays (within 21 days)
    for (const holiday of upcomingHolidays) {
      const daysUntil = daysBetween(holiday.date, today);
      if (daysUntil < 0 || daysUntil > horizonDays) continue;

      if (holiday.id === "mothersDay") {
        if (!hasKids) continue;
        if (person.holidayPrefs?.mothersDay !== true) continue;
        cards.push({
          id: `care_holiday_mothersDay_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Mother’s Day for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Send a kind note?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }

      if (holiday.id === "fathersDay") {
        if (!hasKids) continue;
        if (person.holidayPrefs?.fathersDay !== true) continue;
        cards.push({
          id: `care_holiday_fathersDay_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Father’s Day for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Send a kind note?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }

      if (holiday.id === "easterOrthodox") {
        if (culture !== "orthodox") continue;
        cards.push({
          id: `care_holiday_orthodoxEaster_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Greek Easter for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Reach out?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }

      if (holiday.id === "easterWestern") {
        if (culture !== "christian") continue;
        cards.push({
          id: `care_holiday_easter_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Easter for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Reach out?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }

      if (holiday.id === "hanukkah") {
        if (culture !== "jewish") continue;
        cards.push({
          id: `care_holiday_hanukkah_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Hanukkah for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Send a kind note?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }

      if (holiday.id === "ramadan") {
        if (culture !== "muslim") continue;
        cards.push({
          id: `care_holiday_ramadan_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Ramadan for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Reach out?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }

      if (holiday.id === "eidAlFitr") {
        if (culture !== "muslim") continue;
        cards.push({
          id: `care_holiday_eid_${person.id}_${toIsoDate(holiday.date)}`,
          type: "holiday",
          personId: person.id,
          date: toIsoDate(holiday.date),
          title: `Eid for ${who} · ${monthDayFormatter.format(holiday.date)}`,
          message: "Reach out?",
          sortDaysUntil: daysUntil,
          sortPriority: 2,
        });
        continue;
      }
    }

    // School milestones (within 60 days)
    for (const child of person.children ?? []) {
      for (const ev of child.schoolEvents ?? []) {
        const parsed = parseIsoDate(ev.date);
        if (!parsed) continue;
        const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        const daysUntil = daysBetween(target, today);
        if (daysUntil < 0 || daysUntil > schoolHorizonDays) continue;

        const childLabel = childNameLabel(child, person);
        cards.push({
          id: `care_school_${person.id}_${child.id}_${ev.type}_${toIsoDate(target)}`,
          type: "schoolMilestone",
          personId: person.id,
          childId: child.id,
          date: toIsoDate(target),
          title: `${childLabel} · ${schoolEventLabel(ev.type)} · ${monthDayFormatter.format(target)}`,
          message: "Want to plan ahead?",
          sortDaysUntil: daysUntil,
          sortPriority: 3,
        });
      }
    }

    // Sensitive dates, anniversaries, and custom important dates (within 21 days)
    for (const moment of mergeUniqueMoments(person)) {
      const occ = getOccurrenceInNextDays(moment, today, horizonDays);
      if (!occ) continue;

      const when = monthDayFormatter.format(occ.target);
      const label = momentDisplayLabel(moment);

      if (moment.type === "custom" && moment.category === "sensitive") {
        cards.push({
          id: `care_sensitive_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "sensitiveDate",
          personId: person.id,
          date: toIsoDate(occ.target),
          title: `${who} · ${label} · ${when}`,
          message: "Check in?",
          sortDaysUntil: occ.daysUntil,
          sortPriority: 4,
        });
        continue;
      }

      if (moment.type === "anniversary") {
        cards.push({
          id: `care_anniversary_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "anniversary",
          personId: person.id,
          date: toIsoDate(occ.target),
          title: `${who} · Anniversary · ${when}`,
          message: "Reach out?",
          sortDaysUntil: occ.daysUntil,
          sortPriority: 5,
        });
        continue;
      }

      if (moment.type === "custom") {
        cards.push({
          id: `care_important_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "importantDate",
          personId: person.id,
          date: toIsoDate(occ.target),
          title: `${who} · ${label} · ${when}`,
          message: "Make a note?",
          sortDaysUntil: occ.daysUntil,
          sortPriority: 6,
        });
      }
    }
  }

  const unique = new Map<string, Array<CareCard & { sortDaysUntil: number; sortPriority: number }>[number]>();
  for (const c of cards) unique.set(c.id, c);

  const deduped = Array.from(unique.values());
  deduped.sort((a, b) => {
    if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
    if (a.sortDaysUntil !== b.sortDaysUntil) return a.sortDaysUntil - b.sortDaysUntil;
    return a.title.localeCompare(b.title);
  });

  return deduped.map(({ sortDaysUntil: _d, sortPriority: _p, ...card }) => card);
}

export function generateCareSuggestions(people: Person[], baseDate = new Date()): CareSuggestion[] {
  const today = startOfToday(baseDate);
  const todaySeed = toIsoDate(today);
  const horizonDays = 21;
  const kidsHorizonDays = 21;
  const holidayHorizonDays = 21;
  const schoolHorizonDays = 60;

  const suggestions: CareSuggestion[] = [...generateFollowUpSuggestions(people, today)];

  const upcomingHolidays = getUpcomingHolidays(today, holidayHorizonDays);

  for (const person of people) {
    const children = person.children ?? [];
    const personCulture = resolvedReligionCulture(person);
    let personQuestionAdded = false;

    const combinedMoments = (() => {
      const byId = new Map<string, Moment>();
      const all = [
        ...(person.moments ?? []),
        ...(person.importantDates ?? []),
        ...(person.sensitiveMoments ?? []),
      ];
      for (const m of all) {
        if (!m?.id) continue;
        if (!byId.has(m.id)) byId.set(m.id, m);
      }
      return Array.from(byId.values());
    })();

    if (children.length) {
      for (const child of children) {
        const birthday = (child.birthday ?? child.birthdate ?? "").trim();
        if (!birthday) continue;

        const occ = getRecurringOccurrenceInNextDays(birthday, today, kidsHorizonDays);
        if (!occ) continue;

        const who = childNameLabel(child, person);
        const parent = firstName(person);
        const turning = occ.birthYear ? Math.max(0, occ.year - occ.birthYear) : null;
        const title =
          turning && turning > 0
            ? `${who} turns ${turning} ${formatInDays(occ.daysUntil)}`
            : `${who}'s birthday is ${formatInDays(occ.daysUntil)}`;

        const message = applyTemplate(
          pickTemplate(
            [
              "{childName} has a birthday soon — might be a good moment to check in with {parentName}.",
              "{childName} is celebrating a birthday — a quick note could mean a lot to {parentName}.",
            ],
            `kidBirthday|${person.id}|${child.id}|${todaySeed}`
          ),
          { childName: who, parentName: parent }
        );

        suggestions.push({
          id: `kidBirthday_${person.id}_${child.id}_${toIsoDate(occ.target)}`,
          type: "kidBirthday",
          personId: person.id,
          title,
          message,
          insight: parentInsight(person) ?? undefined,
          timelineCategory: timelineCategoryFromDays(occ.daysUntil),
          actionLabel: "Plan a gift",
          action: { kind: "giftIdeas", personId: person.id },
          sortDaysUntil: occ.daysUntil,
        });
      }
    }

    if (children.length) {
      for (const child of children) {
        for (const ev of child.schoolEvents ?? []) {
          const parsed = parseIsoDate(ev.date);
          if (!parsed) continue;
          const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
          const daysUntil = daysBetween(target, today);
          if (daysUntil < 0 || daysUntil > schoolHorizonDays) continue;

          const who = childNameLabel(child, person);
          const label = schoolEventLabel(ev.type);

          suggestions.push({
            id: `school_${person.id}_${child.id}_${ev.type}_${toIsoDate(target)}`,
            type: "schoolMilestone",
            personId: person.id,
            title: `${who}'s ${label} is ${formatInDays(daysUntil)}`,
            message: "Want to plan something small or set a reminder?",
            insight: parentInsight(person) ?? undefined,
            timelineCategory: timelineCategoryFromDays(daysUntil),
            actionLabel: "See details",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
          });
        }
      }
    }

    for (const holiday of upcomingHolidays) {
      const daysUntil = daysBetween(holiday.date, today);
      if (daysUntil < 0 || daysUntil > holidayHorizonDays) continue;

      const who = firstName(person);
      const hasKids = Boolean(person.hasKids || (person.children?.length ?? 0) > 0);

      const shouldShow =
        (holiday.id === "mothersDay" &&
          hasKids &&
          person.holidayPrefs?.mothersDay === true) ||
        (holiday.id === "fathersDay" &&
          hasKids &&
          person.holidayPrefs?.fathersDay === true) ||
        (holiday.id === "easterOrthodox" && personCulture === "orthodox") ||
        (holiday.id === "easterWestern" && personCulture === "christian") ||
        (holiday.id === "hanukkah" && personCulture === "jewish") ||
        ((holiday.id === "ramadan" || holiday.id === "eidAlFitr") && personCulture === "muslim");

      if (!personQuestionAdded) {
        // Questions trigger only when needed for a suggestion within the next 21 days.
        if (holiday.id === "mothersDay" && typeof person.hasKids !== "boolean") {
          suggestions.push({
            id: `question_hasKids_${person.id}_${toIsoDate(holiday.date)}`,
            type: "question",
            personId: person.id,
            title: `Quick question about ${who}`,
            message: "So this stays relevant.",
            actionLabel: "",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
            question: {
              id: "hasKids",
              prompt: `Does ${who} have kids?`,
              options: [
                { id: "yes", label: "Yes", patch: { hasKids: true } },
                { id: "no", label: "No", patch: { hasKids: false, holidayPrefs: { mothersDay: false, fathersDay: false } } },
              ],
            },
          });
          personQuestionAdded = true;
        } else if (
          hasKids &&
          children.length === 0 &&
          (holiday.id === "mothersDay" || holiday.id === "fathersDay") &&
          typeof person.hasKids === "boolean" &&
          person.hasKids === true
        ) {
          suggestions.push({
            id: `question_addChild_${person.id}_${toIsoDate(holiday.date)}`,
            type: "question",
            personId: person.id,
            title: `Quick question about ${who}`,
            message: "So birthdays and milestones can show up naturally.",
            actionLabel: "",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
            question: {
              id: "addChildName",
              prompt: `Want to add a child for ${who}?`,
              options: [],
            },
          });
          personQuestionAdded = true;
        } else if (
          hasKids &&
          children.some((c) => !(c.birthday ?? c.birthdate)?.trim()) &&
          (holiday.id === "mothersDay" || holiday.id === "fathersDay") &&
          typeof person.hasKids === "boolean" &&
          person.hasKids === true
        ) {
          const firstMissing = children.find((c) => !(c.birthday ?? c.birthdate)?.trim()) ?? null;
          if (!firstMissing) {
            // no-op
          } else {
          suggestions.push({
            id: `question_childBirthday_${person.id}_${toIsoDate(holiday.date)}`,
            type: "question",
            personId: person.id,
            title: `Quick question about ${who}`,
            message: "A birthday (even without a year) helps it show up in time.",
            actionLabel: "",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
            question: {
              id: "addChildBirthday",
              prompt: `Want to add a birthday for ${childNameLabel(firstMissing, person)}?`,
              options: [],
              meta: { childId: firstMissing.id },
            },
          });
          personQuestionAdded = true;
          }
        } else if (
          (holiday.id === "easterOrthodox" ||
            holiday.id === "easterWestern" ||
            holiday.id === "hanukkah" ||
            holiday.id === "ramadan" ||
            holiday.id === "eidAlFitr") &&
          !personCulture
        ) {
          suggestions.push({
            id: `question_religionCulture_${person.id}_${toIsoDate(holiday.date)}`,
            type: "question",
            personId: person.id,
            title: `Quick question about ${who}`,
            message: "So I can remember what matters.",
            actionLabel: "",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
            question: {
              id: "religionCulture",
              prompt: `Which best fits for ${who}?`,
              options: [
                { id: "christian", label: "Christian", patch: { religionCulture: "christian" } },
                { id: "orthodox", label: "Orthodox", patch: { religionCulture: "orthodox" } },
                { id: "jewish", label: "Jewish", patch: { religionCulture: "jewish" } },
                { id: "muslim", label: "Muslim", patch: { religionCulture: "muslim" } },
                { id: "none", label: "None", patch: { religionCulture: "none" } },
              ],
            },
          });
          personQuestionAdded = true;
        } else if (holiday.id === "mothersDay" && hasKids && person.holidayPrefs?.mothersDay === undefined) {
          suggestions.push({
            id: `question_mothersDay_${person.id}_${toIsoDate(holiday.date)}`,
            type: "question",
            personId: person.id,
            title: `Quick question about ${who}`,
            message: "So this stays personal, not generic.",
            actionLabel: "",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
            question: {
              id: "mothersDay",
              prompt: `Should I include Mother’s Day for ${who}?`,
              options: [
                { id: "yes", label: "Yes", patch: { holidayPrefs: { mothersDay: true } } },
                { id: "no", label: "No", patch: { holidayPrefs: { mothersDay: false } } },
              ],
            },
          });
          personQuestionAdded = true;
        } else if (holiday.id === "fathersDay" && hasKids && person.holidayPrefs?.fathersDay === undefined) {
          suggestions.push({
            id: `question_fathersDay_${person.id}_${toIsoDate(holiday.date)}`,
            type: "question",
            personId: person.id,
            title: `Quick question about ${who}`,
            message: "So this stays personal, not generic.",
            actionLabel: "",
            action: { kind: "view", personId: person.id },
            sortDaysUntil: daysUntil,
            question: {
              id: "fathersDay",
              prompt: `Should I include Father’s Day for ${who}?`,
              options: [
                { id: "yes", label: "Yes", patch: { holidayPrefs: { fathersDay: true } } },
                { id: "no", label: "No", patch: { holidayPrefs: { fathersDay: false } } },
              ],
            },
          });
          personQuestionAdded = true;
        }
      }

      if (!shouldShow) continue;

      const action: CareSuggestionAction = person.phone
        ? { kind: "text", personId: person.id, body: `Thinking of you, ${who}.` }
        : { kind: "view", personId: person.id };
      const actionLabel = person.phone ? `Text ${who}` : `View ${who}`;

      const title =
        holiday.id === "mothersDay"
          ? `Mother’s Day is ${formatInDays(daysUntil)} for ${who}`
          : holiday.id === "fathersDay"
            ? `Father’s Day is ${formatInDays(daysUntil)} for ${who}`
            : `${holiday.label} is ${formatInDays(daysUntil)} for ${who}`;

      const message =
        holiday.id === "mothersDay" || holiday.id === "fathersDay"
          ? `Want to send ${who} a short note?`
          : applyTemplate(
              pickTemplate(
                [
                  "{holiday} is coming up — you may want to reach out to {name}.",
                  "{name} may be celebrating {holiday} soon.",
                ],
                `holiday|${holiday.id}|${person.id}|${todaySeed}`
              ),
              { holiday: holiday.label, name: who }
            );

      const insight =
        holiday.id === "mothersDay" || holiday.id === "fathersDay"
          ? parentInsight(person)
          : personCulture
            ? `${holiday.label} is often meaningful — a thoughtful message goes a long way.`
            : null;

      suggestions.push({
        id: `holiday_${holiday.id}_${person.id}_${toIsoDate(holiday.date)}`,
        type: "holiday",
        personId: person.id,
        title,
        message,
        insight: insight ?? undefined,
        timelineCategory: timelineCategoryFromDays(daysUntil),
        actionLabel,
        action,
        sortDaysUntil: daysUntil,
      });
    }

    for (const moment of combinedMoments) {
      const occ = getOccurrenceInNextDays(moment, today, horizonDays);
      if (!occ) continue;

      const who = firstName(person);
      const label = momentDisplayLabel(moment);

      if (moment.type === "custom" && moment.category === "sensitive") {
        const action: CareSuggestionAction = person.phone
          ? { kind: "text", personId: person.id, body: `Thinking of you today, ${who}.` }
          : { kind: "view", personId: person.id };
        const actionLabel = person.phone ? `Text ${who}` : `View ${who}`;

        const message = applyTemplate(
          pickTemplate(
            ["{name} has something important coming up.", "There's a meaningful date ahead for {name}."],
            `sensitive|${person.id}|${moment.id}|${todaySeed}`
          ),
          { name: who }
        );

        suggestions.push({
          id: `sensitive_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "sensitive",
          personId: person.id,
          title: `${label} for ${who} is ${formatInDays(occ.daysUntil)}`,
          message,
          insight: parentInsight(person) ?? undefined,
          timelineCategory: timelineCategoryFromDays(occ.daysUntil),
          actionLabel,
          action,
          sortDaysUntil: occ.daysUntil,
        });
        continue;
      }

      if (moment.type === "birthday") {
        const turning = birthdayTurningAge(moment, occ.year);
        const milestone = turning && isDecadeMilestone(turning) ? `Turning ${turning}` : null;
        const title =
          turning !== null
            ? `${who} turns ${turning} ${formatInDays(occ.daysUntil)}`
            : `${who}'s birthday is ${formatInDays(occ.daysUntil)}`;

        const birthdayTemplates: string[] = ["{name} has a birthday coming up.", "{name}'s birthday is almost here."];
        if (turning !== null && occ.daysUntil <= 7) {
          birthdayTemplates.unshift("{name} turns {age} this week — want to reach out?");
        }

        const message = applyTemplate(
          pickTemplate(birthdayTemplates, `birthday|${person.id}|${moment.id}|${todaySeed}`),
          { name: who, age: turning ?? "" }
        );

        const insight = milestoneInsight(turning) ?? parentInsight(person);
        const cue: CareSuggestion["cue"] = milestoneInsight(turning) ? "Milestone" : undefined;

        suggestions.push({
          id: `birthday_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "birthday",
          personId: person.id,
          title: milestone ? `${title} · ${milestone}` : title,
          message,
          insight: insight ?? undefined,
          cue,
          timelineCategory: timelineCategoryFromDays(occ.daysUntil),
          actionLabel: "See ideas",
          action: { kind: "giftIdeas", personId: person.id },
          sortDaysUntil: occ.daysUntil,
        });
        continue;
      }

      if (moment.type === "anniversary") {
        const parts = parseYmd(moment.date);
        const years =
          parts && parts.y > 0 ? Math.max(0, occ.year - parts.y) : null;
        const yearsText = years !== null && years > 0 ? `${years} years` : null;
        const title = yearsText
          ? `${who}'s anniversary is ${formatInDays(occ.daysUntil)} · ${yearsText}`
          : `${who}'s anniversary is ${formatInDays(occ.daysUntil)}`;

        const action: CareSuggestionAction = person.phone
          ? { kind: "text", personId: person.id, body: `Thinking of you today, ${who}.` }
          : { kind: "view", personId: person.id };
        const actionLabel = person.phone ? `Text ${who}` : `View ${who}`;

        const message = applyTemplate(
          pickTemplate(
            ["{name}'s anniversary is coming up.", "An anniversary is approaching for {name}."],
            `anniversary|${person.id}|${moment.id}|${todaySeed}`
          ),
          { name: who }
        );

        const cue: CareSuggestion["cue"] =
          years === 20 || years === 25 ? "Big one" : years === 5 || years === 10 ? "Meaningful year" : undefined;

        suggestions.push({
          id: `anniversary_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "anniversary",
          personId: person.id,
          title,
          message,
          insight: parentInsight(person) ?? undefined,
          cue,
          timelineCategory: timelineCategoryFromDays(occ.daysUntil),
          actionLabel,
          action,
          sortDaysUntil: occ.daysUntil,
        });
        continue;
      }

      if (moment.type === "custom") {
        const action: CareSuggestionAction = person.phone
          ? { kind: "text", personId: person.id, body: `Hey ${who} — thinking of you.` }
          : { kind: "view", personId: person.id };
        const actionLabel = person.phone ? `Text ${who}` : `View ${who}`;

        const message = applyTemplate(
          pickTemplate(
            ["{name} has something important coming up.", "There's a meaningful date ahead for {name}."],
            `custom|${person.id}|${moment.id}|${todaySeed}`
          ),
          { name: who }
        );

        suggestions.push({
          id: `custom_${person.id}_${moment.id}_${toIsoDate(occ.target)}`,
          type: "custom",
          personId: person.id,
          title: `${label} for ${who} is ${formatInDays(occ.daysUntil)}`,
          message,
          insight: parentInsight(person) ?? undefined,
          timelineCategory: timelineCategoryFromDays(occ.daysUntil),
          actionLabel,
          action,
          sortDaysUntil: occ.daysUntil,
        });
        continue;
      }
    }
  }

  suggestions.sort((a, b) => {
    const priority = (s: CareSuggestion) => {
      if (s.type === "followUp") return -1;
      if (s.type === "kidBirthday") return 0;
      if (s.type === "birthday") return 1;
      if (s.type === "holiday") return 2;
      if (s.type === "schoolMilestone") return 3;
      if (s.type === "sensitive") return 4;
      if (s.type === "anniversary") return 5;
      if (s.type === "custom") return 6;
      if (s.type === "question") return 999;
      return 999;
    };
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    if (a.sortDaysUntil !== b.sortDaysUntil) return a.sortDaysUntil - b.sortDaysUntil;
    return a.title.localeCompare(b.title);
  });
  return suggestions;
}
