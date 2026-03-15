import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type Channel,
  type LocalNotificationDescriptor,
  type LocalNotificationSchema,
  type PermissionStatus,
} from "@capacitor/local-notifications";
import type { ReminderEvent } from "../engine/reminderEngine";
import { getReminderId, hasReminderFired } from "../engine/reminderRegistry";
import { parseLocalDate } from "./date";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "./userSettings";

const REMINDER_NOTIFICATION_SOURCE = "dkf-reminder";
const TEST_NOTIFICATION_SOURCE = "dkf-test-reminder";
const HANDLED_REMINDER_ACTIONS_STORAGE_KEY = "doknotforget_handled_reminder_actions_v1";
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
  userSettings: UserSettings = DEFAULT_USER_SETTINGS
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

  const effectiveAt = scheduledAt <= now ? new Date(now.getTime() + 5000) : scheduledAt;
  return {
    id: getReminderNotificationId(reminder),
    title: reminder.label,
    body: "Don’t forget to send a quick message or plan something thoughtful.",
    sound: "default",
    actionTypeId: REMINDER_NOTIFICATION_CATEGORY,
    channelId: REMINDER_NOTIFICATION_CATEGORY,
    threadIdentifier: REMINDER_NOTIFICATION_CATEGORY,
    schedule: {
      at: effectiveAt,
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
  userSettings: UserSettings = DEFAULT_USER_SETTINGS
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
    title: reminder.label,
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
  userSettings: UserSettings = DEFAULT_USER_SETTINGS
) {
  if (!isNativeNotificationsSupported()) return;

  const pending = await LocalNotifications.getPending();
  const existingIds = new Set(pending.notifications.map((notification) => notification.id));

  const notifications = reminders
    .flatMap((reminder) => [
      buildReminderNotification(reminder, now, userSettings),
      buildReminderNudgeNotification(reminder, userSettings),
    ])
    .filter((notification): notification is LocalNotificationSchema => Boolean(notification));
  const unscheduledNotifications = notifications.filter((notification) => !existingIds.has(notification.id));

  if (!unscheduledNotifications.length) return;
  await LocalNotifications.schedule({ notifications: unscheduledNotifications });
}

export async function scheduleTestReminderNotification() {
  if (!isNativeNotificationsSupported()) return;

  const now = new Date();
  const notificationId = hashReminderId(`${TEST_NOTIFICATION_SOURCE}:${now.getTime()}`);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: "Test Reminder",
        body: "Notification system is working.",
        sound: "default",
        actionTypeId: REMINDER_NOTIFICATION_CATEGORY,
        channelId: REMINDER_NOTIFICATION_CATEGORY,
        threadIdentifier: REMINDER_NOTIFICATION_CATEGORY,
        schedule: {
          at: new Date(now.getTime() + 60_000),
        },
        extra: {
          source: TEST_NOTIFICATION_SOURCE,
          scheduledAt: now.toISOString(),
        },
      },
    ],
  });
}
