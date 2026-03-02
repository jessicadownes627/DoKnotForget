import type { Person } from "../models/Person";
import { daysUntil, getFathersDay, getMothersDay } from "../utils/holidayUtils";
import { getNextBirthdayFromIso } from "../utils/birthdayUtils";
import { getNextAnniversary } from "../utils/anniversaryUtils";

export type PromptItem =
  | {
      type: "DISCOVER_MOTHER";
      personId: string;
      message: string;
    }
  | {
      type: "NUDGE_MOTHERS_DAY";
      personId: string;
      message: string;
    }
  | {
      type: "DISCOVER_FATHER";
      personId: string;
      message: string;
    }
  | {
      type: "NUDGE_FATHERS_DAY";
      personId: string;
      message: string;
    }
  | {
      type: "DISCOVER_ANNIVERSARY";
      personId: string;
      partnerId: string;
      message: string;
      year: number;
    }
  | {
      type: "PREP_ANNIVERSARY";
      personId: string;
      partnerId: string;
      message: string;
      daysUntilAnniversary: number;
      anniversaryIso: string; // YYYY-MM-DD for next occurrence
      year: number;
    }
  | {
      type: "ANNIVERSARY_TOMORROW";
      personId: string;
      partnerId: string;
      message: string;
      daysUntilAnniversary: number;
      anniversaryIso: string; // YYYY-MM-DD for next occurrence
      year: number;
    }
  | {
      type: "ANNIVERSARY_TODAY";
      personId: string;
      partnerId: string;
      message: string;
      daysUntilAnniversary: number;
      anniversaryIso: string; // YYYY-MM-DD for next occurrence
      year: number;
    }
  | {
      type: "DISCOVER_BIRTHDAY";
      personId: string;
      message: string;
      year: number;
    }
  | {
      type: "PREP_BIRTHDAY";
      personId: string;
      message: string;
      daysUntilBirthday: number;
      birthdayIso: string; // YYYY-MM-DD for next occurrence
      year: number;
    }
  | {
      type: "TOMORROW_BIRTHDAY";
      personId: string;
      message: string;
      daysUntilBirthday: number;
      birthdayIso: string; // YYYY-MM-DD for next occurrence
      year: number;
    }
  | {
      type: "TODAY_BIRTHDAY";
      personId: string;
      message: string;
      daysUntilBirthday: number;
      birthdayIso: string; // YYYY-MM-DD for next occurrence
      year: number;
    }
  | {
      type: "DISCOVER_CHILD_BIRTHDAY";
      parentId: string;
      childId: string;
      childName: string;
      message: string;
      year: number;
    }
  | {
      type: "PREP_CHILD_BIRTHDAY";
      parentId: string;
      childId: string;
      childName: string;
      message: string;
      daysUntilBirthday: number;
      birthdayIso: string;
      year: number;
    }
  | {
      type: "TOMORROW_CHILD_BIRTHDAY";
      parentId: string;
      childId: string;
      childName: string;
      message: string;
      daysUntilBirthday: number;
      birthdayIso: string;
      year: number;
    }
  | {
      type: "TODAY_CHILD_BIRTHDAY";
      parentId: string;
      childId: string;
      childName: string;
      message: string;
      daysUntilBirthday: number;
      birthdayIso: string;
      year: number;
    };

export type MotherPromptItem = Extract<
  PromptItem,
  { type: "DISCOVER_MOTHER" | "NUDGE_MOTHERS_DAY" }
>;

export type FatherPromptItem = Extract<
  PromptItem,
  { type: "DISCOVER_FATHER" | "NUDGE_FATHERS_DAY" }
>;

export type AnniversaryPromptItem = Extract<
  PromptItem,
  { type: "DISCOVER_ANNIVERSARY" | "PREP_ANNIVERSARY" | "ANNIVERSARY_TOMORROW" | "ANNIVERSARY_TODAY" }
>;

export type BirthdayPromptItem = Extract<
  PromptItem,
  { type: "DISCOVER_BIRTHDAY" | "PREP_BIRTHDAY" | "TOMORROW_BIRTHDAY" | "TODAY_BIRTHDAY" }
>;

export type KidsBirthdayPromptItem = Extract<
  PromptItem,
  { type: "DISCOVER_CHILD_BIRTHDAY" | "PREP_CHILD_BIRTHDAY" | "TOMORROW_CHILD_BIRTHDAY" | "TODAY_CHILD_BIRTHDAY" }
>;

