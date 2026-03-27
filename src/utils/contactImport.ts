import { Contacts, type ContactPayload, type PermissionStatus, PhoneType } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import type { Person } from "../models/Person";
import { getNextBirthdayFromIso } from "./birthdayUtils";
import { normalizePhone } from "./phone";

const PRIORITY_RELATIONSHIP_TERMS = [
  "ice",
  "mom",
  "mother",
  "dad",
  "father",
  "grandma",
  "grandpa",
  "nana",
  "papa",
  "mimi",
  "oma",
  "opa",
  "aunt",
  "uncle",
  "cousin",
  "cuz",
  "cous",
  "boyfriend",
  "girlfriend",
  "fiance",
  "fiancee",
  "husband",
  "wife",
  "bae",
  "bf",
  "gf",
  "work",
  "office",
  "boss",
];

const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

export function getCapacitorContactsPlugin(): any | null {
  if (Contacts) return Contacts;
  const cap = (window as any)?.Capacitor;
  const plugins = cap?.Plugins;
  if (!plugins) return null;
  return plugins.Contacts || plugins.CapacitorContacts || plugins.Contact || null;
}

export function isContactImportSupported() {
  return typeof window !== "undefined" && Capacitor.getPlatform() !== "web" && Boolean(getCapacitorContactsPlugin());
}

export type ImportableContact = {
  contactId: string;
  name: string;
  phone?: string;
  birthday?: string;
};

function getContactDisplayName(contact: ContactPayload) {
  const display = (contact.name?.display ?? "").trim();
  if (display) return display;

  const parts = [
    (contact.name?.given ?? "").trim(),
    (contact.name?.middle ?? "").trim(),
    (contact.name?.family ?? "").trim(),
  ].filter(Boolean);
  return parts.join(" ").trim();
}

function getPrimaryPhone(contact: ContactPayload) {
  const phones = contact.phones ?? [];
  const normalized = phones
    .map((phone) => ({
      type: phone.type,
      isPrimary: phone.isPrimary === true,
      number: normalizePhone((phone.number ?? "").trim()) ?? (phone.number ?? "").trim(),
    }))
    .filter((phone) => phone.number);

  if (!normalized.length) return undefined;

  const primary =
    normalized.find((phone) => phone.isPrimary) ??
    normalized.find((phone) => phone.type === PhoneType.Mobile) ??
    normalized[0];

  return primary?.number || undefined;
}

function getBirthdayIso(contact: ContactPayload) {
  const birthday = contact.birthday;
  if (!birthday?.month || !birthday?.day) return undefined;

  const month = String(birthday.month).padStart(2, "0");
  const day = String(birthday.day).padStart(2, "0");
  const year = birthday.year && birthday.year > 0 ? String(birthday.year).padStart(4, "0") : "0000";
  return `${year}-${month}-${day}`;
}

function normalizeContactName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isPriorityContactName(name: string) {
  const normalizedName = normalizeContactName(name);
  if (!normalizedName) return false;
  return PRIORITY_RELATIONSHIP_TERMS.some((term) => normalizedName.includes(term));
}

export function hasEmojiInName(name: string) {
  return EMOJI_PATTERN.test(name);
}

export function hasUpcomingBirthday(contact: ImportableContact, today = new Date()) {
  const upcomingBirthday = contact.birthday ? getNextBirthdayFromIso(contact.birthday, today) : null;
  if (!upcomingBirthday) return false;
  return upcomingBirthday.daysUntilBirthday >= 0 && upcomingBirthday.daysUntilBirthday <= 30;
}

export function compareImportableContacts(a: ImportableContact, b: ImportableContact, today = new Date()) {
  const aIsPriority = isPriorityContactName(a.name);
  const bIsPriority = isPriorityContactName(b.name);
  if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

  const aUpcomingBirthday = a.birthday ? getNextBirthdayFromIso(a.birthday, today) : null;
  const bUpcomingBirthday = b.birthday ? getNextBirthdayFromIso(b.birthday, today) : null;
  const aBirthdayInWindow = aUpcomingBirthday !== null && hasUpcomingBirthday(a, today);
  const bBirthdayInWindow = bUpcomingBirthday !== null && hasUpcomingBirthday(b, today);

  if (aBirthdayInWindow !== bBirthdayInWindow) return aBirthdayInWindow ? -1 : 1;
  if (aBirthdayInWindow && bBirthdayInWindow) {
    const diff = aUpcomingBirthday.daysUntilBirthday - bUpcomingBirthday.daysUntilBirthday;
    if (diff !== 0) return diff;
  }

  const aHasEmoji = hasEmojiInName(a.name);
  const bHasEmoji = hasEmojiInName(b.name);
  if (aHasEmoji !== bHasEmoji) return aHasEmoji ? -1 : 1;

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export function compareImportableContactsAlphabetically(a: ImportableContact, b: ImportableContact) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export async function ensureContactPermission() {
  const plugin = getCapacitorContactsPlugin();
  if (!plugin) return false;

  const checked = (await plugin.checkPermissions()) as PermissionStatus;
  if (checked.contacts === "granted" || checked.contacts === "limited") return true;

  const requested = (await plugin.requestPermissions()) as PermissionStatus;
  return requested.contacts === "granted" || requested.contacts === "limited";
}

export async function loadImportableContacts() {
  const plugin = getCapacitorContactsPlugin();
  if (!plugin) return [];
  const today = new Date();

  const result = await plugin.getContacts({
    projection: {
      name: true,
      phones: true,
      birthday: true,
    },
  });

  return ((result?.contacts ?? []) as ContactPayload[])
    .map((contact) => {
      const name = getContactDisplayName(contact);
      if (!name) return null;

      const mapped: ImportableContact = {
        contactId: contact.contactId,
        name,
      };
      const phone = getPrimaryPhone(contact);
      const birthday = getBirthdayIso(contact);
      if (phone) mapped.phone = phone;
      if (birthday) mapped.birthday = birthday;
      return mapped;
    })
    .filter((contact): contact is ImportableContact => Boolean(contact))
    .sort((a, b) => compareImportableContacts(a, b, today));
}

export function importableContactToPerson(contact: ImportableContact): Person {
  const personId = `imported-contact-${contact.contactId}`;
  return {
    id: personId,
    name: contact.name,
    phone: contact.phone,
    moments: contact.birthday
      ? [
          {
            id: `${personId}-birthday`,
            type: "birthday",
            label: "Birthday",
            date: contact.birthday,
            recurring: true,
          },
        ]
      : [],
    children: [],
  };
}
