import type { ReminderEvent } from "../engine/reminderEngine";
import type { UpcomingMomentEvent } from "../engine/momentEngine";
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

function buildReminderCardMap(reminders: ReminderEvent[]) {
  const cardsByEvent = new Map<string, ReminderEvent>();
  for (const reminder of reminders) {
    const key = reminderEventKey(reminder);
    const existing = cardsByEvent.get(key);
    if (!existing || reminderPriority(reminder) > reminderPriority(existing)) {
      cardsByEvent.set(key, reminder);
    }
  }
  return cardsByEvent;
}

function sortReminderCards(cardsByEvent: Map<string, ReminderEvent>) {
  return Array.from(cardsByEvent.values()).sort((a, b) => {
    if (a.eventDate !== b.eventDate) return a.eventDate.localeCompare(b.eventDate);
    return a.personName.localeCompare(b.personName, undefined, { sensitivity: "base" });
  });
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
  upcomingMoments,
  today,
  dismissedHorizonKeys,
}: Args) {
  const remindersByEventDate = reminders.filter((reminder) => {
    const eventDate = parseLocalDate(reminder.eventDate);
    return Boolean(eventDate);
  });

  const todayCardsByEvent = buildReminderCardMap(
    remindersByEventDate.filter((reminder) => {
      const eventDate = parseLocalDate(reminder.eventDate);
      return eventDate ? dayDifference(eventDate, today) === 0 : false;
    })
  );
  const activeTodayReminders = sortReminderCards(todayCardsByEvent);

  const tomorrowCardsByEvent = buildReminderCardMap(
    remindersByEventDate.filter((reminder) => {
      const eventDate = parseLocalDate(reminder.eventDate);
      return eventDate ? dayDifference(eventDate, today) === 1 : false;
    })
  );
  const tomorrowReminders = sortReminderCards(tomorrowCardsByEvent);

  const horizonMoments = upcomingMoments.filter((moment) => {
    if (dismissedHorizonKeys[moment.id]) return false;
    return true;
  });

  const cardsByEvent = new Map<string, { moment: UpcomingMomentEvent; reminder: ReminderEvent | null }>();
  for (const moment of horizonMoments) {
    const key = momentEventKey(moment);
    if (!cardsByEvent.has(key)) {
      cardsByEvent.set(key, { moment, reminder: null });
    }
  }

  for (const reminder of reminders) {
    const key = reminderEventKey(reminder);
    const existingCard = cardsByEvent.get(key);
    if (!existingCard) continue;
    if (!reminderMatchesMoment(reminder, existingCard.moment)) continue;

    const existingReminder = existingCard.reminder;
    if (!existingReminder || reminderPriority(reminder) > reminderPriority(existingReminder)) {
      cardsByEvent.set(key, { ...existingCard, reminder });
    }
  }
  const horizonEntries = Array.from(cardsByEvent.values()).sort((a, b) => {
    if (a.moment.eventDate !== b.moment.eventDate) return a.moment.eventDate.localeCompare(b.moment.eventDate);
    return a.moment.personName.localeCompare(b.moment.personName, undefined, { sensitivity: "base" });
  });

  return {
    activeTodayReminders,
    tomorrowReminders,
    horizonEntries,
  };
}
