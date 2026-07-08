export const DEFAULT_USER_SETTINGS = {
    notificationsEnabled: true,
    reminderHour: 9,
    reminderMinute: 0,
};
export const USER_SETTINGS_STORAGE_KEY = "doknotforget_user_settings";
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function normalizeUserSettings(value) {
    const notificationsEnabled = typeof value?.notificationsEnabled === "boolean"
        ? value.notificationsEnabled
        : DEFAULT_USER_SETTINGS.notificationsEnabled;
    const reminderHour = typeof value?.reminderHour === "number" && Number.isFinite(value.reminderHour)
        ? clamp(Math.floor(value.reminderHour), 0, 23)
        : DEFAULT_USER_SETTINGS.reminderHour;
    const reminderMinute = typeof value?.reminderMinute === "number" && Number.isFinite(value.reminderMinute)
        ? clamp(Math.floor(value.reminderMinute), 0, 59)
        : DEFAULT_USER_SETTINGS.reminderMinute;
    return {
        notificationsEnabled,
        reminderHour,
        reminderMinute,
    };
}
export function loadUserSettings() {
    try {
        const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
        if (!raw)
            return DEFAULT_USER_SETTINGS;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return DEFAULT_USER_SETTINGS;
        return normalizeUserSettings(parsed);
    }
    catch {
        return DEFAULT_USER_SETTINGS;
    }
}
export function saveUserSettings(settings) {
    try {
        window.localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
    catch {
        // ignore
    }
}
