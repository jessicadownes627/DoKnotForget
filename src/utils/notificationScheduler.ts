import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type Channel,
  type LocalNotificationDescriptor,
  type LocalNotificationSchema,
  type PermissionStatus,
} from "@capacitor/local-notifications";
import type { Person } from "../models/Person.js";
import type { Relationship } from "../models/Relationship.js";
import type { RelationshipV2Link } from "../models/RelationshipV2.js";
import type { ReminderEvent } from "../engine/reminderEngine";
import { getReminderId, hasReminderFired } from "../engine/reminderRegistry.js";
import { formatLocalYmd, parseLocalDate } from "./date.js";
import { buildRelationshipV2Links } from "./relationshipV2.js";
import { buildResolvedReminderLabel } from "./reminderRelationshipContext.js";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "./userSettings.js";

const REMINDER_NOTIFICATION_SOURCE = "dkf-reminder";
const HANDLED_REMINDER_ACTIONS_STORAGE_KEY = "doknotforget_handled_reminder_actions_v1";
const SCHEDULED_REMINDER_SIGNATURE_STORAGE_KEY = "doknotforget_scheduled_reminder_signature_v1";
export const REMINDER_NOTIFICATION_CATEGORY = "reminder";
const REMINDER_NOTIFICATION_CHANNEL: Channel = {
  id: REMINDER_NOTIFICATION_CATEGORY,
  name: "Reminders",
  description: "Birthday, anniversary, and important date reminders",
  importance: 5,
  vibration: true,
};

