import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "../models/Person";
import { openSmsComposer } from "../components/SoonReminderCard";
import Brand from "../components/Brand";
import BowIcon from "../components/BowIcon";
import PeopleIndex from "./PeopleIndex";
import { generateCareSuggestions } from "../utils/careSuggestions";
import { useLocation, useNavigate } from "../router";
import { useAppState } from "../appState";
import SmartSuggestionCard from "../components/SmartSuggestionCard";
import { getUpcomingReminders, type ReminderEvent } from "../engine/reminderEngine";
import { getRemindersToFire } from "../engine/reminderScheduler";
import { getReminderId, hasReminderFired, markReminderFired } from "../engine/reminderRegistry";
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

const QUICK_IDEA_SUGGESTIONS = [
  "Buy them a coffee",
  "Grab a cupcake",
  "Pick up flowers",
  "Buy a scratch-off ticket",
  "Send a funny meme",
  "Drop off a bottle of wine",
  "Bring donuts",
  "Send a pizza",
  "Take them to lunch",
  "Send a Venmo coffee",
  "Bring balloons",
  "Write a quick card",
  "Share a photo memory",
  "Send a voice message",
  "Stop by with ice cream",
];

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
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

function todayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatGiftTypeLabel(value: string) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "Gift";
  if (normalized === "ecard") return "eCard";
  if (normalized === "coffee") return "Coffee";
  if (normalized === "gift") return "Gift";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pickQuickIdeas(seed: string) {
  if (QUICK_IDEA_SUGGESTIONS.length <= 2) return QUICK_IDEA_SUGGESTIONS;

  const firstIndex = hashText(seed) % QUICK_IDEA_SUGGESTIONS.length;
  const secondIndex = (firstIndex + 1 + (hashText(`${seed}:next`) % (QUICK_IDEA_SUGGESTIONS.length - 1))) % QUICK_IDEA_SUGGESTIONS.length;

  return [QUICK_IDEA_SUGGESTIONS[firstIndex], QUICK_IDEA_SUGGESTIONS[secondIndex]].filter(
    (idea, index, all) => all.indexOf(idea) === index
  );
}

