const FIRED_REMINDERS_STORAGE_KEY = "dkf_fired_reminders";
function readFiredReminders() {
    try {
        const raw = window.localStorage.getItem(FIRED_REMINDERS_STORAGE_KEY);
        if (!raw)
            return {};
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object")
            return {};
        const next = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (value === true)
                next[key] = true;
        }
        return next;
    }
    catch {
        return {};
    }
}
function writeFiredReminders(reminders) {
    try {
        window.localStorage.setItem(FIRED_REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
    }
    catch {
        // ignore storage failures
    }
}
export function getReminderId(reminder) {
    return `${reminder.personId}-${reminder.momentType}-${reminder.reminderType}-${reminder.date}`;
}
export function hasReminderFired(reminderId) {
    const reminders = readFiredReminders();
    return reminders[reminderId] === true;
}
export function markReminderFired(reminderId) {
    const reminders = readFiredReminders();
    if (reminders[reminderId])
        return;
    reminders[reminderId] = true;
    writeFiredReminders(reminders);
}