function hashReminderId(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function isNativeNotificationsSupported() {
  return Capacitor.getPlatform() !== "web";
}

export function getReminderNotificationId(reminder: ReminderEvent) {
  return hashReminderId(getReminderNotificationKey(reminder));
}

export function getReminderNotificationIdForReminderId(reminderId: string) {
  return hashReminderId(reminderId);
}

export function getReminderNudgeNotificationId(reminder: ReminderEvent) {
  return hashReminderId(`${getReminderNotificationKey(reminder)}_nudge`);
}

export function getReminderNudgeNotificationIdForReminderId(reminderId: string) {
  return hashReminderId(`${reminderId}_nudge`);
}

export function getReminderNotificationKey(reminder: ReminderEvent) {
  return getReminderId(reminder);
}

function hasReminderBeenHandled(reminderId: string) {
  try {
    const raw = window.localStorage.getItem(HANDLED_REMINDER_ACTIONS_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return false;
    return (parsed as Record<string, unknown>)[reminderId] === true;
  } catch {
    return false;
  }
}

export function buildReminderNotification(
  reminder: ReminderEvent,
  now = new Date(),
  userSettings: UserSettings = DEFAULT_USER_SETTINGS,
  people: Person[] = [],
  relationships: Relationship[] = [],
  relationshipLinksV2: RelationshipV2Link[] = []
): LocalNotificationSchema | null {
  if (hasReminderFired(getReminderId(reminder))) return null;

  const triggerDate = parseLocalDate(reminder.triggerDate || reminder.date);
  if (!triggerDate) return null;

  const reminderHour = userSettings.reminderHour ?? DEFAULT_USER_SETTINGS.reminderHour;
  const reminderMinute = userSettings.reminderMinute ?? DEFAULT_USER_SETTINGS.reminderMinute;

  const scheduledAt = new Date(
    triggerDate.getFullYear(),
    triggerDate.getMonth(),
    triggerDate.getDate(),
    reminderHour,
    reminderMinute,
    0,
    0
  );

  if (scheduledAt <= now) return null;
  // eslint-disable-next-line no-console
  console.log("[DKF DEBUG] Build reminder notification", {
    todayLocal: formatLocalYmd(now),
    personId: reminder.personId,
    personName: reminder.personName,
    birthdayEventDateLocal: reminder.eventDate,
    reminderTriggerDateLocal: reminder.triggerDate || reminder.date,
    handledKey: getReminderId(reminder),
    scheduledForLocal: formatLocalYmd(scheduledAt),
  });
  const reminderTitle =
    people.length > 0
      ? buildResolvedReminderLabel(
          reminder,
          people,
          relationships,
          new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          buildRelationshipV2Links({ people, relationships, persistedLinks: relationshipLinksV2 })
        )
      : reminder.label;
  return {
    id: getReminderNotificationId(reminder),
    title: reminderTitle,
    body: "Don’t forget to send a quick message or plan something thoughtful.",
    sound: "default",
    actionTypeId: REMINDER_NOTIFICATION_CATEGORY,
    channelId: REMINDER_NOTIFICATION_CATEGORY,
    threadIdentifier: REMINDER_NOTIFICATION_CATEGORY,
    schedule: {
      at: scheduledAt,
    },
    extra: {
      source: REMINDER_NOTIFICATION_SOURCE,
      variant: "primary",
      reminderId: getReminderNotificationKey(reminder),
      personId: reminder.personId,
      momentType: reminder.momentType,
      reminderType: reminder.reminderType,
      triggerDate: reminder.triggerDate,
      eventDate: reminder.eventDate,
    },
  };
}

export function buildReminderNudgeNotification(
  reminder: ReminderEvent,
  userSettings: UserSettings = DEFAULT_USER_SETTINGS,
  people: Person[] = [],
  relationships: Relationship[] = [],
  relationshipLinksV2: RelationshipV2Link[] = []
): LocalNotificationSchema | null {
  const reminderId = getReminderNotificationKey(reminder);
  if (reminder.reminderType !== "dayOf") return null;
  if (hasReminderBeenHandled(reminderId)) return null;

  const triggerDate = parseLocalDate(reminder.triggerDate || reminder.date);
  if (!triggerDate) return null;

  const reminderHour = userSettings.reminderHour ?? DEFAULT_USER_SETTINGS.reminderHour;
  const reminderMinute = userSettings.reminderMinute ?? DEFAULT_USER_SETTINGS.reminderMinute;

  const scheduledAt = new Date(
    triggerDate.getFullYear(),
    triggerDate.getMonth(),
    triggerDate.getDate(),
    reminderHour,
    reminderMinute,
    0,
    0
  );

  return {
    id: getReminderNudgeNotificationId(reminder),
    title:
      people.length > 0
        ? buildResolvedReminderLabel(
            reminder,
            people,
            relationships,
            new Date(),
            buildRelationshipV2Links({ people, relationships, persistedLinks: relationshipLinksV2 })
          )
        : reminder.label,
    body: "Still time to send a quick message or do something thoughtful.",
    sound: "default",
    actionTypeId: REMINDER_NOTIFICATION_CATEGORY,
    channelId: REMINDER_NOTIFICATION_CATEGORY,
    threadIdentifier: REMINDER_NOTIFICATION_CATEGORY,
    schedule: {
      at: new Date(scheduledAt.getTime() + 8 * 60 * 60 * 1000),
    },
    extra: {
      source: REMINDER_NOTIFICATION_SOURCE,
      variant: "nudge",
      reminderId,
      personId: reminder.personId,
      momentType: reminder.momentType,
      reminderType: reminder.reminderType,
      triggerDate: reminder.triggerDate,
      eventDate: reminder.eventDate,
    },
  };
}

export async function requestReminderNotificationPermission(): Promise<PermissionStatus | null> {
  if (!isNativeNotificationsSupported()) return null;

  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return current;
  return LocalNotifications.requestPermissions();
}

export async function configureReminderNotifications() {
  if (!isNativeNotificationsSupported()) return;

  await LocalNotifications.registerActionTypes({
    types: [{ id: REMINDER_NOTIFICATION_CATEGORY }],
  });

  if (Capacitor.getPlatform() === "android") {
    await LocalNotifications.createChannel(REMINDER_NOTIFICATION_CHANNEL);
  }
}

export async function cancelScheduledReminderNotifications(reminders?: ReminderEvent[]) {
  if (!isNativeNotificationsSupported()) return;

  let notifications: LocalNotificationDescriptor[];
  if (reminders?.length) {
    notifications = reminders.flatMap((reminder) => [
      { id: getReminderNotificationId(reminder) },
      { id: getReminderNudgeNotificationId(reminder) },
    ]);
  } else {
    const pending = await LocalNotifications.getPending();
    notifications = pending.notifications
      .filter((notification) => notification.extra?.source === REMINDER_NOTIFICATION_SOURCE)
      .map((notification) => ({ id: notification.id }));
  }

  if (!notifications.length) return;
  await LocalNotifications.cancel({ notifications });
  try {
    window.localStorage.removeItem(SCHEDULED_REMINDER_SIGNATURE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function cancelScheduledReminderNotificationByReminderId(reminderId: string) {
  if (!isNativeNotificationsSupported()) return;
  await LocalNotifications.cancel({
    notifications: [
      { id: getReminderNotificationIdForReminderId(reminderId) },
      { id: getReminderNudgeNotificationIdForReminderId(reminderId) },
    ],
  });
}

export async function scheduleReminderNotifications(
  reminders: ReminderEvent[],
  now = new Date(),
  userSettings: UserSettings = DEFAULT_USER_SETTINGS,
  people: Person[] = [],
  relationships: Relationship[] = [],
  relationshipLinksV2: RelationshipV2Link[] = []
) {
  if (!isNativeNotificationsSupported()) return;

  const notifications = reminders
    .flatMap((reminder) => [
      buildReminderNotification(reminder, now, userSettings, people, relationships, relationshipLinksV2),
      buildReminderNudgeNotification(reminder, userSettings, people, relationships, relationshipLinksV2),
    ])
    .filter((notification): notification is LocalNotificationSchema => Boolean(notification))
    .sort((left, right) => {
      const leftAt = left.schedule?.at instanceof Date ? left.schedule.at.getTime() : Number.MAX_SAFE_INTEGER;
      const rightAt = right.schedule?.at instanceof Date ? right.schedule.at.getTime() : Number.MAX_SAFE_INTEGER;
      return leftAt - rightAt;
    });

  if (!notifications.length) {
    await cancelScheduledReminderNotifications();
    return;
  }

  const signature = notifications
    .map((notification) => {
      const scheduledAt = notification.schedule?.at instanceof Date ? notification.schedule.at.toISOString() : "";
      return `${notification.id}:${scheduledAt}`;
    })
    .join("|");
  try {
    const existingSignature = window.localStorage.getItem(SCHEDULED_REMINDER_SIGNATURE_STORAGE_KEY);
    if (existingSignature === signature) return;
  } catch {
    // ignore
  }

  await cancelScheduledReminderNotifications();
  // eslint-disable-next-line no-console
  console.log("[DKF DEBUG] Schedule reminder notifications", {
    todayLocal: formatLocalYmd(now),
    count: notifications.length,
    notifications: notifications.map((notification) => ({
      notificationId: notification.id,
      scheduledForLocal: notification.schedule?.at instanceof Date ? formatLocalYmd(notification.schedule.at) : "",
      reminderId: notification.extra?.reminderId ?? "",
      eventDateLocal: notification.extra?.eventDate ?? "",
      triggerDateLocal: notification.extra?.triggerDate ?? "",
      variant: notification.extra?.variant ?? "",
    })),
  });
  await LocalNotifications.schedule({ notifications });
  try {
    window.localStorage.setItem(SCHEDULED_REMINDER_SIGNATURE_STORAGE_KEY, signature);
  } catch {
    // ignore
  }
}
