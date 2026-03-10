import type { ReminderEvent } from "./reminderEngine";

const FIRED_REMINDERS_STORAGE_KEY = "dkf_fired_reminders";

type FiredReminderMap = Record<string, true>;

function readFiredReminders(): FiredReminderMap {
  try {
    const raw = window.localStorage.getItem(FIRED_REMINDERS_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const next: FiredReminderMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === true) next[key] = true;
    }
    return next;
  } catch {
    return {};
  }
}

function writeFiredReminders(reminders: FiredReminderMap) {
  try {
    window.localStorage.setItem(FIRED_REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  } catch {
    // ignore storage failures
  }
}

export function getReminderId(reminder: Pick<ReminderEvent, "personId" | "momentType" | "reminderType" | "date">) {
  return `${reminder.personId}-${reminder.momentType}-${reminder.reminderType}-${reminder.date}`;
}

export function hasReminderFired(reminderId: string): boolean {
  const reminders = readFiredReminders();
  return reminders[reminderId] === true;
}

export function markReminderFired(reminderId: string): void {
  const reminders = readFiredReminders();
  if (reminders[reminderId]) return;

  reminders[reminderId] = true;
  writeFiredReminders(reminders);
}