export default function Home({
}: {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, updatePerson, updatePersonFields, createPerson } = useAppState();
  const initialTab = location.state?.defaultTab === "contacts" ? "contacts" : "home";
  const [activeTab, setActiveTab] = useState<"home" | "contacts">(initialTab);
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
  const [giftHistoryConfirm, setGiftHistoryConfirm] = useState<null | {
    personId: string;
    type: "coffee" | "ecard" | "gift";
  }>(null);
  const [smsSuggestions, setSmsSuggestions] = useState<null | {
    personName: string;
    phone: string;
    suggestions: Array<{ id: "quick" | "friendly" | "thoughtful" | "simple" | "custom"; label: string; message: string }>;
    onAfterSend?: () => void;
  }>(null);
  const previousPeopleCountRef = useRef<number>(people.length);

  const today = useMemo(() => startOfToday(), []);

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
      name: "Emma Parker",
      phone: "+14155550101",
      moments: [mkBirthdayMoment("demo-emma", todayDate)],
    });

    createPerson({
      id: "demo-chris",
      name: "Chris Rivera",
      phone: "+14155550102",
      moments: [],
      hasKids: true,
      parentRole: "parent",
      children: [
        {
          id: "demo-liam",
          name: "Liam",
          birthday: monthDayIso(todayDate),
        },
      ],
    });

    createPerson({
      id: "demo-dad",
      name: "Dad",
      phone: "+14155550103",
      moments: [mkBirthdayMoment("demo-dad", plus5Date)],
    });

    createPerson({
      id: "demo-sarah",
      name: "Sarah Chen",
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

  const isSearching = Boolean(searchTerm.trim());
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
      return !hasReminderFired(reminderId) && !dismissedReminderKeys[reminderId];
    });
  }, [dismissedReminderKeys, reminders]);

  useEffect(() => {
    if (activeTab !== "home") return;
    let cancelled = false;

    async function deliverReminders() {
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

  function buildReminderMessage(reminder: ReminderEvent) {
    const display = formatReminderCard(reminder);
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const latestGift = person?.giftHistory?.length ? person.giftHistory[person.giftHistory.length - 1] : null;
    const giftLine = latestGift ? `Last time you sent: ${formatGiftTypeLabel(latestGift.type)}` : null;
    const quickIdeas =
      reminder.reminderType === "dayOf"
        ? [`Quick idea`, ...pickQuickIdeas(getReminderId(reminder)).map((idea) => `• ${idea}`)].join("\n")
        : null;
    const baseLines = [
      display.label,
      formatReminderDate(reminder.date),
      giftLine,
    ]
      .filter(Boolean)
      .join("\n");
    return quickIdeas ? `${baseLines}\n\n${quickIdeas}` : baseLines;
  }

  function dismissReminderCard(reminder: ReminderEvent) {
    const reminderId = getReminderId(reminder);
    markReminderFired(reminderId);
    setHandledReminderActions((prev) => {
      if (prev[reminderId]) return prev;
      return { ...prev, [reminderId]: true };
    });
    setDismissedReminderKeys((prev) => ({ ...prev, [reminderId]: true }));
  }

  function promptGiftHistory(personId: string, type: "coffee" | "ecard" | "gift") {
    setGiftHistoryConfirm({ personId, type });
  }

  function confirmGiftHistory() {
    if (!giftHistoryConfirm) return;
    const person = people.find((candidate) => candidate.id === giftHistoryConfirm.personId) ?? null;
    if (!person) {
      setGiftHistoryConfirm(null);
      return;
    }

    updatePerson({
      ...person,
      giftHistory: [
        ...(person.giftHistory ?? []),
        {
          type: giftHistoryConfirm.type,
          date: todayIsoDate(),
        },
      ],
    });
    setGiftHistoryConfirm(null);
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
          onClick: () => {
            if (!person) return;
            promptGiftHistory(person.id, "gift");
          },
        },
        {
          label: "All set",
          onClick: () => dismissReminderCard(reminder),
        },
      ];
    }

    if (reminder.reminderType === "oneDay") {
      return [
        {
          label: "All set",
          onClick: () => dismissReminderCard(reminder),
        },
      ];
    }

    return [
      {
        label: reminderTextActionLabel(reminder, person),
        disabled: !person?.phone,
        title: !person?.phone ? "Add a phone number to text them." : undefined,
        onClick: () => {
          if (!person?.phone) return;

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
          });
        },
      },
      {
        label: `Send ${first} an eCard`,
        href: "https://www.americangreetings.com/ecards",
        onClick: () => {
          if (!person) return;
          promptGiftHistory(person.id, "ecard");
        },
      },
      {
        label: `Send ${first} a coffee`,
        href: "https://www.starbucks.com/gift",
        onClick: () => {
          if (!person) return;
          promptGiftHistory(person.id, "coffee");
        },
      },
      {
        label: "All set",
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

  const greetingText = activeTab === "home" ? "Today" : "Your contacts.";

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
    if (location.state?.defaultTab || location.state?.showPartnerLinkCheck) {
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)" }}>
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "32px 16px 16px 16px",
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

        <div style={{ marginTop: "20px", display: "flex", gap: "1rem", alignItems: "baseline" }}>
          <button
            onClick={() => setActiveTab("home")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "1.05rem",
              fontWeight: 600,
              color: activeTab === "home" ? "var(--ink)" : "var(--muted)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Home
          </button>
          <div aria-hidden="true" style={{ color: "var(--muted)" }}>
            |
          </div>
          <button
            onClick={() => setActiveTab("contacts")}
            style={{
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: "1.05rem",
              fontWeight: 600,
              color: activeTab === "contacts" ? "var(--ink)" : "var(--muted)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Contacts
          </button>
        </div>

        <div style={{ marginTop: "16px" }}>
          <div className="search-label">Search your contacts</div>
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

        {isSearching ? (
          <div style={{ marginTop: "10px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
            <ContactsSearchResults
              results={contactSearchResults}
              onSelect={(person) => navigate(`/person/${person.id}`)}
            />
          </div>
        ) : null}

        <main style={{ marginTop: "24px" }}>
	          {isSearching ? null : people.length === 0 ? (
	            <div style={{ marginTop: "3.25rem", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
	              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)", letterSpacing: "-0.01em" }}>
	                Remember the moments that matter.
	              </div>
	              <div style={{ marginTop: "0.6rem", color: "var(--muted)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
	                Start with a few people you care about —{"\n"}DoKnotForget will remind you when it counts.
	              </div>
	              <div style={{ marginTop: "1.5rem", display: "grid", gap: "12px" }}>
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
                    padding: "0.75rem 1.15rem",
	                    fontSize: "1rem",
	                    fontFamily: "var(--font-sans)",
	                  }}
	                >
	                  Add Person
	                </button>
	                <button
	                  onClick={() => navigate("/import")}
	                  style={{
	                    border: "1px solid var(--border-strong)",
	                    background: "transparent",
	                    color: "var(--ink)",
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
            <section aria-label="Contacts" style={{ marginTop: "18px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
              {filteredPeople.length === 0 ? (
                <div style={{ marginTop: "1.5rem" }}>
                  <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No match found.</div>
                </div>
              ) : (
                <div style={{ marginTop: "1.5rem" }}>
                  <PeopleIndex people={filteredPeople} today={today} onSelectPerson={(p) => navigate(`/person/${p.id}`)} />
                </div>
              )}

              <div style={{ marginTop: "2.5rem", display: "grid", gap: "12px" }}>
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
                  Import from contacts
                </button>
              </div>
            </section>
          ) : (
            <>
              <section aria-label="Home" style={{ marginTop: "18px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
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

                  const firstOf = (fullName: string) => (fullName ?? "").trim().split(" ")[0] || fullName || "Text";

                  const todayReminders = activeReminders.filter((reminder) => reminder.reminderType === "dayOf");
                  const tomorrowReminders = activeReminders.filter((reminder) => reminder.reminderType === "oneDay");
                  const horizonReminders = activeReminders.filter((reminder) => reminder.reminderType === "sevenDay");
                  const groupedReminders = [...todayReminders, ...tomorrowReminders, ...horizonReminders];
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
                  const handledToday = reminders.filter((reminder) => {
                    return reminder.reminderType === "dayOf" && Boolean(handledReminderActions[getReminderId(reminder)]);
                  });

                  function handledLine(reminder: ReminderEvent) {
                    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
                    const first = firstOf(person?.name ?? reminder.personName);
                    const display = formatReminderCard(reminder);

                    if (reminder.momentType === "childBirthday") {
                      const childName = display.label.split(" turns ")[0]?.split("'s birthday")[0]?.trim() || "their child";
                      return `✓ All set for ${childName}'s birthday with ${first}`;
                    }

                    if (reminder.momentType === "anniversary") {
                      return `✓ All set for ${first}'s anniversary`;
                    }

                    if (reminder.momentType === "birthday") {
                      return `✓ All set for ${first}'s birthday`;
                    }

                    return `✓ All set for ${first}`;
                  }

                  const renderPromptGrid = (children: React.ReactNode) => (
                    <div style={{ display: "grid", gap: "12px", marginBottom: "6px" }}>{children}</div>
                  );

                  const renderReminderCards = (items: ReminderEvent[]) => (
                    <div style={{ display: "grid", gap: "12px", marginBottom: "6px" }}>
                      {items.map((reminder) => (
                        <SmartSuggestionCard
                          key={getReminderId(reminder)}
                          variant="nudge"
                          message={buildReminderMessage(reminder)}
                          actions={buildReminderActions(reminder)}
                          onMaybe={undefined}
                        />
                      ))}
                    </div>
                  );

                  const renderEmpty = () => (
                    <div style={{ marginTop: "1.5rem", padding: "2.25rem 0", textAlign: "center" }}>
                      {searchTerm.trim() && filteredPeople.length === 0 ? (
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No match found.</div>
                      ) : (
                        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>
                          When you add people, important dates will appear here.
                        </div>
                      )}
                    </div>
                  );

                  if (groupedReminders.length === 0) {
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
                          <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.5 }}>
                            You remembered. That already counts.
                          </div>
                          {renderPromptGrid(renderReminderCards(todayReminders))}
                        </>
                      ) : null}

                      {tomorrowReminders.length > 0 ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: todayReminders.length > 0 ? "22px" : "6px" }}>Tomorrow</div>
                          {renderReminderCards(tomorrowReminders)}
                        </>
                      ) : null}

                      {horizonReminders.length > 0 ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: todayReminders.length > 0 || tomorrowReminders.length > 0 ? "14px" : "6px" }}>
                            On the Horizon
                          </div>
                          <GoldenSunDivider />
                          <div style={{ marginTop: "10px" }}>{renderReminderCards(horizonReminders)}</div>
                        </>
                      ) : null}

                      {handledToday.length ? (
                        <div style={{ marginTop: "22px" }}>
                          <div style={headerStyle}>Taken Care Of Today</div>
                          <div style={{ marginTop: "10px", display: "grid", gap: "8px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.45 }}>
                            {handledToday.map((reminder) => (
                              <div key={`handled_${getReminderId(reminder)}`} style={{ display: "flex", alignItems: "center" }}>
                                <div style={{ minWidth: 0 }}>{handledLine(reminder)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </section>

              <div
                style={{
                  marginTop: "4.25rem",
                  paddingTop: "1.75rem",
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

        {giftHistoryConfirm ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.28)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              zIndex: 50,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "360px",
                borderRadius: "16px",
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.96)",
                color: "var(--ink)",
                padding: "18px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
                display: "grid",
                gap: "14px",
              }}
            >
              <div style={{ fontSize: "1rem", fontWeight: 600 }}>Did you send this?</div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button type="button" onClick={confirmGiftHistory}>
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setGiftHistoryConfirm(null)}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                  }}
                >
                  Not yet
                </button>
              </div>
            </div>
          </div>
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
