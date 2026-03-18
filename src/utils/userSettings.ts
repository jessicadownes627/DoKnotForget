export type UserSettings = {
  notificationsEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notificationsEnabled: true,
  reminderHour: 9,
  reminderMinute: 0,
};

export const USER_SETTINGS_STORAGE_KEY = "doknotforget_user_settings";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeUserSettings(value: Partial<UserSettings> | null | undefined): UserSettings {
  const notificationsEnabled =
    typeof value?.notificationsEnabled === "boolean"
      ? value.notificationsEnabled
      : DEFAULT_USER_SETTINGS.notificationsEnabled;

  const reminderHour =
    typeof value?.reminderHour === "number" && Number.isFinite(value.reminderHour)
      ? clamp(Math.floor(value.reminderHour), 0, 23)
      : DEFAULT_USER_SETTINGS.reminderHour;

  const reminderMinute =
    typeof value?.reminderMinute === "number" && Number.isFinite(value.reminderMinute)
      ? clamp(Math.floor(value.reminderMinute), 0, 59)
      : DEFAULT_USER_SETTINGS.reminderMinute;

  return {
    notificationsEnabled,
    reminderHour,
    reminderMinute,
  };
}

export function loadUserSettings(): UserSettings {
  try {
    const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return DEFAULT_USER_SETTINGS;
    return normalizeUserSettings(parsed as Partial<UserSettings>);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings) {
  try {
    window.localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
