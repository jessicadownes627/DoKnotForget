import { Contacts, type ContactPayload, type PermissionStatus, PhoneType } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import type { Person } from "../models/Person";
import { normalizePhone } from "./phone";

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

function addDays(baseDate: Date, days: number) {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + days);
}

function formatBirthdayFromNow(daysFromNow: number) {
  const target = addDays(new Date(), daysFromNow);
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const day = String(target.getDate()).padStart(2, "0");
  return `0000-${month}-${day}`;
}

function getDevMockContacts(): ImportableContact[] {
  return [
    { contactId: "dev-audra", name: "Audra", birthday: formatBirthdayFromNow(5) },
    { contactId: "dev-mike", name: "Mike", birthday: formatBirthdayFromNow(10) },
    { contactId: "dev-sarah", name: "Sarah", birthday: formatBirthdayFromNow(20) },
    { contactId: "dev-chris", name: "Chris" },
    { contactId: "dev-no-name", name: "No name saved" },
  ];
}

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

export async function ensureContactPermission() {
  if (import.meta.env.DEV && !getCapacitorContactsPlugin()) return true;

  const plugin = getCapacitorContactsPlugin();
  if (!plugin) return false;

  try {
    const checked = (await plugin.checkPermissions()) as PermissionStatus;
    if (checked.contacts === "granted" || checked.contacts === "limited") return true;

    const requested = (await plugin.requestPermissions()) as PermissionStatus;
    return requested.contacts === "granted" || requested.contacts === "limited";
  } catch {
    if (import.meta.env.DEV) return true;
    return false;
  }
}

export async function loadImportableContacts() {
  const plugin = getCapacitorContactsPlugin();
  if (!plugin) return import.meta.env.DEV ? getDevMockContacts() : [];

  try {
    const result = await plugin.getContacts({
      projection: {
        name: true,
        phones: true,
        birthday: true,
      },
    });

    const contacts = ((result?.contacts ?? []) as ContactPayload[])
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
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    if (import.meta.env.DEV && contacts.length === 0) return getDevMockContacts();
    return contacts;
  } catch {
    if (import.meta.env.DEV) return getDevMockContacts();
    throw new Error("Failed to load contacts");
  }
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
