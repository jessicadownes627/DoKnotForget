import { parseLocalDate } from "../utils/date";
const REMINDER_SCHEDULE = [
    { daysBefore: 7, reminderType: "sevenDay" },
    { daysBefore: 1, reminderType: "oneDay" },
    { daysBefore: 0, reminderType: "dayOf" },
];
function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}
function formatYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}
function daysBetween(a, b) {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / msPerDay);
}
function possessive(name) {
    return name.endsWith("s") ? `${name}'` : `${name}'s`;
}
function parseYmdParts(value) {
    const [yStr, mStr, dStr] = value.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!yStr || !mStr || !dStr)
        return null;
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d))
        return null;
    if (m < 1 || m > 12 || d < 1 || d > 31)
        return null;
    return { y, m, d };
}
function getNextRecurringOccurrence(value, baseDate) {
    const parts = parseYmdParts(value);
    if (!parts)
        return null;
    const year = startOfDay(baseDate).getFullYear();
    const thisYear = new Date(year, parts.m - 1, parts.d);
    if (thisYear.getMonth() !== parts.m - 1 || thisYear.getDate() !== parts.d)
        return null;
    if (thisYear >= startOfDay(baseDate)) {
        return { date: thisYear, sourceYear: parts.y > 0 ? parts.y : null };
    }
    const nextYear = new Date(year + 1, parts.m - 1, parts.d);
    if (nextYear.getMonth() !== parts.m - 1 || nextYear.getDate() !== parts.d)
        return null;
    return { date: nextYear, sourceYear: parts.y > 0 ? parts.y : null };
}
function getNextAnniversaryOccurrence(person, baseDate) {
    const stored = (person.anniversary ?? "").trim();
    if (stored) {
        return getNextRecurringOccurrence(`0000-${stored}`, baseDate);
    }
    const moment = (person.moments ?? []).find((item) => item.type === "anniversary") ?? null;
    if (!moment?.date)
        return null;
    return getNextRecurringOccurrence(moment.date, baseDate);
}
function getAgeText(sourceYear, occurrenceYear) {
    if (!sourceYear || sourceYear <= 0)
        return null;
    const age = occurrenceYear - sourceYear;
    return age > 0 ? `turns ${age}` : null;
}
function dedupeMoments(moments) {
    const seen = new Set();
    return moments.filter((moment) => {
        const key = [moment.id, moment.type, moment.label.trim(), moment.date, moment.recurring ? "1" : "0"].join("|");
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
function collectEventsForPerson(person, baseDate) {
    const events = [];
    const birthday = (person.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
    if (birthday?.date) {
        const occurrence = getNextRecurringOccurrence(birthday.date, baseDate);
        if (occurrence) {
            events.push({
                personId: person.id,
                personName: person.name,
                momentType: "birthday",
                labelBase: `${possessive(person.name)} birthday`,
                eventDate: occurrence.date,
            });
        }
    }
    const anniversary = getNextAnniversaryOccurrence(person, baseDate);
    if (anniversary) {
        events.push({
            personId: person.id,
            personName: person.name,
            momentType: "anniversary",
            labelBase: `${possessive(person.name)} anniversary`,
            eventDate: anniversary.date,
        });
    }
    for (const child of person.children ?? []) {
        const childName = (child.name ?? "").trim();
        const birthdayValue = (child.birthday ?? child.birthdate ?? "").trim();
        if (!childName || !birthdayValue)
            continue;
        const occurrence = getNextRecurringOccurrence(birthdayValue, baseDate);
        if (!occurrence)
            continue;
        const ageText = getAgeText(occurrence.sourceYear, occurrence.date.getFullYear()) ?? undefined;
        events.push({
            personId: person.id,
            personName: person.name,
            momentType: "childBirthday",
            labelBase: childName,
            eventDate: occurrence.date,
            ageText,
        });
    }
    const customMoments = dedupeMoments([
        ...(person.moments ?? []).filter((moment) => moment.type === "custom"),
        ...(person.importantDates ?? []).filter((moment) => moment.type === "custom"),
    ]);
    for (const moment of customMoments) {
        if (!moment.date)
            continue;
        const occurrence = moment.recurring
            ? getNextRecurringOccurrence(moment.date, baseDate)
            : (() => {
                const parsed = parseLocalDate(moment.date);
                if (!parsed)
                    return null;
                return parsed >= startOfDay(baseDate) ? { date: parsed, sourceYear: parsed.getFullYear() } : null;
            })();
        if (!occurrence)
            continue;
        events.push({
            personId: person.id,
            personName: person.name,
            momentType: "custom",
            labelBase: `${moment.label} for ${person.name}`,
            eventDate: occurrence.date,
        });
    }
    return events;
}
function buildReminderLabel(event, reminderType) {
    if (event.momentType === "childBirthday") {
        const agePrefix = event.ageText ? `${event.labelBase} ${event.ageText}` : `${event.labelBase}'s birthday`;
        if (reminderType === "dayOf")
            return `${agePrefix} today`;
        if (reminderType === "oneDay")
            return `${agePrefix} tomorrow`;
        return `${agePrefix} in 7 days`;
    }
    if (reminderType === "dayOf")
        return `${event.labelBase} today`;
    if (reminderType === "oneDay")
        return `${event.labelBase} tomorrow`;
    return `${event.labelBase} in 7 days`;
}
export function getUpcomingReminders(people, today = new Date()) {
    const baseDate = startOfDay(today);
    const horizonDate = addDays(baseDate, 7);
    const reminders = [];
    for (const person of people) {
        if (!person?.id || !person.name?.trim())
            continue;
        const events = collectEventsForPerson(person, baseDate);
        for (const event of events) {
            for (const schedule of REMINDER_SCHEDULE) {
                const reminderDate = addDays(event.eventDate, -schedule.daysBefore);
                if (reminderDate < baseDate || reminderDate > horizonDate)
                    continue;
                reminders.push({
                    personId: event.personId,
                    personName: event.personName,
                    momentType: event.momentType,
                    label: buildReminderLabel(event, schedule.reminderType),
                    date: formatYmd(reminderDate),
                    triggerDate: formatYmd(reminderDate),
                    eventDate: formatYmd(event.eventDate),
                    reminderType: schedule.reminderType,
                });
            }
        }
    }
    reminders.sort((a, b) => {
        if (a.date !== b.date)
            return a.date.localeCompare(b.date);
        if (a.personName !== b.personName)
            return a.personName.localeCompare(b.personName, undefined, { sensitivity: "base" });
        if (a.momentType !== b.momentType)
            return a.momentType.localeCompare(b.momentType);
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    });
    return reminders;
}
export function getReminderEventsForDate(people, date) {
    const target = formatYmd(startOfDay(date));
    return getUpcomingReminders(people, date).filter((reminder) => reminder.date === target);
}
export function getDaysUntilReminder(reminder, today = new Date()) {
    const parsed = parseLocalDate(reminder.date);
    if (!parsed)
        return null;
    return daysBetween(parsed, today);
}
