import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "../models/Person";
import { openSmsComposer } from "../components/SoonReminderCard";
import Brand from "../components/Brand";
import BowIcon from "../components/BowIcon";
import PeopleIndex from "./PeopleIndex";
import { generateCareSuggestions } from "../utils/careSuggestions";
import { useLocation, useNavigate } from "../router";
import { useAppState } from "../appState";
import { getUpcomingReminders, type ReminderEvent } from "../engine/reminderEngine";
import { getUpcomingMoments } from "../engine/momentEngine";
import { getRemindersToFire } from "../engine/reminderScheduler";
import { getReminderId, markReminderFired } from "../engine/reminderRegistry";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  type AnniversaryPromptItem,
  type BirthdayPromptItem,
  type KidsBirthdayPromptItem,
  type PromptItem,
} from "../engine/promptEngine";
import { getNextBirthdayFromIso } from "../utils/birthdayUtils";
import MomentDatePicker from "../components/MomentDatePicker";
import { RaisedGoldBullet } from "../components/common/GoldBullets";
import GoldenSunDivider from "../components/GoldenSunDivider";
import ContactsSearchResults from "../components/ContactsSearchResults";
import { filterContacts } from "../utils/contactSearch";
import SmartMessageSuggestionsModal from "../components/SmartMessageSuggestionsModal";
import { parseLocalDate } from "../utils/date";
import { buildHomeSections } from "../utils/homeSections";
import {
  cancelScheduledReminderNotificationByReminderId,
  configureReminderNotifications,
  isNativeNotificationsSupported,
  requestReminderNotificationPermission,
  scheduleReminderNotifications,
} from "../utils/notificationScheduler";

const headerDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const homeHeaderDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const CHILD_QUICK_IDEAS = [
  "Send a silly GIF",
  "Drop off balloons",
  "Bring a cupcake",
  "Drop off a birthday card",
  "Bring a small toy or gift card",
  "Draw them a funny picture",
];

const TEEN_QUICK_IDEAS = [
  "Send a funny meme",
  "Send a Spotify song",
  "Share a throwback photo",
  "Send a funny TikTok",
];

const MILESTONE_QUICK_IDEAS = [
  "Send a throwback memory",
  "Plan a celebratory toast",
  "Call them today",
  "Send a celebratory message",
  "Bring balloons",
  "Drop off a small cake",
];

const MILESTONE_AGES = new Set([13, 16, 18, 21, 30, 40, 50, 60]);

const ADULT_QUICK_IDEAS = [
  "Drop off a cupcake",
  "Pick up flowers",
  "Buy a scratch-off ticket",
  "Send a funny meme",
  "Call and sing happy birthday",
  "Share a favorite memory",
  "Send a photo from the past",
  "Leave a voicemail surprise",
  "Send a song from Apple Music",
  "Tag them in a memory",
  "Send a GIF",
  "Write a quick compliment",
  "Drop off a bottle of wine",
  "Bring donuts",
  "Send a pizza",
  "Take them to lunch",
  "Send a Venmo treat",
  "Bring balloons",
  "Write a quick card",
  "Send a voice message",
  "Stop by with ice cream",
];

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function msUntilNextMidnight(from = new Date()) {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return Math.max(1000, next.getTime() - from.getTime());
}

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function careEventDisplayName(name: string) {
  const trimmed = name.trim();
  return trimmed || "them";
}

function careEventReminderNote(reminder: ReminderEvent) {
  const personName = careEventDisplayName(reminder.personName);

  if (reminder.momentType === "birthday") {
    return `Completed ${possessive(personName)} birthday reminder`;
  }

  if (reminder.momentType === "childBirthday") {
    return `Completed ${possessive(personName)} child's birthday reminder`;
  }

  if (reminder.momentType === "anniversary") {
    return `Completed ${possessive(personName)} anniversary reminder`;
  }

  if (reminder.label.trim()) {
    return `Completed ${personName}'s ${reminder.label.trim().toLowerCase()} reminder`;
  }

  return `Checked in with ${personName}`;
}

function reminderRelativeLabel(reminderType: ReminderEvent["reminderType"]) {
  if (reminderType === "dayOf") return "today";
  if (reminderType === "oneDay") return "tomorrow";
  return "in 7 days";
}

function reminderEventDate(reminder: ReminderEvent) {
  const parsed = parseLocalDate(reminder.date);
  if (!parsed) return null;
  const offset = reminder.reminderType === "dayOf" ? 0 : reminder.reminderType === "oneDay" ? 1 : 7;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate() + offset);
}

function formatGiftTypeLabel(value: string) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "Gift";
  if (normalized === "ecard") return "eCard";
  if (normalized === "coffee") return "Coffee";
  if (normalized === "gift") return "Gift";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function parseGiftHistoryDate(entry: { date: string; timestamp?: string }) {
  const precise = (entry.timestamp ?? "").trim();
  if (precise) {
    const parsed = new Date(precise);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = parseLocalDate(entry.date);
  return fallback ? new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()) : null;
}

