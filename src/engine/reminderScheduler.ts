import type { Person } from "../models/Person";
import { getUpcomingReminders, type ReminderEvent } from "./reminderEngine";
import { getReminderId, hasReminderFired } from "./reminderRegistry";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatYmd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getRemindersToFire(people: Person[], today = new Date()): ReminderEvent[] {
  const targetDate = formatYmd(startOfDay(today));
  const reminders = getUpcomingReminders(people, today);

  return reminders.filter((reminder) => {
    if (reminder.date !== targetDate) return false;

    const reminderId = getReminderId(reminder);
    return !hasReminderFired(reminderId);
  });
}