export function getMotherPrompts(people: Person[]): MotherPromptItem[] {
  const year = new Date().getFullYear();
  const mothersDay = getMothersDay(year);
  const until = daysUntil(mothersDay);

  // Prompts appear ONLY between 1–14 days before the holiday.
  if (until < 1 || until > 14) return [];

  const prompts: MotherPromptItem[] = [];

  for (const person of people) {
    if (!person?.id) continue;

    // Optional gender check — skip if unknown.
    const gender = (person as any).gender;
    if (gender === "male") continue;

    const isMother = person.isMother ?? null;

    if (isMother === null && until >= 8 && until <= 14) {
      prompts.push({
        type: "DISCOVER_MOTHER",
        personId: person.id,
        message: `Is ${person.name} a mother?\nKnowing this helps us guide you at the right moments.`,
      });
      continue;
    }

    if (isMother === true && until >= 1 && until <= 3) {
      prompts.push({
        type: "NUDGE_MOTHERS_DAY",
        personId: person.id,
        message: `Mother’s Day is approaching.\nWould you like to send her something warm?`,
      });
    }
  }

  return prompts;
}

export function getFatherPrompts(people: Person[]): FatherPromptItem[] {
  const year = new Date().getFullYear();
  const fathersDay = getFathersDay(year);
  const until = daysUntil(fathersDay);

  // Prompts appear ONLY between 1–14 days before the holiday.
  if (until < 1 || until > 14) return [];

  const prompts: FatherPromptItem[] = [];

  for (const person of people) {
    if (!person?.id) continue;

    // Optional gender check — skip if unknown.
    const gender = (person as any).gender;
    if (gender === "female") continue;

    const isFather = person.isFather ?? null;

    if (isFather === null && until >= 8 && until <= 14) {
      prompts.push({
        type: "DISCOVER_FATHER",
        personId: person.id,
        message: `Is ${person.name} a father?\nThis helps us share reminders that truly matter.`,
      });
      continue;
    }

    if (isFather === true && until >= 1 && until <= 3) {
      prompts.push({
        type: "NUDGE_FATHERS_DAY",
        personId: person.id,
        message: `Father’s Day is coming up.\nWould you like to reach out to him?`,
      });
    }
  }

  return prompts;
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthDayFromYmd(value: string): string | null {
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const mm = parts[1];
  const dd = parts[2];
  if (!mm || !dd) return null;
  return `${mm}-${dd}`;
}

function getAnniversaryMonthDay(person: Person): string | null {
  const stored = (person.anniversary ?? "").trim();
  if (stored) return stored;
  const moment = (person.moments ?? []).find((m) => m.type === "anniversary") ?? null;
  if (!moment?.date) return null;
  return monthDayFromYmd(moment.date);
}

export function getAnniversaryPrompts(people: Person[]): AnniversaryPromptItem[] {
  const prompts: AnniversaryPromptItem[] = [];
  const peopleById = new Map<string, Person>();
  for (const p of people) {
    if (p?.id) peopleById.set(p.id, p);
  }

  const currentYear = new Date().getFullYear();

  for (const person of people) {
    if (!person?.id) continue;
    const partnerId = person.partnerId ?? null;
    if (!partnerId) continue;
    const partner = peopleById.get(partnerId) ?? null;
    if (!partner) continue;

    const monthDay = getAnniversaryMonthDay(person);

    if (!monthDay) {
      prompts.push({
        type: "DISCOVER_ANNIVERSARY",
        personId: person.id,
        partnerId: partner.id,
        message: `Do you know ${person.name}’s anniversary with ${partner.name}?\nWe can help you remember it beautifully.`,
        year: currentYear,
      });
      continue;
    }

    const next = getNextAnniversary(monthDay);
    if (!next) continue;

    const until = daysUntil(next);
    const year = next.getFullYear();
    const anniversaryIso = formatYmd(next);

    if (until === 0) {
      prompts.push({
        type: "ANNIVERSARY_TODAY",
        personId: person.id,
        partnerId: partner.id,
        message: `It’s their anniversary today.\nA kind note might mean a lot.`,
        daysUntilAnniversary: until,
        anniversaryIso,
        year,
      });
      continue;
    }

    if (until === 1) {
      prompts.push({
        type: "ANNIVERSARY_TOMORROW",
        personId: person.id,
        partnerId: partner.id,
        message: `Their anniversary is tomorrow.\nWould you like to send a warm message?`,
        daysUntilAnniversary: until,
        anniversaryIso,
        year,
      });
      continue;
    }

    if (until >= 7 && until <= 10) {
      prompts.push({
        type: "PREP_ANNIVERSARY",
        personId: person.id,
        partnerId: partner.id,
        message: `${person.name} and ${partner.name}’s anniversary is coming up.\nWould you like a gentle reminder?`,
        daysUntilAnniversary: until,
        anniversaryIso,
        year,
      });
    }
  }

  return prompts;
}

export function getBirthdayPrompts(people: Person[]): BirthdayPromptItem[] {
  const prompts: BirthdayPromptItem[] = [];

  for (const person of people) {
    if (!person?.id) continue;

    const birthdayMoment = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;

    if (!birthdayMoment?.date) {
      prompts.push({
        type: "DISCOVER_BIRTHDAY",
        personId: person.id,
        message: `Do you happen to know ${person.name}’s birthday?\nIt would help us plan thoughtfully for her.`,
        year: new Date().getFullYear(),
      });
      continue;
    }

    const next = getNextBirthdayFromIso(birthdayMoment.date);
    if (!next) continue;

    const { daysUntilBirthday, iso, year } = next;

    if (daysUntilBirthday === 0) {
      prompts.push({
        type: "TODAY_BIRTHDAY",
        personId: person.id,
        message: `It’s ${person.name}’s birthday today.\nA kind message might mean a lot to her.`,
        daysUntilBirthday,
        birthdayIso: iso,
        year,
      });
      continue;
    }

    if (daysUntilBirthday >= 1 && daysUntilBirthday <= 2) {
      prompts.push({
        type: "TOMORROW_BIRTHDAY",
        personId: person.id,
        message: `${person.name}’s birthday is tomorrow.\nWould you like to send her a note?`,
        daysUntilBirthday,
        birthdayIso: iso,
        year,
      });
      continue;
    }

    if (daysUntilBirthday >= 3 && daysUntilBirthday <= 7) {
      prompts.push({
        type: "PREP_BIRTHDAY",
        personId: person.id,
        message: `${person.name}’s birthday is coming up.\nWould you like a gentle reminder to reach out?`,
        daysUntilBirthday,
        birthdayIso: iso,
        year,
      });
    }
  }

  return prompts;
}

export function getKidsBirthdayPrompts(people: Person[]): KidsBirthdayPromptItem[] {
  const prompts: KidsBirthdayPromptItem[] = [];

  for (const parent of people) {
    if (!parent?.id) continue;
    const children = parent.children ?? [];
    if (!children.length) continue;

    for (const child of children) {
      const childName = (child.name ?? "").trim();
      if (!child.id || !childName) continue;

      const rawBirthday = (child.birthday ?? child.birthdate ?? "").trim();
      if (!rawBirthday) {
        prompts.push({
          type: "DISCOVER_CHILD_BIRTHDAY",
          parentId: parent.id,
          childId: child.id,
          childName,
          message: `Do you know ${childName}’s birthday?\nWe can help you plan something small and thoughtful.`,
          year: new Date().getFullYear(),
        });
        continue;
      }

      const next = getNextBirthdayFromIso(rawBirthday);
      if (!next) continue;

      const { daysUntilBirthday, iso, year } = next;

      if (daysUntilBirthday === 0) {
        prompts.push({
          type: "TODAY_CHILD_BIRTHDAY",
          parentId: parent.id,
          childId: child.id,
          childName,
          message: `It’s ${childName}’s birthday today.\nWould you like to reach out to ${parent.name}?`,
          daysUntilBirthday,
          birthdayIso: iso,
          year,
        });
        continue;
      }

      if (daysUntilBirthday === 1 || daysUntilBirthday === 2) {
        prompts.push({
          type: "TOMORROW_CHILD_BIRTHDAY",
          parentId: parent.id,
          childId: child.id,
          childName,
          message: `${childName}’s birthday is tomorrow.\nWould you like to send ${parent.name} a warm note?`,
          daysUntilBirthday,
          birthdayIso: iso,
          year,
        });
        continue;
      }

      if (daysUntilBirthday >= 3 && daysUntilBirthday <= 7) {
        prompts.push({
          type: "PREP_CHILD_BIRTHDAY",
          parentId: parent.id,
          childId: child.id,
          childName,
          message: `${childName}’s birthday is coming up.\nWould you like a reminder to prepare something sweet?`,
          daysUntilBirthday,
          birthdayIso: iso,
          year,
        });
      }
    }
  }

  return prompts;
}