function formatGiftHistoryLine(entry: { type: string; date: string; timestamp?: string }, now: Date) {
  const action = formatGiftTypeLabel(entry.type);
  const actionDate = parseGiftHistoryDate(entry);
  if (!actionDate) return `Last time you sent: ${action}`;

  const diffMs = Math.max(0, now.getTime() - actionDate.getTime());
  if (diffMs < 60 * 1000) return `Sent just now: ${action}`;

  const sameDay =
    now.getFullYear() === actionDate.getFullYear() &&
    now.getMonth() === actionDate.getMonth() &&
    now.getDate() === actionDate.getDate();
  if (sameDay) return `Sent today: ${action}`;

  return `Last time you sent: ${action}`;
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickQuickIdeas(seed: string, suggestions: string[]) {
  if (suggestions.length <= 2) return suggestions;

  const firstIndex = hashText(seed) % suggestions.length;
  const secondIndex = (firstIndex + 1 + (hashText(`${seed}:next`) % (suggestions.length - 1))) % suggestions.length;

  return [suggestions[firstIndex], suggestions[secondIndex]].filter(
    (idea, index, all) => all.indexOf(idea) === index
  );
}

function calculateAge(birthday: string | undefined, referenceDate = new Date()) {
  if (!birthday) return undefined;

  const [year, month, day] = birthday.split("-").map(Number);
  if (!year || !month || !day) return undefined;

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  let age = today.getFullYear() - year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age >= 0 ? age : undefined;
}

export default function Home({
}: {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, updatePerson, updatePersonFields, createPerson, recordCareEvent, userSettings } = useAppState();
  const [searchTerm, setSearchTerm] = useState("");
  const [questionTick, setQuestionTick] = useState(0);
  const [shouldPulseBow, setShouldPulseBow] = useState(false);
  const [showNiceStart, setShowNiceStart] = useState(false);
  const [handledReminderActions, setHandledReminderActions] = useState<Record<string, true>>(() => {
    try {
      const raw = window.localStorage.getItem("doknotforget_handled_reminder_actions_v1");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, true>;
    } catch {
      return {};
    }
  });
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<Record<string, true>>({});
  const [dismissedHorizonKeys] = useState<Record<string, true>>(() => {
    try {
      const raw = window.localStorage.getItem("doknotforget_dismissed_horizon_v1");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, true>;
    } catch {
      return {};
    }
  });
  const [smsSuggestions, setSmsSuggestions] = useState<null | {
    personName: string;
    phone: string;
    suggestions: Array<{ id: "quick" | "friendly" | "thoughtful" | "simple" | "custom"; label: string; message: string }>;
    onAfterSend?: () => void;
  }>(null);
  const previousPeopleCountRef = useRef<number>(people.length);
  const notificationPermissionRequestedRef = useRef(false);

  const [today, setToday] = useState(() => startOfToday());
  const isHome = location.pathname === "/" || location.pathname === "/home";
  const isContacts = location.pathname === "/contacts";
  const isSettings = location.pathname === "/settings";
  const activeTab: "home" | "contacts" = isContacts ? "contacts" : "home";
  const hasContacts = people.length > 0;

  useEffect(() => {
    function refreshToday() {
      setToday(startOfToday());
    }

    const timeoutId = window.setTimeout(function tick() {
      refreshToday();
      const intervalId = window.setInterval(refreshToday, 60 * 1000);
      (window as typeof window & { __dkfTodayInterval?: number }).__dkfTodayInterval = intervalId;
    }, msUntilNextMidnight());

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshToday();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      const intervalId = (window as typeof window & { __dkfTodayInterval?: number }).__dkfTodayInterval;
      if (intervalId) {
        window.clearInterval(intervalId);
        delete (window as typeof window & { __dkfTodayInterval?: number }).__dkfTodayInterval;
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  function seedDemoData() {
    const base = startOfToday();
    const pad2 = (n: number) => String(n).padStart(2, "0");
    const monthDayIso = (d: Date) => `0000-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    const mkBirthdayMoment = (personId: string, target: Date) => ({
      id: `${personId}-birthday`,
      type: "birthday" as const,
      label: "Birthday",
      date: monthDayIso(target),
      recurring: true,
    });

    const mkAnniversaryMoment = (personId: string, target: Date) => ({
      id: `${personId}-anniversary`,
      type: "anniversary" as const,
      label: "Anniversary",
      date: monthDayIso(target),
      recurring: true,
    });

    const todayDate = base;
    const tomorrowDate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    const plus5Date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 5);

    createPerson({
      id: "demo-emma",
      name: "Sample Contact A",
      phone: "+14155550101",
      moments: [mkBirthdayMoment("demo-emma", todayDate)],
    });

    createPerson({
      id: "demo-chris",
      name: "Sample Contact B",
      phone: "+14155550102",
      moments: [],
      hasKids: true,
      parentRole: "parent",
      children: [
        {
          id: "demo-liam",
          name: "Sample Child",
          birthday: monthDayIso(todayDate),
        },
      ],
    });

    createPerson({
      id: "demo-dad",
      name: "Sample Contact C",
      phone: "+14155550103",
      moments: [mkBirthdayMoment("demo-dad", plus5Date)],
    });

    createPerson({
      id: "demo-sarah",
      name: "Sample Contact D",
      phone: "+14155550104",
      moments: [mkAnniversaryMoment("demo-sarah", tomorrowDate)],
    });

    // Don’t show the “Nice start ⭐” banner for demo seeding.
    try {
      window.localStorage.removeItem("doknotforget_just_added_first_contact");
    } catch {
      // ignore
    }
  }

  function seedDevData() {
    if (!import.meta.env.DEV) return;
    seedDemoData();
  }

  useEffect(() => {
    if (!window.location.search.includes("demo=true")) return;
    if (people.length > 0) return;
    // Extra safety: never seed if storage already has people (guards against any hydration timing weirdness).
    try {
      const raw = window.localStorage.getItem("doknotforget_people");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return;
      }
    } catch {
      // ignore
    }
    seedDemoData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people.length]);

  useEffect(() => {
    try {
      window.localStorage.setItem("doknotforget_handled_reminder_actions_v1", JSON.stringify(handledReminderActions));
    } catch {
      // ignore
    }
  }, [handledReminderActions]);

  useEffect(() => {
    try {
      window.localStorage.setItem("doknotforget_dismissed_horizon_v1", JSON.stringify(dismissedHorizonKeys));
    } catch {
      // ignore
    }
  }, [dismissedHorizonKeys]);

  const [birthdayPickerPersonId, setBirthdayPickerPersonId] = useState<string | null>(null);
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");

  const [anniversaryPickerPersonId, setAnniversaryPickerPersonId] = useState<string | null>(null);
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");

  const [childBirthdayPicker, setChildBirthdayPicker] = useState<{ parentId: string; childId: string } | null>(null);
  const [childBirthdayDraftMonthDay, setChildBirthdayDraftMonthDay] = useState("");
  const [childBirthdayDraftYear, setChildBirthdayDraftYear] = useState("");

  const [partnerLinkPrompt, setPartnerLinkPrompt] = useState<{
    personId: string;
    partnerId: string;
    personName: string;
    partnerName: string;
  } | null>(null);
  const partnerLinkShownThisSession = useRef<Set<string>>(new Set());

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredPeople =
    normalizedSearch.length === 0
      ? people
      : people.filter((person) =>
          person.name.toLowerCase().includes(normalizedSearch)
        );

  const isSearching = activeTab === "contacts" && Boolean(searchTerm.trim());
  const contactSearchResults = useMemo(() => {
    const matched = filterContacts(people, searchTerm);
    return [...matched].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [people, searchTerm]);

  const careSuggestions = useMemo(() => {
    if (activeTab !== "home") return [];
    return generateCareSuggestions(filteredPeople, today);
  }, [activeTab, filteredPeople, today, questionTick]);

  const reminders = useMemo(() => {
    if (activeTab !== "home") return [];
    return getUpcomingReminders(people, today);
  }, [activeTab, people, today]);

  const activeReminders = useMemo(() => {
    return reminders.filter((reminder) => {
      const reminderId = getReminderId(reminder);
      return !dismissedReminderKeys[reminderId];
    });
  }, [dismissedReminderKeys, reminders]);

  const upcomingMoments = useMemo(() => {
    if (activeTab !== "home") return [];
    return getUpcomingMoments(people, today, 30);
  }, [activeTab, people, today]);

  const homeSections = useMemo(
    () =>
      buildHomeSections({
        reminders,
        activeReminders,
        upcomingMoments,
        today,
        handledReminderActions,
        dismissedHorizonKeys,
      }),
    [activeReminders, dismissedHorizonKeys, handledReminderActions, reminders, today, upcomingMoments]
  );

  useEffect(() => {
    if (activeTab !== "home") return;
    let cancelled = false;

    async function deliverReminders() {
      if (isNativeNotificationsSupported()) return;
      const remindersToFire = getRemindersToFire(people, today);
      if (remindersToFire.length === 0 || cancelled) return;

      let permission: NotificationPermission | "unsupported" = "unsupported";

      if (typeof window !== "undefined" && "Notification" in window) {
        permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
      }

      if (cancelled) return;

      if (permission === "granted") {
        if (remindersToFire.length === 1) {
          const reminder = remindersToFire[0];
          if (!reminder) return;

          const notification = new Notification("DoKnotForget Reminder", {
            body: reminder.label,
            data: { personId: reminder.personId },
          });
          notification.onclick = () => {
            window.focus();
          };
        } else {
          const lines = remindersToFire.slice(0, 3).map((reminder) => `• ${reminder.label}`);
          const notification = new Notification("DoKnotForget", {
            body: `${remindersToFire.length} reminders today:\n${lines.join("\n")}`,
            data: { personId: remindersToFire[0]?.personId ?? null },
          });
          notification.onclick = () => {
            window.focus();
          };
        }
      } else {
        const message =
          remindersToFire.length === 1
            ? `Reminder: ${remindersToFire[0]?.label ?? ""}`
            : `${remindersToFire.length} reminders today:\n${remindersToFire
                .slice(0, 3)
                .map((reminder) => `• ${reminder.label}`)
                .join("\n")}`;
        window.alert(message);
      }

      for (const reminder of remindersToFire) {
        markReminderFired(getReminderId(reminder));
      }
    }

    void deliverReminders();

    return () => {
      cancelled = true;
    };
  }, [activeTab, people, today]);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return;
    if (people.length === 0) return;
    if (notificationPermissionRequestedRef.current) return;

    let cancelled = false;

    async function ensureNotificationPermission() {
      await configureReminderNotifications();
      const status = await requestReminderNotificationPermission();
      if (cancelled || !status) return;
      if (status.display === "granted" || status.display === "denied") {
        notificationPermissionRequestedRef.current = true;
      }
    }

    void ensureNotificationPermission();

    return () => {
      cancelled = true;
    };
  }, [people.length]);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return;

    let cancelled = false;

    async function syncNativeReminderNotifications() {
      await configureReminderNotifications();
      const permission = await LocalNotifications.checkPermissions();
      if (cancelled || permission.display !== "granted") return;

      await scheduleReminderNotifications(reminders, new Date(), userSettings);
    }

    void syncNativeReminderNotifications();

    return () => {
      cancelled = true;
    };
  }, [reminders, people, today, userSettings]);

  useEffect(() => {
    if (!isNativeNotificationsSupported()) return;

    let receivedHandle: { remove: () => Promise<void> } | null = null;
    let actionHandle: { remove: () => Promise<void> } | null = null;

    function markDeliveredReminder(notification: { extra?: { reminderId?: string } }) {
      const reminderId = notification.extra?.reminderId;
      if (!reminderId) return;
      markReminderFired(reminderId);
    }

    void LocalNotifications.addListener("localNotificationReceived", (notification) => {
      markDeliveredReminder(notification);
    }).then((handle) => {
      receivedHandle = handle;
    });

    void LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
      markDeliveredReminder(notification);
    }).then((handle) => {
      actionHandle = handle;
    });

    return () => {
      void receivedHandle?.remove();
      void actionHandle?.remove();
    };
  }, []);

  function formatReminderDate(value: string) {
    const parsed = parseLocalDate(value);
    if (!parsed) return value;
    return headerDateFormatter.format(parsed);
  }

  function formatReminderCard(reminder: ReminderEvent) {
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const personName = person?.name ?? reminder.personName;
    const relative = reminderRelativeLabel(reminder.reminderType);

    if (reminder.momentType === "birthday") {
      return {
        title: personName,
        label: `${possessive(personName)} birthday ${relative}`,
      };
    }

    if (reminder.momentType === "anniversary") {
      const partner = person?.partnerId ? people.find((candidate) => candidate.id === person.partnerId) ?? null : null;
      const combinedNames = partner ? `${personName} & ${partner.name}` : null;
      return {
        title: combinedNames ?? personName,
        label: combinedNames ? `${combinedNames} anniversary ${relative}` : `${possessive(personName)} anniversary ${relative}`,
      };
    }

    if (reminder.momentType === "childBirthday") {
      const eventDate = reminderEventDate(reminder);
      const matchingChild =
        person?.children?.find((child) => {
          const birthdayValue = (child.birthday ?? child.birthdate ?? "").trim();
          if (!birthdayValue) return false;
          const nextBirthday = getNextBirthdayFromIso(birthdayValue, today);
          if (!nextBirthday || !eventDate) return false;
          return nextBirthday.target.getTime() === eventDate.getTime();
        }) ?? null;

      if (!matchingChild) {
        return {
          title: `${possessive(personName)} child`,
          label: reminder.label,
        };
      }

      const childName = (matchingChild.name ?? "").trim() || "Your child";
      const sourceYear = Number((matchingChild.birthday ?? matchingChild.birthdate ?? "").split("-")[0] ?? 0);
      const age = eventDate && sourceYear > 0 ? eventDate.getFullYear() - sourceYear : null;
      return {
        title: `${possessive(personName)} child`,
        label: age && age > 0 ? `${childName} turns ${age} ${relative}` : `${childName}'s birthday ${relative}`,
      };
    }

    return {
      title: personName,
      label: reminder.label,
    };
  }

  function stripRelativeSuffix(label: string, relative: "today" | "tomorrow") {
    const suffix = ` ${relative}`;
    return label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
  }

  function buildReminderDisplay(reminder: ReminderEvent, section: "today" | "tomorrow" | "horizon") {
    const display = formatReminderCard(reminder);
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const latestGift = person?.giftHistory?.length ? person.giftHistory[person.giftHistory.length - 1] : null;
    const personName = (person?.name ?? reminder.personName).trim();
    const firstName = personName.split(" ")[0] || reminder.personName || "them";
    const eventDate = reminderEventDate(reminder);

    let reminderAge: number | undefined;
    let birthdayForAge: string | undefined;
    if (reminder.momentType === "childBirthday") {
      const matchingChild =
        person?.children?.find((child) => {
          const birthdayValue = (child.birthday ?? child.birthdate ?? "").trim();
          if (!birthdayValue) return false;
          const nextBirthday = getNextBirthdayFromIso(birthdayValue, today);
          if (!nextBirthday || !eventDate) return false;
          return nextBirthday.target.getTime() === eventDate.getTime();
        }) ?? null;

      birthdayForAge = (matchingChild?.birthday ?? matchingChild?.birthdate ?? "").trim() || undefined;
    } else {
      const birthdayMoment = (person?.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
      birthdayForAge = (birthdayMoment?.date ?? "").trim() || undefined;
    }

    reminderAge = birthdayForAge && eventDate ? calculateAge(birthdayForAge, eventDate) : undefined;
    const ideaPool =
      reminderAge !== undefined && MILESTONE_AGES.has(reminderAge)
        ? MILESTONE_QUICK_IDEAS
        : reminderAge !== undefined && reminderAge < 13
        ? CHILD_QUICK_IDEAS
        : reminderAge !== undefined && reminderAge < 18
          ? TEEN_QUICK_IDEAS
          : ADULT_QUICK_IDEAS;

    let title = display.label;
    if (section === "today" && reminder.reminderType === "oneDay") {
      title = `Tomorrow: ${stripRelativeSuffix(display.label, "tomorrow")}`;
    } else if (section === "tomorrow" && reminder.reminderType === "dayOf") {
      title = stripRelativeSuffix(display.label, "today");
    } else if (section === "horizon") {
      title =
        reminder.momentType === "childBirthday"
          ? stripRelativeSuffix(stripRelativeSuffix(display.label, "today"), "tomorrow").replace(/ in 7 days$/, "")
          : stripRelativeSuffix(stripRelativeSuffix(display.label, "today"), "tomorrow").replace(/ in 7 days$/, "");
    } else if (
      section === "today" &&
      reminder.reminderType === "dayOf" &&
      reminder.momentType === "birthday" &&
      reminderAge !== undefined &&
      MILESTONE_AGES.has(reminderAge)
    ) {
      title = `${personName} turns ${reminderAge} today 🎉`;
    }

    return {
      title,
      date: formatReminderDate(eventDate ? formatYmd(eventDate) : reminder.date),
      giftLine: latestGift ? formatGiftHistoryLine(latestGift, new Date()) : null,
      ideaHeading:
        reminder.reminderType === "dayOf" && section === "today" ? `A small way to brighten ${possessive(firstName)} day` : null,
      ideas: reminder.reminderType === "dayOf" && section === "today" ? pickQuickIdeas(getReminderId(reminder), ideaPool) : [],
    };
  }

  function markReminderHandled(reminder: ReminderEvent) {
    const reminderId = getReminderId(reminder);
    markReminderFired(reminderId);
    void cancelScheduledReminderNotificationByReminderId(reminderId);
    setHandledReminderActions((prev) => {
      if (prev[reminderId]) return prev;
      return { ...prev, [reminderId]: true };
    });
    setDismissedReminderKeys((prev) => ({ ...prev, [reminderId]: true }));
  }

  function dismissReminderCard(reminder: ReminderEvent) {
    recordCareEvent(reminder.personId, "reminderComplete", careEventReminderNote(reminder));
    markReminderHandled(reminder);
  }

  function recordGiftHistoryAction(reminder: ReminderEvent, type: "coffee" | "ecard" | "gift") {
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    if (!person) return;

    const timestamp = new Date().toISOString();
    updatePerson({
      ...person,
      giftHistory: [
        ...(person.giftHistory ?? []),
        {
          type,
          date: timestamp.slice(0, 10),
          timestamp,
        },
      ],
    });

    const note =
      type === "coffee"
        ? `Bought ${person.name} a coffee`
        : type === "ecard"
          ? `Sent ${person.name} an eCard`
          : `Sent ${person.name} a gift`;
    recordCareEvent(person.id, type, note);
  }

  function careEventNoteForReminderText(reminder: ReminderEvent) {
    const personName = careEventDisplayName(reminder.personName);
    if (reminder.momentType === "birthday") return `Texted ${personName} for their birthday`;
    if (reminder.momentType === "childBirthday") return `Texted ${personName} about their child's birthday`;
    if (reminder.momentType === "anniversary") return `Texted ${personName} for their anniversary`;
    return `Texted ${personName}`;
  }

  function reminderTextActionLabel(reminder: ReminderEvent, person: Person | null) {
    const first = ((person?.name ?? reminder.personName).trim().split(" ")[0] || reminder.personName || "them").trim();

    if (reminder.momentType === "childBirthday") {
      const childLine = formatReminderCard(reminder).label;
      const childName = childLine.split(" turns ")[0]?.split("'s birthday")[0]?.trim() || "child";
      return `Text ${first} (${childName}'s parent)`;
    }

    return `Text ${first}`;
  }

  function buildReminderActions(reminder: ReminderEvent) {
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const first = ((person?.name ?? reminder.personName).trim().split(" ")[0] || reminder.personName || "them").trim();

    if (reminder.reminderType === "sevenDay") {
      return [
        {
          label: "Send gift",
          href: "https://www.starbucks.com/gift",
          onClick: () => recordGiftHistoryAction(reminder, "gift"),
        },
      ];
    }

    if (reminder.reminderType === "oneDay") {
      return [
        {
          label: `Send ${first} an eCard`,
          href: "https://www.americangreetings.com/ecards",
          onClick: () => recordGiftHistoryAction(reminder, "ecard"),
        },
        {
          label: "Send gift",
          href: "https://www.starbucks.com/gift",
          onClick: () => recordGiftHistoryAction(reminder, "gift"),
        },
      ];
    }

    return [
      {
        label: reminderTextActionLabel(reminder, person),
        title: !person?.phone ? "Add a phone number to text them." : undefined,
        onClick: () => {
          if (!person?.phone) {
            window.alert("Add a phone number to text them.");
            return;
          }

          const toName = (person.name ?? "").trim().split(" ")[0] || person.name || first;
          const display = formatReminderCard(reminder);
          const childLine = display.label;
          const childName = childLine.split(" turns ")[0]?.split("'s birthday")[0]?.trim() || "";

          const isBirthday = reminder.momentType === "birthday";
          const isKidBirthday = reminder.momentType === "childBirthday";
          const isAnniversary = reminder.momentType === "anniversary";

          const quick = isKidBirthday
            ? `Happy birthday to ${childName || "your child"}! Hope it's a great day.`
            : isBirthday
              ? `Happy birthday ${toName}! Hope it's a great day.`
              : isAnniversary
                ? `Happy anniversary, ${toName}! Hope it's a great day.`
                : "Thinking of you today. Hope things go well.";

          const friendly = isKidBirthday
            ? `Hope ${childName || "your child"} is having a great birthday today!`
            : isBirthday
              ? "Hope you’re having a great birthday today!"
              : isAnniversary
                ? "Hope you’re having a great anniversary today!"
                : "Hope today goes well — thinking of you.";

          const thoughtful = isKidBirthday
            ? `Thinking of ${childName || "your child"} today and hoping it’s a really special birthday.`
            : isBirthday
              ? "Thinking of you today and hoping it’s a really special birthday."
              : isAnniversary
                ? "Thinking of you today and hoping your anniversary feels special."
                : "Just wanted to check in — thinking of you today and hoping everything goes smoothly.";

          const simple = isKidBirthday
            ? `Happy birthday to ${childName || "your child"}. Hope it's a good one.`
            : isBirthday
              ? "Happy birthday. Hope it's a good one."
              : isAnniversary
                ? "Happy anniversary. Hope it's a good one."
                : "Thinking of you today.";

          openSmartMessageSuggestions({
            personName: toName,
            phone: person.phone,
            suggestions: [
              { id: "quick", label: "Quick", message: quick },
              { id: "friendly", label: "Friendly", message: friendly },
              { id: "thoughtful", label: "Thoughtful", message: thoughtful },
              { id: "simple", label: "Simple", message: simple },
              { id: "custom", label: "Write my own", message: "" },
            ],
            onAfterSend: () => {
              recordCareEvent(person.id, "text", careEventNoteForReminderText(reminder));
              markReminderHandled(reminder);
            },
          });
        },
      },
      {
        label: `Send ${first} an eCard`,
        href: "https://www.americangreetings.com/ecards",
        onClick: () => recordGiftHistoryAction(reminder, "ecard"),
      },
      {
        label: `Treat ${first} to a coffee`,
        href: "https://www.starbucks.com/gift",
        onClick: () => recordGiftHistoryAction(reminder, "coffee"),
      },
      {
        label: "✓ Mark as done",
        onClick: () => dismissReminderCard(reminder),
      },
    ];
  }

  function promptYear(prompt: PromptItem) {
    return "year" in prompt ? prompt.year : new Date().getFullYear();
  }

  function promptDismissKey(prompt: PromptItem) {
    const year = promptYear(prompt);
    const base =
      "personId" in prompt
        ? `${prompt.personId}`
        : "parentId" in prompt && "childId" in prompt
          ? `${prompt.parentId}_${prompt.childId}`
          : "unknown";
    return `doknotforget_prompt_dismissed_${year}_${prompt.type}_${base}`;
  }

  function dismissPrompt(prompt: PromptItem) {
    try {
      window.localStorage.setItem(promptDismissKey(prompt), "1");
    } catch {
      // ignore
    }
  }

  function openSmartMessageSuggestions(args: {
    personName: string;
    phone: string;
    suggestions: Array<{ id: "quick" | "friendly" | "thoughtful" | "simple" | "custom"; label: string; message: string }>;
    onAfterSend?: () => void;
  }) {
    setSmsSuggestions(args);
  }

  function formatYmd(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseYmd(value: string) {
    const [yStr, mStr, dStr] = value.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!yStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return { y, m, d };
  }

  function toDraftFromIso(value: string) {
    const parts = parseYmd(value);
    if (!parts) return { monthDay: "", year: "" };
    const mm = String(parts.m).padStart(2, "0");
    const dd = String(parts.d).padStart(2, "0");
    return { monthDay: `2000-${mm}-${dd}`, year: parts.y > 0 ? String(parts.y) : "" };
  }

  function buildBirthdayIso(monthDay: string, year: string) {
    if (!monthDay) return "";
    const parts = parseYmd(monthDay);
    if (!parts) return "";
    const mm = String(parts.m).padStart(2, "0");
    const dd = String(parts.d).padStart(2, "0");
    const y = year.trim();
    if (!y) return `0000-${mm}-${dd}`;
    return `${y.padStart(4, "0")}-${mm}-${dd}`;
  }

  function addCustomMomentIfMissing(person: Person, label: string, date: string) {
    const exists = (person.moments ?? []).some((m) => m.type === "custom" && m.label === label && m.date === date);
    if (exists) return person;
    return {
      ...person,
      moments: [
        ...(person.moments ?? []),
        { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: "custom" as const, label, date, recurring: false },
      ],
    };
  }

  function isoToDate(iso: string) {
    return parseLocalDate(iso);
  }

  function addDays(date: Date, deltaDays: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + deltaDays);
  }

  function monthDayFromPicker(value: string) {
    const parts = parseYmd(value);
    if (!parts) return "";
    const mm = String(parts.m).padStart(2, "0");
    const dd = String(parts.d).padStart(2, "0");
    return `${mm}-${dd}`;
  }

  function upsertAnniversaryMoment(person: Person, mmdd: string) {
    const [mm, dd] = mmdd.split("-");
    if (!mm || !dd) return person;
    const iso = `0000-${mm}-${dd}`;
    const existing = (person.moments ?? []).find((m) => m.type === "anniversary") ?? null;
    const updated = existing
      ? { ...existing, date: iso, recurring: true, label: existing.label || "Anniversary" }
      : { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: "anniversary" as const, label: "Anniversary", date: iso, recurring: true };
    const others = (person.moments ?? []).filter((m) => m.type !== "anniversary");
    return { ...person, moments: [updated, ...others] };
  }

  function handleBirthdayPromptYes(prompt: BirthdayPromptItem) {
    if (prompt.type === "DISCOVER_BIRTHDAY") {
      const person = people.find((p) => p.id === prompt.personId) ?? null;
      if (!person) return;
      const birthdayMoment = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
      const draft = birthdayMoment?.date ? toDraftFromIso(birthdayMoment.date) : { monthDay: "", year: "" };
      setBirthdayDraftMonthDay(draft.monthDay);
      setBirthdayDraftYear(draft.year);
      setBirthdayPickerPersonId(person.id);
      return;
    }

    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (!person) {
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "PREP_BIRTHDAY") {
      const bday = isoToDate(prompt.birthdayIso);
      if (bday) {
        const target = addDays(bday, -3);
        const prepDate = target < today ? formatYmd(today) : formatYmd(target);
        updatePerson(addCustomMomentIfMissing(person, "Birthday Prep", prepDate));
      }
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "TOMORROW_BIRTHDAY" || prompt.type === "TODAY_BIRTHDAY") {
      const first = (person.name ?? "").trim().split(" ")[0] || person.name;
      const message = `Happy birthday ${first}! Hope you have a great day 🎉`;
      if (person.phone) openSmsComposer(person.phone, message);
      dismissPrompt(prompt);
    }
  }

  function handleBirthdayPromptNo(prompt: BirthdayPromptItem) {
    // "Not now" / "Skip" = dismiss.
    dismissPrompt(prompt);
  }

  function handleAnniversaryPromptYes(prompt: AnniversaryPromptItem) {
    if (prompt.type === "DISCOVER_ANNIVERSARY") {
      const person = people.find((p) => p.id === prompt.personId) ?? null;
      if (!person) return;
      const existing = (person.anniversary ?? "").trim();
      if (existing) {
        const [mm, dd] = existing.split("-");
        if (mm && dd) setAnniversaryDraftMonthDay(`2000-${mm}-${dd}`);
      } else {
        setAnniversaryDraftMonthDay("");
      }
      setAnniversaryDraftYear("");
      setAnniversaryPickerPersonId(person.id);
      return;
    }

    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (!person) {
      dismissPrompt(prompt);
      return;
    }
    const partner = people.find((p) => p.id === prompt.partnerId) ?? null;
    if (!partner) {
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "PREP_ANNIVERSARY") {
      const ann = isoToDate(prompt.anniversaryIso);
      if (ann) {
        const target = addDays(ann, -3);
        const prepDate = target < today ? formatYmd(today) : formatYmd(target);
        updatePerson(addCustomMomentIfMissing(person, `Anniversary Prep \u2013 ${partner.name}`, prepDate));
      }
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "ANNIVERSARY_TOMORROW" || prompt.type === "ANNIVERSARY_TODAY") {
      if (partner.phone) openSmsComposer(partner.phone, `Happy anniversary, ${partner.name}!`);
      dismissPrompt(prompt);
    }
  }

  function handleAnniversaryPromptNo(prompt: AnniversaryPromptItem) {
    if (prompt.type === "DISCOVER_ANNIVERSARY") {
      updatePersonFields(prompt.personId, { anniversary: null });
    }
    dismissPrompt(prompt);
  }

  function handleKidsBirthdayPromptYes(prompt: KidsBirthdayPromptItem) {
    if (prompt.type === "DISCOVER_CHILD_BIRTHDAY") {
      const parent = people.find((p) => p.id === prompt.parentId) ?? null;
      const child = parent?.children?.find((c) => c.id === prompt.childId) ?? null;
      if (!parent || !child) return;

      const draft = (child.birthday ?? child.birthdate) ? toDraftFromIso(child.birthday ?? child.birthdate ?? "") : { monthDay: "", year: "" };
      setChildBirthdayDraftMonthDay(draft.monthDay);
      setChildBirthdayDraftYear(draft.year);
      setChildBirthdayPicker({ parentId: parent.id, childId: child.id });
      return;
    }

    const parent = people.find((p) => p.id === prompt.parentId) ?? null;
    if (!parent) {
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "PREP_CHILD_BIRTHDAY") {
      const bday = isoToDate(prompt.birthdayIso);
      if (bday) {
        const target = addDays(bday, -2);
        const prepDate = target < today ? formatYmd(today) : formatYmd(target);
        updatePerson(addCustomMomentIfMissing(parent, `Plan something for ${prompt.childName}`, prepDate));
      }
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "TOMORROW_CHILD_BIRTHDAY") {
      if (parent.phone) openSmsComposer(parent.phone, `Tomorrow is ${prompt.childName}’s birthday.`);
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "TODAY_CHILD_BIRTHDAY") {
      if (parent.phone) openSmsComposer(parent.phone, `Happy birthday to ${prompt.childName}!`);
      dismissPrompt(prompt);
      return;
    }
  }

  function handleKidsBirthdayPromptNo(prompt: KidsBirthdayPromptItem) {
    dismissPrompt(prompt);
  }

  const unsnoozedCareSuggestions = useMemo(() => {
    const now = Date.now();
    function isSnoozed(cardId: string) {
      try {
        const raw = window.localStorage.getItem(`doknotforget_snooze_${cardId}`);
        if (!raw) return false;
        const ts = Number(raw);
        if (Number.isNaN(ts)) return false;
        return ts > now;
      } catch {
        return false;
      }
    }

    return careSuggestions.filter((s) => {
      if (s.type === "question") return true;
      return !isSnoozed(s.id);
    });
  }, [careSuggestions]);

  const visibleCareSuggestions = useMemo(() => {
    const cooldownMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    function isFreshForPerson(personId: string, questionId: string) {
      const keys = [
        `doknotforget_question_answered_${personId}_${questionId}`,
        `doknotforget_question_snoozed_${personId}_${questionId}`,
        `doknotforget_question_seen_${personId}_${questionId}`,
        `doknotforget_question_person_seen_${personId}`,
      ];
      try {
        for (const k of keys) {
          const raw = window.localStorage.getItem(k);
          if (!raw) continue;
          const at = Number(raw);
          if (Number.isNaN(at)) continue;
          if (now - at < cooldownMs) return false;
        }
      } catch {
        // ignore
      }
      return true;
    }

    const sessionHasQuestion =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("doknotforget_session_microquestion_shown") === "1";

    const questions = unsnoozedCareSuggestions.filter((s) => s.type === "question" && s.question);
    const firstEligibleQuestion =
      sessionHasQuestion
        ? null
        : (questions.find((q) => q.question && isFreshForPerson(q.personId, q.question.id)) ?? null);

    return unsnoozedCareSuggestions.filter((s) => {
      if (s.type !== "question" || !s.question) return true;
      if (!firstEligibleQuestion) return false;
      return s.id === firstEligibleQuestion.id;
    });
  }, [unsnoozedCareSuggestions]);

  const activeQuestion = useMemo(() => {
    return visibleCareSuggestions.find((s) => s.type === "question" && s.question) ?? null;
  }, [visibleCareSuggestions]);

  useEffect(() => {
    if (!activeQuestion?.question) return;
    try {
      window.sessionStorage.setItem("doknotforget_session_microquestion_shown", "1");
    } catch {
      // ignore
    }

    try {
      const now = String(Date.now());
      window.localStorage.setItem(
        `doknotforget_question_seen_${activeQuestion.personId}_${activeQuestion.question.id}`,
        now
      );
      window.localStorage.setItem(`doknotforget_question_person_seen_${activeQuestion.personId}`, now);
    } catch {
      // ignore
    }
  }, [activeQuestion?.id, activeQuestion?.personId, activeQuestion?.question?.id]);

  function handleSuggestionAction(suggestionId: string) {
    const suggestion = visibleCareSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion) return;

    const person = people.find((p) => p.id === suggestion.personId);
    if (!person) return;

    function openIdeasForPerson(personId: string) {
      navigate(`/person/${personId}`);
    }

    if (suggestion.action.kind === "view") {
      navigate(`/person/${person.id}`);
      return;
    }

    if (suggestion.action.kind === "text") {
      openSmsComposer(person.phone, suggestion.action.body);
      return;
    }

    if (suggestion.action.kind === "giftIdeas") {
      openIdeasForPerson(person.id);
    }
  }

  function handleQuestionChoose(suggestionId: string, optionId: string, data?: { text?: string; isoDate?: string }) {
    const suggestion = visibleCareSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion?.question) return;

    const person = people.find((p) => p.id === suggestion.personId);
    if (!person) return;

    let updated: Person | null = null;

    const option = suggestion.question.options.find((o) => o.id === optionId) ?? null;
    if (option) {
      if (option.apply) updated = option.apply(person);
      else if (option.patch) {
        const patch = option.patch;
        updated = {
          ...person,
          ...patch,
          holidayPrefs: {
            ...(person.holidayPrefs ?? {}),
            ...((patch as Person).holidayPrefs ?? {}),
          },
        };
      }
    } else if (suggestion.question.id === "addChildName" && optionId === "save") {
      const name = (data?.text ?? "").trim();
      const child = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: name || undefined };
      updated = {
        ...person,
        hasKids: true,
        children: [...(person.children ?? []), child],
      };
    } else if (suggestion.question.id === "addChildBirthday" && optionId === "save") {
      const iso = (data?.isoDate ?? "").trim();
      const childId = suggestion.question.meta?.childId ?? "";
      if (iso && childId) {
        updated = {
          ...person,
          children: (person.children ?? []).map((c) =>
            c.id === childId ? { ...c, birthday: iso, birthdate: undefined } : c
          ),
        };
      }
    }

    if (!updated) return;

    updatePerson(updated);

    try {
      const now = String(Date.now());
      window.localStorage.setItem(
        `doknotforget_question_answered_${suggestion.personId}_${suggestion.question.id}`,
        now
      );
      window.localStorage.setItem(`doknotforget_question_person_seen_${suggestion.personId}`, now);
    } catch {
      // ignore
    }

    setQuestionTick((v) => v + 1);
  }

  function handleQuestionDismiss(suggestionId: string) {
    const suggestion = visibleCareSuggestions.find((s) => s.id === suggestionId);
    if (!suggestion?.question) return;
    try {
      const now = String(Date.now());
      window.localStorage.setItem(
        `doknotforget_question_snoozed_${suggestion.personId}_${suggestion.question.id}`,
        now
      );
      window.localStorage.setItem(`doknotforget_question_person_seen_${suggestion.personId}`, now);
    } catch {
      // ignore
    }
    setQuestionTick((v) => v + 1);
  }

  const greetingText = isContacts ? "Your contacts." : "Today";

  useEffect(() => {
    const personId = location.state?.showPartnerLinkCheck as string | undefined;
    if (!personId) return;
    if (partnerLinkPrompt) return;

    const person = people.find((p) => p.id === personId) ?? null;
    const partnerId = (person?.partnerId ?? null) as string | null;
    if (!person || !partnerId) return;

    const partner = people.find((p) => p.id === partnerId) ?? null;
    if (!partner) return;
    if (partner.partnerId === person.id) return;

    const pairKey = `${person.id}_${partner.id}`;
    if (partnerLinkShownThisSession.current.has(pairKey)) return;

    const year = new Date().getFullYear();
    const neverKey = `doknotforget_dismissed_PARTNER_LINK_never_${pairKey}`;
    const notNowKey = `doknotforget_dismissed_PARTNER_LINK_${year}_${pairKey}`;
    try {
      if (window.localStorage.getItem(neverKey) === "1") return;
      if (window.localStorage.getItem(notNowKey) === "1") return;
    } catch {
      // ignore
    }

    partnerLinkShownThisSession.current.add(pairKey);
    setPartnerLinkPrompt({
      personId: person.id,
      partnerId: partner.id,
      personName: person.name,
      partnerName: partner.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  useEffect(() => {
    // First-launch bow pulse (once, never repeats).
    try {
      const done = window.localStorage.getItem("doknotforget_bow_pulse_done") === "true";
      if (!done) {
        setShouldPulseBow(true);
        window.localStorage.setItem("doknotforget_bow_pulse_done", "true");
        window.setTimeout(() => setShouldPulseBow(false), 160);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    previousPeopleCountRef.current = people.length;
  }, [people.length]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("doknotforget_just_added_first_contact");
      if (!raw) return;
      window.localStorage.removeItem("doknotforget_just_added_first_contact");
      setShowNiceStart(true);
      window.setTimeout(() => setShowNiceStart(false), 4200);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (location.state?.defaultTab === "contacts" && isHome) {
      navigate("/contacts", { replace: true });
      return;
    }

    if (location.state?.defaultTab || location.state?.showPartnerLinkCheck) {
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [isHome, location.pathname, location.state, navigate]);

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "32px var(--space-16) calc(env(safe-area-inset-bottom, 0px) + 40px)",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "560px", margin: "0 auto", paddingTop: "32px" }}>
          <header>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "30px",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.03em",
                display: "flex",
                alignItems: "center",
                gap: "0.65rem",
              }}
            >
              <span style={{ color: "var(--ink)" }}>
                <span className={shouldPulseBow ? "dkf-bow-pulse" : undefined} style={{ display: "inline-block" }}>
                  <BowIcon size={32} />
                </span>
              </span>
              <Brand />
            </h1>
          </div>

          <div
            style={{
              marginTop: "12px",
              color: "var(--ink)",
              fontSize: "30px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
              fontFamily: "var(--font-sans)",
            }}
          >
            {greetingText}
          </div>

          <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "14px", fontFamily: "var(--font-sans)" }}>
            {homeHeaderDateFormatter.format(today)}
          </div>

          <div
            aria-hidden="true"
            style={{
              height: 0,
              borderBottom: "1px solid var(--border)",
              marginTop: "18px",
            }}
          />
        </header>

        <div style={{ marginTop: "24px", display: "flex", gap: "8px", alignItems: "baseline" }}>
          <button
            onClick={() => navigate("/home")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "1.05rem",
              fontWeight: isHome ? 700 : 600,
              color: isHome ? "var(--ink)" : "var(--muted)",
              fontFamily: "var(--font-sans)",
              textDecoration: isHome ? "underline" : "none",
              textUnderlineOffset: "6px",
            }}
          >
            Home
          </button>
          <div aria-hidden="true" style={{ color: "var(--muted)" }}>
            |
          </div>
          <button
            onClick={() => navigate("/contacts")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "1.05rem",
              fontWeight: isContacts ? 700 : 600,
              color: isContacts ? "var(--ink)" : "var(--muted)",
              fontFamily: "var(--font-sans)",
              textDecoration: isContacts ? "underline" : "none",
              textUnderlineOffset: "6px",
            }}
          >
            Contacts
          </button>
          <div aria-hidden="true" style={{ color: "var(--muted)" }}>
            |
          </div>
          <button
            onClick={() => navigate("/settings")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "1.05rem",
              fontWeight: isSettings ? 700 : 600,
              color: isSettings ? "var(--ink)" : "var(--muted)",
              fontFamily: "var(--font-sans)",
              textDecoration: isSettings ? "underline" : "none",
              textUnderlineOffset: "6px",
            }}
          >
            Settings
          </button>
        </div>

        {activeTab === "contacts" && hasContacts ? (
          <div style={{ marginTop: "16px" }}>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setSearchTerm(e.currentTarget.value);
              }}
              placeholder="Find someone…"
              style={{
                width: "100%",
                display: "block",
                padding: "0.85rem 1rem",
                borderRadius: "14px",
                border: "1px solid var(--border-strong)",
                background: "var(--card)",
                color: "var(--ink)",
                fontSize: "1rem",
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>
        ) : null}

        {activeTab === "contacts" ? (
          <div
            style={{
              marginTop: hasContacts ? "16px" : "64px",
              display: "grid",
              gap: "12px",
              maxWidth: hasContacts ? undefined : "420px",
              marginLeft: hasContacts ? undefined : "auto",
              marginRight: hasContacts ? undefined : "auto",
              justifyItems: hasContacts ? undefined : "center",
              textAlign: hasContacts ? "left" : "center",
            }}
          >
            <button
              onClick={() => navigate("/import")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: hasContacts ? "flex-start" : "center",
                gap: "10px",
                width: hasContacts ? undefined : "100%",
                border: "1px solid var(--border-strong)",
                background: hasContacts ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.92)",
                color: "var(--ink)",
                cursor: "pointer",
                textAlign: hasContacts ? "left" : "center",
                fontWeight: 650,
                letterSpacing: "0.01em",
                borderRadius: "14px",
                padding: "0.85rem 1rem",
                fontSize: "0.98rem",
                fontFamily: "var(--font-sans)",
                boxShadow: "0 6px 18px rgba(27,42,65,0.08)",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "1.05rem", lineHeight: 1 }}>
                ↓
              </span>
              <span>Import from Phone Contacts</span>
            </button>
            <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Pull in your phone contacts in seconds — no retyping
            </div>
          </div>
        ) : null}

        {activeTab === "contacts" && isSearching ? (
          <div style={{ marginTop: "10px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
            <ContactsSearchResults
              results={contactSearchResults}
              onSelect={(person) => navigate(`/person/${person.id}`)}
            />
          </div>
        ) : null}

        <main style={{ marginTop: "24px" }}>
	          {isSearching ? null : activeTab === "contacts" && !hasContacts ? null : people.length === 0 ? (
	            <div
	              style={{
	                marginTop: "64px",
	                maxWidth: "560px",
	                marginLeft: "auto",
	                marginRight: "auto",
	                display: "grid",
	                gap: "16px",
	                justifyItems: "center",
	                textAlign: "center",
	              }}
	            >
	              <div style={{ fontSize: "28px", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>
	                Start by adding someone important
	              </div>
	              <div style={{ maxWidth: "460px", color: "var(--muted)", lineHeight: 1.6, fontSize: "1rem" }}>
	                We’ll remind you about birthdays, anniversaries, and the moments that matter.
	              </div>
	              <div style={{ marginTop: "1.5rem", display: "grid", gap: "12px" }}>
	                <button
	                  onClick={() => navigate("/add")}
	                  style={{
	                    border: "1px solid var(--border-strong)",
	                    background: "transparent",
	                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.75rem 1.15rem",
	                    fontSize: "1rem",
	                    fontFamily: "var(--font-sans)",
	                  }}
	                >
	                  + Add someone
	                </button>
	                <button
	                  onClick={() => navigate("/import")}
	                  style={{
	                    border: "1px solid var(--border-strong)",
	                    background: "transparent",
	                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.75rem 1.15rem",
	                    fontSize: "1rem",
	                    fontFamily: "var(--font-sans)",
	                  }}
	                >
	                  Import Contacts
	                </button>
                {import.meta.env.DEV ? (
                  <button
                    onClick={seedDevData}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "12px",
                      padding: "0.75rem 1.15rem",
                      fontSize: "1rem",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    Seed demo data
                  </button>
                ) : null}
              </div>
            </div>
          ) : activeTab === "contacts" ? (
            <section aria-label="Contacts" style={{ marginTop: "24px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
              {filteredPeople.length === 0 ? (
                <div style={{ marginTop: "1.5rem" }}>
                  <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No match found.</div>
                </div>
              ) : (
                <div style={{ marginTop: "1.5rem" }}>
                  <PeopleIndex people={filteredPeople} today={today} onSelectPerson={(p) => navigate(`/person/${p.id}`)} />
                </div>
              )}

              <div style={{ marginTop: "32px", display: "grid", gap: "16px" }}>
                <button
                  onClick={() => navigate("/add")}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.65rem 1rem",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  + Add someone important
                </button>
              </div>
            </section>
          ) : (
            <>
              <section aria-label="Home" style={{ marginTop: "24px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
                {showNiceStart && people.length === 1 ? (
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      background: "rgba(255,255,255,0.65)",
                      padding: "14px 16px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      marginBottom: "14px",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>Nice start ⭐</div>
                    <div style={{ marginTop: "4px", color: "var(--muted)" }}>We’ll remind you when it matters.</div>
                  </div>
                ) : null}
                {(() => {
                  const headerStyle: React.CSSProperties = {
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    letterSpacing: "-0.01em",
                    marginTop: "6px",
                    marginBottom: "2px",
                  };

                  const todayReminders = homeSections.activeTodayReminders;
                  const tomorrowReminders = homeSections.tomorrowReminders;
                  const horizonEntries = homeSections.horizonEntries;
                  const hasPendingReminders = todayReminders.length > 0 || tomorrowReminders.length > 0 || horizonEntries.length > 0;
                  void visibleCareSuggestions;
                  void handleSuggestionAction;
                  void handleQuestionChoose;
                  void handleQuestionDismiss;
                  void handleBirthdayPromptNo;
                  void handleBirthdayPromptYes;
                  void handleAnniversaryPromptNo;
                  void handleAnniversaryPromptYes;
                  void handleKidsBirthdayPromptNo;
                  void handleKidsBirthdayPromptYes;
                  void partnerLinkPrompt;
                  const renderPromptGrid = (children: React.ReactNode) => (
                    <div style={{ display: "grid", gap: "16px" }}>{children}</div>
                  );

                  const renderReminderCards = (items: ReminderEvent[], section: "today" | "tomorrow") => (
                    <div style={{ display: "grid", gap: "16px" }}>
                      {items.map((reminder) => {
                        const reminderId = getReminderId(reminder);
                        const display = buildReminderDisplay(reminder, section);
                        const actions = buildReminderActions(reminder);
                        const isCompleted = Boolean(handledReminderActions[reminderId]);
                        const completionAction = isCompleted
                          ? null
                          : actions.find((action) => action.label === "✓ Mark as done") ?? null;
                        const primaryActions = isCompleted
                          ? []
                          : actions.filter((action) => action.label !== "✓ Mark as done");

                        return (
                          <div
                            key={reminderId}
                            className="smart-card"
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: "16px",
                              background: "rgba(255,255,255,0.7)",
                              padding: "16px",
                              display: "grid",
                              gap: "16px",
                              backdropFilter: "blur(6px)",
                              opacity: isCompleted ? 0.72 : 1,
                            }}
                          >
                            <div style={{ display: "grid", gap: "8px" }}>
                              <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5, fontWeight: 700 }}>
                                {display.title}
                              </div>
                              <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5 }}>
                                {display.date}
                              </div>
                              {display.giftLine ? (
                                <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                                  {display.giftLine}
                                </div>
                              ) : null}
                            </div>

                            {isCompleted ? (
                              <div
                                style={{
                                  color: "var(--muted)",
                                  fontSize: "0.98rem",
                                  lineHeight: 1.5,
                                  fontWeight: 600,
                                }}
                              >
                                ✓ You took care of this
                              </div>
                            ) : null}

                            {!isCompleted && display.ideaHeading && display.ideas.length ? (
                              <div
                                style={{
                                  display: "grid",
                                  gap: "8px",
                                  paddingTop: "12px",
                                  borderTop: "1px solid var(--border)",
                                }}
                              >
                                <div style={{ color: "var(--muted)", fontSize: "0.95rem", fontWeight: 600 }}>
                                  {display.ideaHeading}
                                </div>
                                <div style={{ display: "grid", gap: "4px", color: "var(--ink)", fontSize: "0.98rem", lineHeight: 1.5 }}>
                                  {display.ideas.map((idea) => (
                                    <div key={idea}>• {idea}</div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {primaryActions.length ? (
                              <div style={{ display: "grid", gap: section === "today" ? "10px" : "8px" }}>
                                {primaryActions.map((action) =>
                                  action.href ? (
                                    <a
                                      key={action.label}
                                      href={action.href}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={action.onClick}
                                      aria-disabled={"disabled" in action && action.disabled ? "true" : undefined}
                                      title={action.title}
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        borderRadius: "var(--radius-button)",
                                        border: "1px solid var(--border-strong)",
                                        padding: "0.85rem 1.15rem",
                                        fontSize: "1rem",
                                        fontWeight: 500,
                                        fontFamily: "inherit",
                                        backgroundColor: "transparent",
                                        color: "var(--ink)",
                                        cursor: "pointer",
                                        boxShadow: "none",
                                        textDecoration: "none",
                                        width: section === "today" ? "100%" : undefined,
                                        opacity: "disabled" in action && action.disabled ? 0.5 : 1,
                                        pointerEvents: "disabled" in action && action.disabled ? "none" : undefined,
                                      }}
                                    >
                                      {action.label}
                                    </a>
                                  ) : (
                                    <button
                                      key={action.label}
                                      type="button"
                                      onClick={action.onClick}
                                      disabled={Boolean("disabled" in action && action.disabled)}
                                      title={action.title}
                                      style={{
                                        borderRadius: "12px",
                                        padding: "0.75rem 1rem",
                                        fontSize: "1rem",
                                        width: section === "today" ? "100%" : undefined,
                                      }}
                                    >
                                      {action.label}
                                    </button>
                                  )
                                )}
                              </div>
                            ) : null}

                            {completionAction ? (
                              <div
                                style={{
                                  paddingTop: "12px",
                                  borderTop: "1px solid var(--border)",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={completionAction.onClick}
                                  style={{
                                    borderRadius: "12px",
                                    padding: "0.75rem 1rem",
                                    fontSize: "1rem",
                                  }}
                                >
                                  {completionAction.label}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );

                  const renderEmpty = () => (
                    <div style={{ marginTop: "1.5rem", padding: "2.25rem 0", textAlign: "center" }}>
                      {searchTerm.trim() && filteredPeople.length === 0 ? (
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No match found.</div>
                      ) : people.length > 0 ? (
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>
                          You're all caught up today.
                        </div>
                      ) : (
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>
                          When you add people, important dates will appear here.
                        </div>
                      )}
                    </div>
                  );

                  if (!hasPendingReminders) {
                    return renderEmpty();
                  }

                  return (
                    <>
                      {todayReminders.length > 0 ? (
                        <>
                          <div style={{ ...headerStyle, display: "flex", alignItems: "center" }}>
                            <RaisedGoldBullet />
                            <span>Today</span>
                          </div>
                          <div className="dkf-golden-sun-divider" aria-hidden="true" style={{ marginTop: "8px" }}>
                            <div className="dkf-golden-sun-divider-line" />
                          </div>
                          {todayReminders.length > 0 ? (
                            <>
                              <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.5 }}>
                                You remembered. That already counts.
                              </div>
                              {renderPromptGrid(renderReminderCards(todayReminders, "today"))}
                            </>
                          ) : null}
                        </>
                      ) : null}

                      {tomorrowReminders.length > 0 ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: todayReminders.length > 0 ? "24px" : "8px" }}>Tomorrow</div>
                          {renderReminderCards(tomorrowReminders, "tomorrow")}
                        </>
                      ) : null}

                      {horizonEntries.length > 0 ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: todayReminders.length > 0 || tomorrowReminders.length > 0 ? "24px" : "8px" }}>
                            On the Horizon
                          </div>
                          <GoldenSunDivider />
                          <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
                            {horizonEntries.map(({ moment, reminder }) => {
                              if (reminder) {
                                const reminderId = getReminderId(reminder);
                                const display = buildReminderDisplay(reminder, "horizon");

                                return (
                                  <div
                                    key={reminderId}
                                    className="smart-card"
                                    onClick={() => navigate(`/person/${reminder.personId}`)}
                                    style={{
                                      border: "1px solid var(--border)",
                                      borderRadius: "16px",
                                      background: "rgba(255,255,255,0.7)",
                                      padding: "16px",
                                      display: "grid",
                                      gap: "16px",
                                      backdropFilter: "blur(6px)",
                                    }}
                                  >
                                    <div style={{ display: "grid", gap: "8px" }}>
                                      <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5, fontWeight: 700 }}>
                                        {display.title}
                                      </div>
                                      <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5 }}>
                                        {formatReminderDate(moment.eventDate)}
                                      </div>
                                      {display.giftLine ? (
                                        <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                                          {display.giftLine}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={moment.id}
                                  className="smart-card"
                                  onClick={() => navigate(`/person/${moment.personId}`)}
                                  style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: "16px",
                                    background: "rgba(255,255,255,0.7)",
                                    padding: "16px",
                                    display: "grid",
                                    gap: "8px",
                                    backdropFilter: "blur(6px)",
                                  }}
                                >
                                  <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5, fontWeight: 700 }}>
                                    {moment.label}
                                  </div>
                                  <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5 }}>
                                    {formatReminderDate(moment.eventDate)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : null}

                      {todayReminders.length === 0 ? (
                        <div style={{ marginTop: "24px", color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>
                          You're all caught up today.
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>

              <div
                style={{
                  marginTop: "32px",
                  paddingTop: "24px",
                  borderTop: "1px solid var(--border)",
                  maxWidth: "560px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <button
                  onClick={() => navigate("/add")}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.65rem 1rem",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  + Add someone important
                </button>
                <button
                  onClick={() => navigate("/import")}
                  style={{
                    marginTop: "16px",
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.65rem 1rem",
                    fontSize: "0.95rem",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Import Contacts
                </button>
              </div>
            </>
          )}
        </main>

        {birthdayPickerPersonId ? (
          <MomentDatePicker
            isOpen
            title="Birthday"
            mode="birthday"
            monthDay={birthdayDraftMonthDay}
            setMonthDay={setBirthdayDraftMonthDay}
            year={birthdayDraftYear}
            setYear={setBirthdayDraftYear}
            yearHelperText=""
            onSave={() => {
              const iso = buildBirthdayIso(birthdayDraftMonthDay, birthdayDraftYear);
              if (!iso) return;
              const person = people.find((p) => p.id === birthdayPickerPersonId) ?? null;
              if (!person) return;

              const existing = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
              const updatedMoment = existing
                ? { ...existing, date: iso, recurring: true, label: "Birthday" }
                : { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: "birthday" as const, label: "Birthday", date: iso, recurring: true };

              const others = (person.moments ?? []).filter((m) => m.type !== "birthday");
              updatePerson({ ...person, moments: [updatedMoment, ...others] });

              setBirthdayPickerPersonId(null);
              dismissPrompt({ type: "DISCOVER_BIRTHDAY", personId: person.id, message: "", year: new Date().getFullYear() });
            }}
            onCancel={() => setBirthdayPickerPersonId(null)}
            onClear={() => {
              setBirthdayDraftMonthDay("");
              setBirthdayDraftYear("");
            }}
          />
        ) : null}

        {anniversaryPickerPersonId ? (
          <MomentDatePicker
            isOpen
            title="Anniversary"
            mode="anniversary"
            monthDay={anniversaryDraftMonthDay}
            setMonthDay={setAnniversaryDraftMonthDay}
            year={anniversaryDraftYear}
            setYear={setAnniversaryDraftYear}
            yearHelperText=""
            requireYear={false}
            onSave={() => {
              if (!anniversaryDraftMonthDay) return;
              const mmdd = monthDayFromPicker(anniversaryDraftMonthDay);
              if (!mmdd) return;

              const person = people.find((p) => p.id === anniversaryPickerPersonId) ?? null;
              if (!person) return;

              updatePerson(upsertAnniversaryMoment({ ...person, anniversary: mmdd }, mmdd));

              setAnniversaryPickerPersonId(null);
              dismissPrompt({
                type: "DISCOVER_ANNIVERSARY",
                personId: person.id,
                partnerId: person.partnerId ?? "",
                message: "",
                year: new Date().getFullYear(),
              });
            }}
            onCancel={() => setAnniversaryPickerPersonId(null)}
            onClear={() => {
              setAnniversaryDraftMonthDay("");
              setAnniversaryDraftYear("");
            }}
          />
        ) : null}

        {childBirthdayPicker ? (
          <MomentDatePicker
            isOpen
            title="Child birthday"
            mode="birthday"
            monthDay={childBirthdayDraftMonthDay}
            setMonthDay={setChildBirthdayDraftMonthDay}
            year={childBirthdayDraftYear}
            setYear={setChildBirthdayDraftYear}
            yearHelperText=""
            onSave={() => {
              const iso = buildBirthdayIso(childBirthdayDraftMonthDay, childBirthdayDraftYear);
              if (!iso) return;
              const parent = people.find((p) => p.id === childBirthdayPicker.parentId) ?? null;
              if (!parent) return;

              const nextChildren = (parent.children ?? []).map((c) =>
                c.id === childBirthdayPicker.childId ? { ...c, birthday: iso, birthdate: undefined } : c
              );

              updatePerson({ ...parent, children: nextChildren });
              setChildBirthdayPicker(null);

              dismissPrompt({
                type: "DISCOVER_CHILD_BIRTHDAY",
                parentId: parent.id,
                childId: childBirthdayPicker.childId,
                childName: "",
                message: "",
                year: new Date().getFullYear(),
              });
            }}
            onCancel={() => setChildBirthdayPicker(null)}
            onClear={() => {
              setChildBirthdayDraftMonthDay("");
              setChildBirthdayDraftYear("");
            }}
          />
        ) : null}

        {smsSuggestions ? (
          <SmartMessageSuggestionsModal
            isOpen
            personName={smsSuggestions.personName}
            suggestions={smsSuggestions.suggestions}
            onClose={() => setSmsSuggestions(null)}
            onPick={(message) => {
              const phone = smsSuggestions.phone;
              const after = smsSuggestions.onAfterSend;
              setSmsSuggestions(null);
              openSmsComposer(phone, message);
              after?.();
            }}
          />
        ) : null}
      </div>
    </div>
    </div>
  );
}
