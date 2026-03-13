import type { ReminderEvent } from "../engine/reminderEngine";
import type { UpcomingMomentEvent } from "../engine/momentEngine";
import { getReminderId } from "../engine/reminderRegistry";
import { parseLocalDate } from "./date";
import { eventKey } from "./eventKey";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDifference(from: Date, to: Date) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(from).getTime() - startOfDay(to).getTime()) / msPerDay);
}

function reminderEventKey(reminder: ReminderEvent) {
  return eventKey(reminder.personId, reminder.momentType, reminder.eventDate);
}

function momentEventKey(moment: UpcomingMomentEvent) {
  return eventKey(moment.personId, moment.momentType, moment.eventDate);
}

function normalizeReminderBaseLabel(reminder: ReminderEvent) {
  if (reminder.label.endsWith(" today")) return reminder.label.slice(0, -" today".length);
  if (reminder.label.endsWith(" tomorrow")) return reminder.label.slice(0, -" tomorrow".length);
  if (reminder.label.endsWith(" in 7 days")) return reminder.label.slice(0, -" in 7 days".length);
  return reminder.label;
}

function reminderPriority(reminder: ReminderEvent) {
  if (reminder.reminderType === "dayOf") return 3;
  if (reminder.reminderType === "oneDay") return 2;
  return 1;
}

function selectRepresentativeReminders(reminders: ReminderEvent[]) {
  const byEvent = new Map<string, ReminderEvent>();
  for (const reminder of reminders) {
    const key = reminderEventKey(reminder);
    const existing = byEvent.get(key);
    if (!existing || reminderPriority(reminder) > reminderPriority(existing)) {
      byEvent.set(key, reminder);
    }
  }
  return Array.from(byEvent.values()).sort((a, b) => {
    if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate);
    return a.personName.localeCompare(b.personName, undefined, { sensitivity: "base" });
  });
}

function selectRepresentativeReminder(reminders: ReminderEvent[]) {
  if (reminders.length === 0) return null;
  let best = reminders[0] ?? null;
  for (const reminder of reminders) {
    if (!best || reminderPriority(reminder) > reminderPriority(best)) {
      best = reminder;
    }
  }
  return best;
}

function reminderMatchesMoment(reminder: ReminderEvent, moment: UpcomingMomentEvent) {
  if (
    reminder.personId !== moment.personId ||
    reminder.momentType !== moment.momentType ||
    reminder.eventDate !== moment.eventDate
  ) {
    return false;
  }

  if (moment.momentType === "custom" || moment.momentType === "childBirthday") {
    return normalizeReminderBaseLabel(reminder).startsWith(moment.label);
  }

  return true;
}

type Args = {
  reminders: ReminderEvent[];
  activeReminders: ReminderEvent[];
  upcomingMoments: UpcomingMomentEvent[];
  today: Date;
  handledReminderActions: Record<string, true>;
  dismissedHorizonKeys: Record<string, true>;
};

export function buildHomeSections({
  reminders,
  activeReminders,
  upcomingMoments,
  today,
  handledReminderActions,
  dismissedHorizonKeys,
}: Args) {
  const activeRemindersByEventDate = activeReminders.filter((reminder) => {
    const eventDate = parseLocalDate(reminder.eventDate);
    return Boolean(eventDate);
  });

  const remindersByEventDate = reminders.filter((reminder) => {
    const eventDate = parseLocalDate(reminder.eventDate);
    return Boolean(eventDate);
  });

  const activeTodayReminders = selectRepresentativeReminders(activeRemindersByEventDate.filter((reminder) => {
    const eventDate = parseLocalDate(reminder.eventDate);
    return eventDate ? dayDifference(eventDate, today) === 0 : false;
  }));

  const tomorrowReminders = selectRepresentativeReminders(activeRemindersByEventDate.filter((reminder) => {
    const eventDate = parseLocalDate(reminder.eventDate);
    return eventDate ? dayDifference(eventDate, today) === 1 : false;
  }));

  const completedTodayReminders = selectRepresentativeReminders(remindersByEventDate.filter((reminder) => {
    const eventDate = parseLocalDate(reminder.eventDate);
    const isToday = eventDate ? dayDifference(eventDate, today) === 0 : false;
    return isToday && Boolean(handledReminderActions[getReminderId(reminder)]);
  }));

  const horizonMoments = upcomingMoments.filter((moment) => {
    if (dismissedHorizonKeys[moment.id]) return false;
    return true;
  });

  const horizonEntryMap = new Map<string, { moment: UpcomingMomentEvent; reminder: ReminderEvent | null }>();
  for (const moment of horizonMoments) {
    const key = momentEventKey(moment);
    if (horizonEntryMap.has(key)) continue;
    const matchingReminder = selectRepresentativeReminder(
      reminders.filter((reminder) => reminderMatchesMoment(reminder, moment))
    );
    horizonEntryMap.set(key, { moment, reminder: matchingReminder });
  }
  const horizonEntries = Array.from(horizonEntryMap.values());

  return {
    activeTodayReminders,
    completedTodayReminders,
    tomorrowReminders,
    horizonEntries,
  };
}
