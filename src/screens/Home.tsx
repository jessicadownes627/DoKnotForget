import { useEffect, useMemo, useRef, useState } from "react";
import type { ChildParentContact, Person } from "../models/Person";
import type { Relationship, RelationshipType } from "../models/Relationship";
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
  getAnniversaryPrompts,
  getBirthdayPrompts,
  getFatherPrompts,
  getKidsBirthdayPrompts,
  getMotherPrompts,
  type AnniversaryPromptItem,
  type BirthdayPromptItem,
  type FatherPromptItem,
  type KidsBirthdayPromptItem,
  type MotherPromptItem,
  type PromptItem,
} from "../engine/promptEngine";
import { getNextBirthdayFromIso } from "../utils/birthdayUtils";
import MomentDatePicker from "../components/MomentDatePicker";
import { RaisedGoldBullet } from "../components/common/GoldBullets";
import ContactsSearchResults from "../components/ContactsSearchResults";
import { filterContacts } from "../utils/contactSearch";
import SmartMessageSuggestionsModal from "../components/SmartMessageSuggestionsModal";
import SmartSuggestionCard from "../components/SmartSuggestionCard";
import MicroQuestionCard from "../components/MicroQuestionCard";
import { displayNameOrFallback } from "../utils/displayName";
import { formatLocalYmd, parseLocalDate } from "../utils/date";
import { buildHomeSections } from "../utils/homeSections";
import { buildAddPersonRelationshipPersistence } from "../utils/addPersonRelationshipPersistence";
import { buildRelationshipV2Links } from "../utils/relationshipV2.js";
import {
  buildResolvedReminderLabel,
  reminderEventDate,
  resolveReminderContext,
} from "../utils/reminderRelationshipContext.js";
import {
  cancelScheduledReminderNotificationByReminderId,
  isNativeNotificationsSupported,
} from "../utils/notificationScheduler";
import {
  fetchRecommendationsFromSheet,
  type SheetRecommendation,
} from "../utils/fetchRecommendationsFromSheet.js";

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
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
});

const CHILD_QUICK_IDEAS = [
  "Grab a balloon or small surprise",
  "Pick up a coloring book or craft",
  "Get a small toy {name} would love",
  "Bring something fun they can open",
  "Pick out a card {name} would love",
  "Bring a cupcake",
  "Leave a birthday surprise at the door",
];

const TEEN_QUICK_IDEAS = [
  "Send {name} a funny meme",
  "Send {name} a Spotify song",
  "Share a throwback photo with {name}",
  "Send {name} a funny TikTok",
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
  "Pick up flowers for {name}",
  "Buy a scratch-off ticket",
  "Send {name} a funny meme",
  "Call and sing happy birthday",
  "Share a favorite memory with {name}",
  "Send {name} a photo from the past",
  "Leave a voicemail surprise",
  "Send {name} a song from Apple Music",
  "Tag {name} in a memory",
  "Send a GIF",
  "Write {name} a quick compliment",
  "Drop off a bottle of wine",
  "Bring donuts",
  "Send a pizza",
  "Take {name} to lunch",
  "Record a quick birthday video for {name}",
  "Bring balloons",
  "Write {name} a quick card",
  "Send {name} a voice message",
  "Stop by with ice cream for {name}",
];

const ANNIVERSARY_IDEAS = [
  "Send a thoughtful message",
  "Celebrate them together",
  "Drop off flowers or a bottle of wine",
  "Acknowledge the day with a quick note",
  "Plan something small but meaningful",
];

const CHILD_PREP_IDEAS = [
  "A card {name} would love",
  "A balloon or small surprise",
  "A cupcake or favorite treat",
  "Something small they can open",
  "Something fun to unwrap",
];

const CHILD_HORIZON_IDEAS = [
  "Check what {name} is into this year",
  "Think about something small {name} would love",
  "Keep it simple - you don't need much",
  "A little thought will go a long way",
];

const TEEN_PREP_IDEAS = [
  "Something {name} is into right now",
  "A fun treat or gift card for {name}",
  "Something {name} would actually want",
  "A little surprise for {name}’s day",
];

const TEEN_HORIZON_IDEAS = [
  "Think about what would feel like {name} this year",
  "A small idea for {name} is enough to start with",
  "Keep it easy - something thoughtful is plenty",
  "A little planning now will make this easier later",
];

const ADULT_PREP_IDEAS = [
  "A thoughtful card for {name}",
  "A dessert or favorite treat for {name}",
  "Flowers or a small gift for {name}",
  "Time for a call with {name}",
  "A favorite memory to send {name}",
];

const ADULT_HORIZON_IDEAS = [
  "Think about what would feel meaningful for {name} this year",
  "A small gesture will be enough",
  "You don't need much to make this feel thoughtful",
  "A little planning now can make this easier later",
];

const ANNIVERSARY_PREP_IDEAS = [
  "A thoughtful note",
  "Flowers, wine, or dessert",
  "Something small but meaningful",
  "Time to celebrate together",
];

const ANNIVERSARY_HORIZON_IDEAS = [
  "Think about one small way to mark the day",
  "Something simple can still feel meaningful",
  "A little ahead of time can make this feel easier",
  "You don't need much to make it feel thoughtful",
];

const ADULT_BIRTHDAY_SUPPORT_LINES = [
  "A quick message would mean a lot",
  "A thoughtful note could make their day",
  "This is a good one to reach out for",
];

const CHILD_BIRTHDAY_SUPPORT_LINES = [
  "A small gesture could make their day",
  "A little surprise could feel really special",
  "Something thoughtful could make this feel bigger",
];

const ANNIVERSARY_SUPPORT_LINES = [
  "This one deserves something thoughtful",
  "A small note could make this feel special",
  "This is a good moment to show up with care",
];

const MILESTONE_SUPPORT_LINES = [
  "This one’s worth celebrating",
  "A little extra thought would fit this one",
  "This milestone deserves something special",
];

const RECOMMENDATIONS_SHEET_URL = (import.meta.env.VITE_RECOMMENDATIONS_SHEET_URL ?? "").trim();
const FREE_LIMIT = 3;
const CIRCLE_NAVY = "#17324d";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function msUntilNextMidnight(from = new Date()) {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  return Math.max(1000, next.getTime() - from.getTime());
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type ReminderToneCategory = "adultBirthday" | "childBirthday" | "anniversary" | "milestone" | "other";

function possessive(name: string) {
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

function careEventDisplayName(name: string) {
  return displayNameOrFallback(name);
}

function buildRecentlyAddedReassurance(name: string, person: Person) {
  const trimmedName = name.trim() || "This person";
  const birthday = (person.moments ?? []).some((moment) => moment.type === "birthday");
  const anniversary =
    Boolean((person.anniversary ?? "").trim()) ||
    (person.moments ?? []).some((moment) => moment.type === "anniversary");
  const customCount = (person.moments ?? []).filter((moment) => moment.type === "custom").length;
  const rememberedCount = Number(birthday) + Number(anniversary) + customCount;

  if (birthday && !anniversary && customCount === 0) {
    return `${possessive(trimmedName)} birthday is remembered.`;
  }
  if (!birthday && anniversary && customCount === 0) {
    return `${possessive(trimmedName)} anniversary is remembered.`;
  }
  if (!birthday && !anniversary && customCount === 1) {
    return `${possessive(trimmedName)} important day is remembered.`;
  }
  if (rememberedCount > 1) {
    return `${possessive(trimmedName)} important days are remembered.`;
  }
  return `${trimmedName} is safely in your Circle.`;
}

function CircleEmptyStateGraphic() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: "104px",
        height: "104px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "14px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 180, 106, 0.42)",
          background: "rgba(255,255,255,0.38)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "41px",
          width: "22px",
          height: "22px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 180, 106, 0.68)",
          background: "rgba(255,255,255,0.78)",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "8px",
          top: "42px",
          width: "18px",
          height: "18px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 180, 106, 0.52)",
          background: "rgba(255,255,255,0.68)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "18px",
          width: "16px",
          height: "16px",
          borderRadius: "999px",
          border: "1px solid rgba(216, 180, 106, 0.52)",
          background: "rgba(255,255,255,0.68)",
        }}
      />
    </div>
  );
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
    return `Completed ${possessive(personName)} ${reminder.label.trim().toLowerCase()} reminder`;
  }

  return `Checked in with ${personName}`;
}

function reminderSecondaryActionLabel(label: string) {
  const lowered = label.toLowerCase();
  if (lowered.includes("ecard") || lowered === "card") return "Send an eCard";
  if (lowered.includes("coffee")) return "Treat to coffee";
  if (lowered.includes("dessert")) return "Order dessert";
  if (lowered.includes("gift")) return "Send a small gift";
  return label;
}

function personalizeIdea(idea: string, subjectName: string) {
  return idea.replaceAll("{name}", contactFirstName(subjectName));
}

function reminderActionRecipientName(
  reminder: ReminderEvent,
  person: Person | null,
  people: Person[],
  relationships: Relationship[],
  today: Date,
  relationshipV2Links: ReturnType<typeof buildRelationshipV2Links>
) {
  const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);
  if (
    (reminderContext?.kind === "childBirthday" ||
      reminderContext?.kind === "childThroughRelationship" ||
      reminderContext?.kind === "careRecipient") &&
    reminderContext.recipients.length > 0
  ) {
    return contactFirstName(reminderContext.recipients[0]?.name ?? reminder.personName);
  }

  return contactFirstName((person?.name ?? reminder.personName).trim() || reminder.personName);
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

function getChildBirthdayContext(reminder: ReminderEvent, people: Person[], today: Date) {
  if (reminder.momentType !== "childBirthday") return null;

  const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
  if (!person) return null;

  const eventDate = reminderEventDate(reminder);
  const child =
    person.children?.find((candidate) => {
      const birthdayValue = (candidate.birthday ?? candidate.birthdate ?? "").trim();
      if (!birthdayValue) return false;
      const nextBirthday = getNextBirthdayFromIso(birthdayValue, today);
      if (!nextBirthday || !eventDate) return false;
      return nextBirthday.target.getTime() === eventDate.getTime();
    }) ?? null;

  if (!child) return null;

  const childName = (child.name ?? "").trim() || "Your child";
  const birthday = (child.birthday ?? child.birthdate ?? "").trim() || undefined;
  const age = birthday && eventDate ? calculateAge(birthday, eventDate) : undefined;
  const parentContacts = resolveChildParentContacts(person, people, child.parents);
  return {
    parent: person,
    child,
    childName,
    birthday,
    age,
    parentContacts,
  };
}

function resolveChildParentContacts(person: Person, people: Person[], parents?: ChildParentContact[]) {
  const contacts = (parents ?? [])
    .map((parentContact) => {
      const linkedPerson = parentContact.id ? people.find((candidate) => candidate.id === parentContact.id) ?? null : null;
      const name = (linkedPerson?.name ?? parentContact.name ?? "").trim();
      const phone = (linkedPerson?.phone ?? parentContact.phone ?? "").trim();
      if (!name) return null;
      return {
        id: linkedPerson?.id ?? parentContact.id ?? `${name}:${phone}`,
        name,
        phone,
      };
    })
    .filter((contact): contact is { id: string; name: string; phone: string } => Boolean(contact));

  if (contacts.length > 0) return contacts;

  const fallbackName = person.name.trim();
  return fallbackName
    ? [
        {
          id: person.id,
          name: fallbackName,
          phone: (person.phone ?? "").trim(),
        },
      ]
    : [];
}

function contactFirstName(name: string) {
  const trimmed = name.trim();
  return trimmed.split(" ")[0] || trimmed;
}

function pickRandomRecommendations(recommendations: SheetRecommendation[]) {
  if (recommendations.length <= 2) return recommendations;

  const pool = [...recommendations];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const count = Math.random() < 0.5 ? 1 : 2;
  return pool.slice(0, count);
}

export default function Home({
}: {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, relationships, relationshipLinksV2, isPremium, savePerson, updatePerson, updatePersonFields, createPerson, recordCareEvent } = useAppState();
  const [searchTerm, setSearchTerm] = useState("");
  const [questionTick, setQuestionTick] = useState(0);
  const [shouldPulseBow, setShouldPulseBow] = useState(false);
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
  const [circleSuccessMessage, setCircleSuccessMessage] = useState("");
  const [recentlyAddedPersonId, setRecentlyAddedPersonId] = useState<string | null>(null);
  const [connectPersonConfirmation, setConnectPersonConfirmation] = useState("");
  const [isConnectPersonOpen, setIsConnectPersonOpen] = useState(false);
  const [connectPersonQuery, setConnectPersonQuery] = useState("");
  const [selectedConnectionTargetId, setSelectedConnectionTargetId] = useState<string | null>(null);
  const [selectedConnectionType, setSelectedConnectionType] = useState<RelationshipType | null>(null);
  const [sheetRecommendations, setSheetRecommendations] = useState<SheetRecommendation[]>([]);
  const [isHorizonExpanded, setIsHorizonExpanded] = useState(false);
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
    suggestions: Array<{ id: string; label?: string; message: string }>;
    onAfterSend?: () => void;
  }>(null);
  const previousPeopleCountRef = useRef<number>(people.length);
  const [today, setToday] = useState(() => startOfToday());
  const isHome = location.pathname === "/" || location.pathname === "/home";
  const isContacts = location.pathname === "/contacts";
  const isSettings = location.pathname === "/settings";
  const activeTab: "home" | "contacts" = isContacts ? "contacts" : "home";
  const hasContacts = people.length > 0;
  const recentlyAddedPerson =
    recentlyAddedPersonId ? people.find((person) => person.id === recentlyAddedPersonId) ?? null : null;
  const availableConnectionTargets = useMemo(() => {
    if (!recentlyAddedPerson) return [];
    return [...people]
      .filter((person) => person.id !== recentlyAddedPerson.id && person.name.trim())
      .sort((a, b) =>
        displayNameOrFallback(a.name).localeCompare(displayNameOrFallback(b.name), undefined, {
          sensitivity: "base",
        })
      );
  }, [people, recentlyAddedPerson]);
  const filteredConnectionTargets = useMemo(() => {
    if (!connectPersonQuery.trim()) return availableConnectionTargets;
    return filterContacts(availableConnectionTargets, connectPersonQuery);
  }, [availableConnectionTargets, connectPersonQuery]);
  const selectedConnectionTarget =
    selectedConnectionTargetId
      ? availableConnectionTargets.find((person) => person.id === selectedConnectionTargetId) ?? null
      : null;

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

  useEffect(() => {
    let cancelled = false;

    if (!RECOMMENDATIONS_SHEET_URL) {
      setSheetRecommendations([]);
      return () => {
        cancelled = true;
      };
    }

    void fetchRecommendationsFromSheet(RECOMMENDATIONS_SHEET_URL)
      .then((items) => {
        if (cancelled) return;
        setSheetRecommendations(items);
      });

    return () => {
      cancelled = true;
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
  const relationshipV2Links = useMemo(
    () => buildRelationshipV2Links({ people, relationships, persistedLinks: relationshipLinksV2 }),
    [people, relationshipLinksV2, relationships]
  );

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
  const reminderSupportLineOverrides = useMemo(() => {
    const overrides: Record<string, string> = {};
    const categoryCounts: Record<ReminderToneCategory, number> = {
      adultBirthday: 0,
      childBirthday: 0,
      anniversary: 0,
      milestone: 0,
      other: 0,
    };

    const tonePoolForCategory = (category: ReminderToneCategory) => {
      switch (category) {
        case "adultBirthday":
          return ADULT_BIRTHDAY_SUPPORT_LINES;
        case "childBirthday":
          return CHILD_BIRTHDAY_SUPPORT_LINES;
        case "anniversary":
          return ANNIVERSARY_SUPPORT_LINES;
        case "milestone":
          return MILESTONE_SUPPORT_LINES;
        default:
          return null;
      }
    };

    const resolveToneCategory = (reminder: ReminderEvent): ReminderToneCategory => {
      const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
      const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);
      const eventDate = reminderEventDate(reminder);
      let birthdayForAge: string | undefined;
      if (reminder.momentType === "childBirthday") {
        const childContext = getChildBirthdayContext(reminder, people, today);
        birthdayForAge = childContext?.birthday;
      } else {
        const birthdayMoment = (person?.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
        birthdayForAge = (birthdayMoment?.date ?? "").trim() || undefined;
      }

      const reminderAge =
        reminderContext?.subjectAge ?? (birthdayForAge && eventDate ? calculateAge(birthdayForAge, eventDate) : undefined);

      if (reminder.momentType === "anniversary") return "anniversary";
      if (reminderAge !== undefined && MILESTONE_AGES.has(reminderAge)) return "milestone";
      if (reminder.momentType === "childBirthday" || (reminderAge !== undefined && reminderAge < 13)) return "childBirthday";
      if (reminder.momentType === "birthday") return "adultBirthday";
      return "other";
    };

    const visibleReminders: ReminderEvent[] = [
      ...homeSections.activeTodayReminders,
      ...homeSections.tomorrowReminders,
      ...homeSections.horizonEntries
        .map((entry) => entry.reminder)
        .filter((reminder): reminder is ReminderEvent => Boolean(reminder)),
      ...(isHorizonExpanded ? homeSections.expandedHorizonEntries : [])
        .map((entry) => entry.reminder)
        .filter((reminder): reminder is ReminderEvent => Boolean(reminder)),
    ];

    for (const reminder of visibleReminders) {
      const category = resolveToneCategory(reminder);
      const pool = tonePoolForCategory(category);
      if (!pool?.length) continue;
      const index = categoryCounts[category] % pool.length;
      overrides[getReminderId(reminder)] = pool[index] ?? pool[0] ?? "";
      categoryCounts[category] += 1;
    }

    return overrides;
  }, [
    homeSections.activeTodayReminders,
    homeSections.expandedHorizonEntries,
    homeSections.horizonEntries,
    homeSections.tomorrowReminders,
    isHorizonExpanded,
    people,
    relationships,
    relationshipV2Links,
    today,
  ]);

  useEffect(() => {
    if (activeTab !== "home") return;

    const todayLocal = formatLocalYmd(today);
    reminders
      .filter((reminder) => reminder.momentType === "birthday" || reminder.momentType === "childBirthday")
      .forEach((reminder) => {
        const handledKey = getReminderId(reminder);
        // eslint-disable-next-line no-console
        console.log("[DKF DEBUG] Reminder date audit", {
          todayLocal,
          reminderType: reminder.reminderType,
          personId: reminder.personId,
          personName: reminder.personName,
          birthdayEventDateLocal: reminder.eventDate,
          reminderTriggerDateLocal: reminder.date,
          handledKey,
          isHandled: handledReminderActions[handledKey] === true,
        });
      });
  }, [activeTab, handledReminderActions, reminders, today]);

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
    const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);
    const resolvedLabel = buildResolvedReminderLabel(reminder, people, relationships, today, relationshipV2Links);

    if (reminder.momentType === "birthday") {
      if (reminderContext?.kind === "childThroughRelationship" || reminderContext?.kind === "careRecipient") {
        return {
          title: reminderContext.subjectName,
          label: resolvedLabel,
        };
      }
      return {
        title: personName,
        label: resolvedLabel,
      };
    }

    if (reminder.momentType === "anniversary") {
      const combinedNames = reminderContext?.kind === "anniversary" ? reminderContext.subjectName : null;
      return {
        title: combinedNames ?? personName,
        label: resolvedLabel,
      };
    }

    if (reminder.momentType === "childBirthday") {
      if (!reminderContext || reminderContext.kind !== "childBirthday") {
        return {
          title: "Child birthday",
          label: reminder.label,
        };
      }

      return {
        title: reminderContext.subjectName,
        label: resolvedLabel,
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

function upcomingRelationshipContextLine(
  personName: string,
  reminderContext: ReturnType<typeof resolveReminderContext>,
  section: "today" | "tomorrow" | "horizon",
  eventDate?: Date | null
) {
  const subjectName = (reminderContext?.subjectName ?? personName).trim() || "them";
  const recipientName = reminderContext?.recipients[0]?.name?.trim() || "";
  const recipientFirst = recipientName ? contactFirstName(recipientName) : "";
  const fullDayLabel = eventDate
    ? `${weekdayFormatter.format(eventDate)} (${eventDate.getMonth() + 1}/${eventDate.getDate()})`
    : "that day";

  if ((reminderContext?.kind === "childBirthday" || reminderContext?.kind === "childThroughRelationship") && recipientFirst) {
    if (section === "horizon") {
      return `Text ${recipientFirst} to wish ${subjectName} a happy birthday on ${fullDayLabel}.`;
    }
    return section === "tomorrow"
      ? `Text ${recipientFirst} to wish ${subjectName} a happy birthday tomorrow.`
      : `Text ${recipientFirst} to wish ${subjectName} a happy birthday.`;
  }

  if (reminderContext?.kind === "careRecipient" && recipientFirst) {
    if (section === "horizon") {
      return `Text ${recipientFirst} to wish ${subjectName} a happy birthday on ${fullDayLabel}.`;
    }
    return section === "tomorrow"
      ? `Text ${recipientFirst} to wish ${subjectName} a happy birthday tomorrow.`
      : `Text ${recipientFirst} to wish ${subjectName} a happy birthday.`;
  }

  return null;
}

function buildUpcomingPlanningIdeas(args: {
  seed: string;
  subjectName: string;
  recipientName?: string;
  age?: number;
  momentType: ReminderEvent["momentType"];
  section: "tomorrow" | "horizon";
}) {
  const { seed, subjectName, recipientName, age, momentType, section } = args;
  const subjectFirst = contactFirstName(subjectName);
  const recipientFirst = recipientName ? contactFirstName(recipientName) : "";
  const count = section === "tomorrow" ? 2 : 3;

  if (section === "horizon") {
    if (momentType === "anniversary") {
      return pickQuickIdeas(seed, ANNIVERSARY_HORIZON_IDEAS).slice(0, count);
    }

    if (age !== undefined && age < 13) {
      const reflectiveChildIdea = recipientFirst
        ? `Something ${subjectFirst} is into this year`
        : `Something small ${subjectFirst} would love`;
      return [
        reflectiveChildIdea,
        ...pickQuickIdeas(seed, CHILD_HORIZON_IDEAS)
          .slice(0, count - 1)
          .map((idea) => personalizeIdea(idea, subjectName)),
      ];
    }

    if (age !== undefined && age < 18) {
      return pickQuickIdeas(seed, TEEN_HORIZON_IDEAS)
        .slice(0, count)
        .map((idea) => personalizeIdea(idea, subjectName));
    }

    return pickQuickIdeas(seed, ADULT_HORIZON_IDEAS)
      .slice(0, count)
      .map((idea) => personalizeIdea(idea, subjectName));
  }

  if (momentType === "anniversary") {
    return pickQuickIdeas(seed, ANNIVERSARY_PREP_IDEAS).slice(0, count);
  }

  if (age !== undefined && age < 13) {
    const relationalIdea = recipientFirst
      ? `Something ${subjectFirst} is into lately`
      : `Something ${subjectFirst} would love`;
    return [
      relationalIdea,
      ...pickQuickIdeas(seed, CHILD_PREP_IDEAS)
        .slice(0, count - 1)
        .map((idea) => personalizeIdea(idea, subjectName)),
    ];
  }

  if (age !== undefined && age < 18) {
    return pickQuickIdeas(seed, TEEN_PREP_IDEAS)
      .slice(0, count)
      .map((idea) => personalizeIdea(idea, subjectName));
  }

  return pickQuickIdeas(seed, ADULT_PREP_IDEAS)
    .slice(0, count)
    .map((idea) => personalizeIdea(idea, subjectName));
}

function buildHorizonPlanningNudge(args: {
  subjectName: string;
  recipientName?: string;
  age?: number;
  momentType: ReminderEvent["momentType"];
}) {
  const { subjectName, recipientName, age, momentType } = args;
  const subjectFirst = contactFirstName(subjectName);
  const recipientFirst = recipientName ? contactFirstName(recipientName) : "";

  if (momentType === "anniversary") {
    return "One small way to mark the day.";
  }

  if (age !== undefined && age < 13) {
    if (recipientFirst) {
      return `Check with ${recipientFirst} this week what ${subjectFirst} is into lately.`;
    }
    return `Something small ${subjectFirst} would love.`;
  }

  if (age !== undefined && age < 18) {
    return `Something small ${subjectFirst} would love.`;
  }

  return `Something small ${subjectFirst} would love.`;
}

  function reminderCardPresentation(reminder: ReminderEvent, section: "today" | "tomorrow" | "horizon") {
    const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);

    if (reminderContext?.kind === "childBirthday" || reminderContext?.kind === "childThroughRelationship") {
      const recipientName = reminderContext.recipients[0]?.name?.trim() || "their family";
      const firstRecipient = contactFirstName(recipientName);
      return {
        eyebrow: `Show up for ${firstRecipient}`,
        support: `${reminderContext.subjectName} is part of ${firstRecipient}'s story.`,
        border: "1px solid rgba(28, 28, 30, 0.06)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248, 245, 240, 0.95) 100%)",
      };
    }

    if (reminderContext?.kind === "careRecipient") {
      const recipientName = reminderContext.recipients[0]?.name?.trim() || "someone close";
      const firstRecipient = contactFirstName(recipientName);
      return {
        eyebrow: `Reach out to ${firstRecipient}`,
        support: `${firstRecipient} is the person to contact for ${reminderContext.subjectName}.`,
        border: "1px solid rgba(28, 28, 30, 0.06)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248, 245, 240, 0.95) 100%)",
      };
    }

    if (reminderContext?.kind === "anniversary") {
      return {
        eyebrow: "Celebrate together",
        support: "A shared moment deserves a thoughtful note.",
        border: "1px solid rgba(28, 28, 30, 0.06)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(247, 244, 240, 0.95) 100%)",
      };
    }

    if (reminder.momentType === "custom") {
      return {
        eyebrow: "A meaningful moment",
        support: "A small reminder can help you show up well.",
        border: "1px solid rgba(28, 28, 30, 0.07)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(247, 244, 240, 0.95) 100%)",
      };
    }

    return {
      eyebrow: "Reach out directly",
      support: section === "tomorrow" ? "You could make tomorrow feel a little more special." : "Today might be a nice day to reach out.",
      border: "1px solid rgba(28, 28, 30, 0.07)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247, 244, 240, 0.95) 100%)",
    };
  }

  function buildReminderDisplay(reminder: ReminderEvent, section: "today" | "tomorrow" | "horizon") {
    const display = formatReminderCard(reminder);
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const childContext = getChildBirthdayContext(reminder, people, today);
    const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);
    const presentation = reminderCardPresentation(reminder, section);
    const personName = (person?.name ?? reminder.personName).trim();
    const childName = reminderContext?.kind === "childBirthday" ? reminderContext.subjectName : childContext?.childName ?? "";
    const eventDate = reminderEventDate(reminder);

    let reminderAge: number | undefined;
    let birthdayForAge: string | undefined;
    if (reminder.momentType === "childBirthday") {
      birthdayForAge = childContext?.birthday;
    } else {
      const birthdayMoment = (person?.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
      birthdayForAge = (birthdayMoment?.date ?? "").trim() || undefined;
    }

    reminderAge = reminderContext?.subjectAge ?? (birthdayForAge && eventDate ? calculateAge(birthdayForAge, eventDate) : undefined);
    const ideaPool =
      reminder.momentType === "anniversary"
        ? ANNIVERSARY_IDEAS
        : reminderAge !== undefined && MILESTONE_AGES.has(reminderAge)
        ? MILESTONE_QUICK_IDEAS
        : reminderAge !== undefined && reminderAge < 13
        ? CHILD_QUICK_IDEAS
        : reminderAge !== undefined && reminderAge < 18
        ? TEEN_QUICK_IDEAS
        : ADULT_QUICK_IDEAS;
    const contextualSupport =
      reminder.momentType === "anniversary"
        ? "This one deserves something thoughtful"
        : reminderAge !== undefined && MILESTONE_AGES.has(reminderAge)
          ? "This one’s worth celebrating"
          : reminder.momentType === "childBirthday" || (reminderAge !== undefined && reminderAge < 13)
            ? "A small surprise would mean a lot"
            : reminder.momentType === "birthday"
              ? "A quick message would mean a lot"
              : presentation.support;

    const upcomingRelationshipContext =
      section !== "today" ? upcomingRelationshipContextLine(personName, reminderContext, section, eventDate) : null;

    let title = display.label;
    if (section === "today" && reminder.reminderType === "oneDay") {
      title = `Tomorrow: ${stripRelativeSuffix(display.label, "tomorrow")}`;
    } else if (
      section === "today" &&
      reminder.reminderType === "sevenDay" &&
      (reminder.momentType === "birthday" || reminder.momentType === "childBirthday")
    ) {
      title = display.label;
    } else if (section === "today" && reminder.reminderType === "sevenDay") {
      title = `Coming up: ${display.label.replace(/ in 7 days$/, "")}`;
    } else if (section === "tomorrow" && reminder.reminderType === "dayOf") {
      const tomorrowLabel = stripRelativeSuffix(display.label, "today");
      title = tomorrowLabel;
    } else if (section === "horizon") {
      const horizonLabel = stripRelativeSuffix(stripRelativeSuffix(display.label, "today"), "tomorrow").replace(/ in 7 days$/, "");
      title = horizonLabel;
    } else if (
      section === "today" &&
      reminder.reminderType === "dayOf" &&
      reminder.momentType === "childBirthday" &&
      reminderAge !== undefined &&
      childName
    ) {
      title = `${childName} turns ${reminderAge} today`;
    } else if (
      section === "today" &&
      reminder.reminderType === "dayOf" &&
      reminder.momentType === "birthday" &&
      reminderAge !== undefined &&
      MILESTONE_AGES.has(reminderAge)
    ) {
      title = `${personName} turns ${reminderAge} today`;
    }

    if (reminder.momentType === "birthday" || reminder.momentType === "childBirthday") {
      title = `🎂 ${title}`;
    } else if (reminder.momentType === "anniversary") {
      title = `💗 ${title}`;
    }

    const childFocusedIdeaHeading =
      section === "today" &&
      (reminderContext?.kind === "childBirthday" || reminderContext?.kind === "childThroughRelationship")
        ? `Something ${contactFirstName(reminderContext.subjectName)} would love:`
        : null;

    return {
      title,
      date: formatReminderDate(eventDate ? formatYmd(eventDate) : reminder.date),
      eyebrow: presentation.eyebrow,
      support:
        upcomingRelationshipContext ??
        reminderSupportLineOverrides[getReminderId(reminder)] ??
        contextualSupport,
      cardBorder: presentation.border,
      cardBackground: presentation.background,
      giftLine:
        section === "horizon"
          ? buildHorizonPlanningNudge({
              subjectName: reminderContext?.subjectName ?? personName,
              recipientName: reminderContext?.recipients[0]?.name?.trim() || undefined,
              age: reminderAge,
              momentType: reminder.momentType,
            })
          : null,
      actionHeading:
        section === "today"
          ? `Send ${reminderActionRecipientName(reminder, person, people, relationships, today, relationshipV2Links)}:`
          : null,
      ideaHeading:
        childFocusedIdeaHeading ??
        (section === "tomorrow" ? "To make the day feel a little more personal:" : null),
      ideas:
        section === "tomorrow"
          ? buildUpcomingPlanningIdeas({
              seed: getReminderId(reminder),
              subjectName: reminderContext?.subjectName ?? personName,
              recipientName: reminderContext?.recipients[0]?.name?.trim() || undefined,
              age: reminderAge,
              momentType: reminder.momentType,
              section,
            })
          : reminderAge !== undefined && reminderAge < 13 && section === "today"
          ? pickQuickIdeas(getReminderId(reminder), CHILD_QUICK_IDEAS)
              .slice(0, 3)
              .map((idea) => personalizeIdea(idea, reminderContext?.subjectName ?? personName))
          : (reminder.momentType === "birthday" || reminder.momentType === "childBirthday") &&
            section === "today"
          ? pickQuickIdeas(getReminderId(reminder), ideaPool)
              .slice(0, 3)
              .map((idea) => personalizeIdea(idea, reminderContext?.subjectName ?? personName))
          : reminder.reminderType === "dayOf" && section === "today"
          ? pickQuickIdeas(getReminderId(reminder), ideaPool).slice(0, 1)
          : [],
      horizonHeading: null,
      horizonActions: [],
    };
  }

  function markReminderHandled(reminder: ReminderEvent) {
    const reminderId = getReminderId(reminder);
    // eslint-disable-next-line no-console
    console.log("[DKF DEBUG] Mark reminder handled", {
      todayLocal: formatLocalYmd(today),
      reminderType: reminder.reminderType,
      personId: reminder.personId,
      personName: reminder.personName,
      birthdayEventDateLocal: reminder.eventDate,
      reminderTriggerDateLocal: reminder.date,
      handledKey: reminderId,
    });
    markReminderFired(reminderId);
    void cancelScheduledReminderNotificationByReminderId(reminderId);
    setHandledReminderActions((prev) => {
      if (prev[reminderId]) return prev;
      return { ...prev, [reminderId]: true };
    });
    setDismissedReminderKeys((prev) => ({ ...prev, [reminderId]: true }));
  }

  function undoReminderHandled(reminder: ReminderEvent) {
    const reminderId = getReminderId(reminder);
    setHandledReminderActions((prev) => {
      if (!prev[reminderId]) return prev;
      const next = { ...prev };
      delete next[reminderId];
      return next;
    });
    setDismissedReminderKeys((prev) => {
      if (!prev[reminderId]) return prev;
      const next = { ...prev };
      delete next[reminderId];
      return next;
    });
  }

  function dismissReminderCard(reminder: ReminderEvent) {
    recordCareEvent(reminder.personId, "reminderComplete", careEventReminderNote(reminder));
    markReminderHandled(reminder);
  }

  function reminderTextActionLabel(reminder: ReminderEvent, person: Person | null) {
    const first = ((person?.name ?? reminder.personName).trim().split(" ")[0] || reminder.personName || "them").trim();
    const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);

    if (
      (reminderContext?.kind === "childBirthday" ||
        reminderContext?.kind === "childThroughRelationship" ||
        reminderContext?.kind === "careRecipient") &&
      reminderContext.recipients.length > 0
    ) {
      return `Text ${contactFirstName(reminderContext.recipients[0]?.name ?? first)}`;
    }

    return `Text ${first}`;
  }

  function buildRelationshipAwareBirthdaySuggestions(reminder: ReminderEvent, subjectName: string) {
    if (reminder.reminderType === "dayOf") {
      return [
        {
          id: "short",
          message: `Happy birthday to ${subjectName}! 🎉`,
        },
        {
          id: "warm",
          message: `Hope ${subjectName} feels extra loved today.`,
        },
        {
          id: "playful",
          message: `Hope ${subjectName} is having the best kind of birthday chaos today 😂`,
        },
        {
          id: "deeper",
          message: `Thinking of ${subjectName} today and hoping it feels really special.`,
        },
        { id: "custom", label: "Write my own", message: "" },
      ];
    }

    if (reminder.reminderType === "oneDay") {
      return [
        {
          id: "short",
          message: `Tomorrow is ${subjectName}'s birthday! Hope it’s a great one.`,
        },
        {
          id: "warm",
          message: `Hope ${subjectName} feels really celebrated tomorrow.`,
        },
        {
          id: "playful",
          message: `Hope ${subjectName} gets spoiled tomorrow 😂`,
        },
        {
          id: "deeper",
          message: `Thinking of ${subjectName}'s birthday tomorrow and sending love your way.`,
        },
        { id: "custom", label: "Write my own", message: "" },
      ];
    }

    return [
      {
        id: "short",
        message: `${subjectName}'s birthday is coming up soon. Hope it’s already feeling exciting.`,
      },
      {
        id: "warm",
        message: `Thinking ahead to ${subjectName}'s birthday and hoping it feels really special.`,
      },
      {
        id: "playful",
        message: `Big birthday energy coming up for ${subjectName} 🎉`,
      },
      {
        id: "deeper",
        message: `Wanted to send some birthday love early for ${subjectName}.`,
      },
      { id: "custom", label: "Write my own", message: "" },
    ];
  }

  function buildReminderActions(reminder: ReminderEvent) {
    const person = people.find((candidate) => candidate.id === reminder.personId) ?? null;
    const first = ((person?.name ?? reminder.personName).trim().split(" ")[0] || reminder.personName || "them").trim();
    const reminderContext = resolveReminderContext(reminder, people, relationships, today, relationshipV2Links);
    const relationalRecipients =
      reminderContext?.kind === "childThroughRelationship" ||
      reminderContext?.kind === "childBirthday" ||
      reminderContext?.kind === "careRecipient"
        ? reminderContext.recipients
        : [];

    if (relationalRecipients.length > 0 && reminderContext) {
      const recipient = relationalRecipients[0];
      const recipientFirst = contactFirstName(recipient.name);

      return [
        {
          label: `Text ${recipientFirst}`,
          title: !recipient.phone ? "Add a phone number to text them." : undefined,
          onClick: () => {
            if (!recipient.phone) {
              window.alert("Add a phone number to text them.");
              return;
            }

            openSmartMessageSuggestions({
              personName: recipientFirst,
              phone: recipient.phone,
              suggestions: buildRelationshipAwareBirthdaySuggestions(reminder, reminderContext.subjectName),
            });
          },
        },
        ...(relationalRecipients.length === 1
          ? [
              {
                label: "Card",
                href: "https://www.americangreetings.com/ecards",
              },
              {
                label: "Coffee",
                href: "https://www.starbucks.com/gift",
              },
              {
                label: "Gift",
                href: "https://www.amazon.com/gift-cards",
              },
              {
                label: "Dessert",
                href: "https://www.ubereats.com/",
              },
            ]
          : []),
        {
          label: "Done for today",
          onClick: () => dismissReminderCard(reminder),
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

          const short = isKidBirthday
            ? `Happy birthday ${childName || "to your little one"}!! 🎉`
            : isBirthday
              ? `Happy birthday ${toName}!! 🎉`
              : isAnniversary
                ? `Happy anniversary ${toName}! ❤️`
                : `Thinking of you today, ${toName}.`;

          const warm = isKidBirthday
            ? `Hope ${childName || "your little one"} has the sweetest birthday today.`
            : isBirthday
              ? "Hope today’s a good one — you deserve it."
              : isAnniversary
                ? "Hope you both get a little time to celebrate today."
                : "Hope today feels a little lighter. Thinking of you.";

          const playful = isKidBirthday
            ? `Hope ${childName || "your little one"} is living their best birthday life today 😂`
            : isBirthday
              ? "Another year older, still crushing it 🙌"
              : isAnniversary
                ? "Still cute together after all this time 😂"
                : "Just checking in before today runs away with you.";

          const deeper = isKidBirthday
            ? `Thinking of ${childName || "your little one"} today — hope it’s a really special birthday.`
            : isBirthday
              ? "Hope today feels special in all the right ways."
              : isAnniversary
                ? "Hope today brings back some really good memories."
                : "Just wanted to say I’m thinking of you today.";

          openSmartMessageSuggestions({
            personName: toName,
            phone: person.phone,
            suggestions: [
              { id: "short", message: short },
              { id: "warm", message: warm },
              { id: "playful", message: playful },
              { id: "deeper", message: deeper },
              { id: "custom", label: "Write my own", message: "" },
            ],
          });
        },
      },
      {
        label: "Card",
        href: "https://www.americangreetings.com/ecards",
      },
      {
        label: "Coffee",
        href: "https://www.starbucks.com/gift",
      },
      {
        label: "Gift",
        href: "https://www.amazon.com/gift-cards",
      },
      {
        label: "Dessert",
        href: "https://www.ubereats.com/",
      },
      {
        label: "Done for today",
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
    suggestions: Array<{ id: string; label?: string; message: string }>;
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

  function handleMotherPromptYes(prompt: MotherPromptItem) {
    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (!person) {
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "DISCOVER_MOTHER") {
      updatePersonFields(prompt.personId, { isMother: true, hasKids: true });
      dismissPrompt(prompt);
      return;
    }

    const first = (person.name ?? "").trim().split(" ")[0] || person.name || "there";
    if (person.phone) openSmsComposer(person.phone, `Happy Mother’s Day, ${first}. Thinking of you today.`);
    dismissPrompt(prompt);
  }

  function handleMotherPromptNo(prompt: MotherPromptItem) {
    if (prompt.type === "DISCOVER_MOTHER") {
      updatePersonFields(prompt.personId, { isMother: false });
    }
    dismissPrompt(prompt);
  }

  function handleFatherPromptYes(prompt: FatherPromptItem) {
    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (!person) {
      dismissPrompt(prompt);
      return;
    }

    if (prompt.type === "DISCOVER_FATHER") {
      updatePersonFields(prompt.personId, { isFather: true, hasKids: true });
      dismissPrompt(prompt);
      return;
    }

    const first = (person.name ?? "").trim().split(" ")[0] || person.name || "there";
    if (person.phone) openSmsComposer(person.phone, `Happy Father’s Day, ${first}. Thinking of you today.`);
    dismissPrompt(prompt);
  }

  function handleFatherPromptNo(prompt: FatherPromptItem) {
    if (prompt.type === "DISCOVER_FATHER") {
      updatePersonFields(prompt.personId, { isFather: false });
    }
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

  const horizonRecommendations = useMemo(
    () => pickRandomRecommendations(sheetRecommendations),
    [sheetRecommendations]
  );

  const activeQuestion = useMemo(() => {
    return visibleCareSuggestions.find((s) => s.type === "question" && s.question) ?? null;
  }, [visibleCareSuggestions]);

  const legacyPrompts = useMemo(() => {
    if (activeTab !== "home") return [];
    return [
      ...getMotherPrompts(filteredPeople),
      ...getFatherPrompts(filteredPeople),
      ...getAnniversaryPrompts(filteredPeople),
      ...getBirthdayPrompts(filteredPeople),
      ...getKidsBirthdayPrompts(filteredPeople),
    ];
  }, [activeTab, filteredPeople, questionTick]);

  const activeLegacyPrompt = useMemo(() => {
    const prompts = legacyPrompts.filter((prompt) => {
      try {
        return !window.localStorage.getItem(promptDismissKey(prompt));
      } catch {
        return true;
      }
    });
    return prompts[0] ?? null;
  }, [legacyPrompts]);

  const activeCareSuggestion = useMemo(() => {
    if (activeQuestion) return null;
    return visibleCareSuggestions.find((s) => s.type !== "question") ?? null;
  }, [activeQuestion, visibleCareSuggestions]);

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

  const greetingText = isContacts ? "Your circle" : "Today";

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

  function dismissCircleSuccess() {
    setCircleSuccessMessage("");
    setRecentlyAddedPersonId(null);
    setConnectPersonConfirmation("");
    setIsConnectPersonOpen(false);
    setConnectPersonQuery("");
    setSelectedConnectionTargetId(null);
    setSelectedConnectionType(null);
  }

  function openConnectPersonFlow() {
    setIsConnectPersonOpen(true);
    setConnectPersonQuery("");
    setSelectedConnectionTargetId(null);
    setSelectedConnectionType(null);
  }

  function closeConnectPersonFlow() {
    setIsConnectPersonOpen(false);
    setConnectPersonQuery("");
    setSelectedConnectionTargetId(null);
    setSelectedConnectionType(null);
  }

  function saveConnectedPersonLink() {
    if (!recentlyAddedPerson || !selectedConnectionTargetId || !selectedConnectionType) return;
    const connectedPerson = availableConnectionTargets.find((person) => person.id === selectedConnectionTargetId) ?? null;
    const relationshipPersistence = buildAddPersonRelationshipPersistence({
      personId: recentlyAddedPerson.id,
      makeId,
      selectedRelationshipType: null,
      selectedConnectionId: selectedConnectionTargetId,
      connectionRelationship: selectedConnectionType,
    });

    const personPatch =
      selectedConnectionType === "partner"
        ? { ...recentlyAddedPerson, partnerId: selectedConnectionTargetId }
        : recentlyAddedPerson;

    savePerson({
      person: personPatch,
      createdPeople: [],
      createdRelationships: relationshipPersistence.createdRelationships,
      createdRelationshipLinksV2: relationshipPersistence.createdRelationshipLinksV2,
      replaceRelationshipLinksV2ForPersonId: relationshipPersistence.replaceRelationshipLinksV2ForPersonId,
    });
    if (connectedPerson) {
      setConnectPersonConfirmation(
        `We'll help you reach out to ${displayNameOrFallback(connectedPerson.name)} for ${recentlyAddedPerson.name}.`
      );
    }
    closeConnectPersonFlow();
  }

  useEffect(() => {
    if (location.state?.defaultTab === "contacts" && isHome) {
      navigate("/contacts", { replace: true });
      return;
    }

    if (location.state?.circleSuccessMessage && isContacts) {
      const nextMessage = String(location.state.circleSuccessMessage);
      setCircleSuccessMessage(nextMessage);
      setConnectPersonConfirmation("");
      setRecentlyAddedPersonId(
        location.state?.addedPersonId ? String(location.state.addedPersonId) : null
      );

      window.history.replaceState({}, document.title, location.pathname);
    }

    if (location.state?.defaultTab || location.state?.showPartnerLinkCheck || location.state?.circleSuccessMessage) {
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [isHome, location.pathname, location.state, navigate]);

  function navigateToAddPerson() {
    if (!isPremium && people.length >= FREE_LIMIT) {
      navigate("/paywall");
      return;
    }
    navigate("/add");
  }

  function navigateToImportContacts() {
    if (!isPremium && people.length >= FREE_LIMIT) {
      navigate("/paywall");
      return;
    }
    navigate("/import");
  }

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
        <style>{`
          @keyframes dkfReminderCompleteCard {
            0% {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
            45% {
              transform: translateY(-3px) scale(1.01);
              opacity: 1;
            }
            100% {
              transform: translateY(0) scale(1);
              opacity: 0.74;
            }
          }

          @keyframes dkfReminderCompleteCheck {
            0% {
              opacity: 0;
              transform: scale(0.88);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
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

          {isContacts ? (
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
          ) : null}

          <div
            style={{
              marginTop: isContacts ? "10px" : "12px",
              color: "var(--muted)",
              fontSize: "18px",
              lineHeight: 1.45,
              fontFamily: "var(--font-sans)",
            }}
          >
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
            Circle
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

        {activeTab === "contacts" && isSearching ? (
          <div style={{ marginTop: "10px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
            <ContactsSearchResults
              results={contactSearchResults}
              onSelect={(person) => navigate(`/person/${person.id}`)}
            />
          </div>
        ) : null}

        <main style={{ marginTop: "24px" }}>
          {isSearching ? null : activeTab === "contacts" ? (
            <section aria-label="Circle" style={{ marginTop: "24px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
              {!circleSuccessMessage || !recentlyAddedPerson ? (
                <div style={{ display: "grid", gap: "8px" }}>
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div
                      style={{
                        color: "var(--ink)",
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.45rem",
                        lineHeight: 1.02,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      Who comes to mind?
                    </div>
                    <div style={{ color: "var(--muted)", lineHeight: 1.55, fontSize: "0.98rem", maxWidth: "34rem" }}>
                      Add someone you care about. A birthday, milestone, or meaningful detail is enough to begin.
                    </div>
                  </div>
                </div>
              ) : null}

              {circleSuccessMessage && recentlyAddedPerson ? (
                <div
                  style={{
                    marginTop: "22px",
                    borderRadius: "24px",
                    border: "1px solid rgba(28, 28, 30, 0.07)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 14px 30px rgba(28, 28, 30, 0.05)",
                    padding: "18px 18px 18px",
                    display: "grid",
                    gap: "16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={dismissCircleSuccess}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      Close
                    </button>
                  </div>
                  <div style={{ display: "grid", gap: "6px" }}>
                    <div
                      style={{
                        color: "var(--ink)",
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.5rem",
                        lineHeight: 1.04,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {recentlyAddedPerson.name} is safely in your Circle.
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.97rem", lineHeight: 1.55 }}>
                      {buildRecentlyAddedReassurance(recentlyAddedPerson.name, recentlyAddedPerson)}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.97rem", lineHeight: 1.55 }}>
                      You don&apos;t have to keep this in your head anymore.
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: "0.97rem", lineHeight: 1.55 }}>
                      When the time comes, we&apos;ll help you show up for {recentlyAddedPerson.name}.
                    </div>
                  </div>

                  {availableConnectionTargets.length ? (
                    <div
                      style={{
                        display: "grid",
                        gap: "8px",
                        paddingTop: "2px",
                      }}
                    >
                      <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                        Want to connect {recentlyAddedPerson.name} to someone?
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={openConnectPersonFlow}
                          style={{
                            border: "1px solid rgba(28, 28, 30, 0.08)",
                            background: "rgba(255,255,255,0.98)",
                            color: CIRCLE_NAVY,
                            cursor: "pointer",
                            padding: "0.7rem 0.95rem",
                            fontSize: "0.93rem",
                            fontWeight: 600,
                            fontFamily: "var(--font-sans)",
                            borderRadius: "12px",
                            boxShadow: "0 6px 16px rgba(28, 28, 30, 0.035)",
                          }}
                        >
                          Connect {recentlyAddedPerson.name}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {connectPersonConfirmation ? (
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "0.95rem",
                        lineHeight: 1.5,
                      }}
                    >
                      {connectPersonConfirmation}
                    </div>
                  ) : null}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/person/${recentlyAddedPerson.id}`)}
                      style={{
                        border: `1px solid ${CIRCLE_NAVY}`,
                        background: CIRCLE_NAVY,
                        color: "var(--paper)",
                        cursor: "pointer",
                        borderRadius: "12px",
                        padding: "0.76rem 1rem",
                        fontSize: "0.95rem",
                        fontWeight: 600,
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      View {recentlyAddedPerson.name}
                    </button>
                  </div>
                </div>
              ) : null}

              {circleSuccessMessage && recentlyAddedPerson ? (
                <div
                  style={{
                    marginTop: "30px",
                    paddingTop: "22px",
                    borderTop: "1px solid rgba(28, 28, 30, 0.07)",
                    display: "grid",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      borderRadius: "18px",
                      border: "1px solid rgba(28, 28, 30, 0.07)",
                      background: "rgba(255,255,255,0.9)",
                      padding: "16px",
                    }}
                  >
                    <button
                      type="button"
                      className="dkf-circle-shimmer-button"
                      onClick={navigateToAddPerson}
                      style={{
                        width: "100%",
                        border: "1px solid rgba(220, 206, 179, 0.95)",
                        background: "linear-gradient(180deg, rgba(250, 247, 241, 0.98) 0%, rgba(244, 238, 228, 0.98) 100%)",
                        color: CIRCLE_NAVY,
                        cursor: "pointer",
                        textAlign: "center",
                        fontWeight: 600,
                        letterSpacing: "0.01em",
                        borderRadius: "14px",
                        padding: "0.82rem 1rem",
                        fontSize: "0.98rem",
                        fontFamily: "var(--font-sans)",
                        boxShadow:
                          "0 10px 24px rgba(193, 179, 156, 0.12), 0 2px 8px rgba(193, 179, 156, 0.08), inset 0 1px 0 rgba(255,255,255,0.78)",
                        transition: "background 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
                      }}
                    >
                      Add a Person
                    </button>
                  </div>

                  <div
                    style={{
                      borderRadius: "18px",
                      border: "1px solid rgba(28, 28, 30, 0.07)",
                      background: "rgba(255,255,255,0.9)",
                      padding: "14px 16px",
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <div style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                      Building a bigger circle? Import your contacts to get started faster.
                    </div>
                    <button
                      onClick={navigateToImportContacts}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                        textAlign: "left",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        borderRadius: "12px",
                        padding: 0,
                        fontSize: "0.92rem",
                        fontFamily: "var(--font-sans)",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                      }}
                    >
                      Import from Contacts
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: "24px",
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  <button
                    onClick={navigateToAddPerson}
                    style={{
                      width: "100%",
                      border: "1px solid var(--border-strong)",
                      background: "rgba(255,255,255,0.46)",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "12px",
                      padding: "0.82rem 1rem",
                      fontSize: "0.97rem",
                      fontFamily: "var(--font-sans)",
                      boxShadow: "none",
                    }}
                  >
                    Add a Person
                  </button>
                  <div
                    style={{
                      marginTop: "6px",
                      paddingTop: "16px",
                      borderTop: "1px solid var(--border)",
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5, textAlign: "center" }}>
                      Building a bigger circle? Import your contacts to get started faster.
                    </div>
                    <button
                      onClick={navigateToImportContacts}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                        textAlign: "center",
                        fontWeight: 500,
                        letterSpacing: "0.01em",
                        borderRadius: "12px",
                        padding: "0.2rem 0.5rem",
                        fontSize: "0.92rem",
                        fontFamily: "var(--font-sans)",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                      }}
                    >
                      Import from Contacts
                    </button>
                  </div>
                </div>
              )}

              {!isPremium && people.length >= FREE_LIMIT ? (
                <div style={{ marginTop: "8px", color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.5 }}>
                  {`Your circle has ${people.length} people. Add more with Premium.`}
                </div>
              ) : null}

              {filteredPeople.length === 0 ? (
                <div style={{ marginTop: "24px" }}>
                  {hasContacts ? (
                    <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No match found.</div>
                  ) : (
                    <div style={{ display: "none" }} aria-hidden="true" />
                  )}
                </div>
              ) : (
                <div style={{ marginTop: "24px" }}>
                  <PeopleIndex people={filteredPeople} today={today} onSelectPerson={(p) => navigate(`/person/${p.id}`)} />
                </div>
              )}
            </section>
          ) : (
            <section aria-label="Home" style={{ marginTop: "24px", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
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
                  const expandedHorizonEntries = homeSections.expandedHorizonEntries;
                  const hasMoreHorizonEntries = expandedHorizonEntries.length > 0;
                  const showHorizonSection = horizonEntries.length > 0 || hasMoreHorizonEntries;
                  const hasPendingReminders = todayReminders.length > 0 || tomorrowReminders.length > 0 || horizonEntries.length > 0;
                  void handleSuggestionAction;
                  void handleQuestionChoose;
                  void handleQuestionDismiss;
                  void handleBirthdayPromptNo;
                  void handleBirthdayPromptYes;
                  void handleAnniversaryPromptNo;
                  void handleAnniversaryPromptYes;
                  void handleKidsBirthdayPromptNo;
                  void handleKidsBirthdayPromptYes;
                  void handleMotherPromptNo;
                  void handleMotherPromptYes;
                  void handleFatherPromptNo;
                  void handleFatherPromptYes;
                  void partnerLinkPrompt;
                  const renderPromptGrid = (children: React.ReactNode) => (
                    <div style={{ display: "grid", gap: "16px" }}>{children}</div>
                  );

                  const showDiscoverySurface = todayReminders.length === 0 && tomorrowReminders.length === 0;

                  const renderLegacyPrompt = (prompt: PromptItem) => {
                    if (prompt.type === "DISCOVER_BIRTHDAY" || prompt.type === "PREP_BIRTHDAY" || prompt.type === "TOMORROW_BIRTHDAY" || prompt.type === "TODAY_BIRTHDAY") {
                      return (
                        <SmartSuggestionCard
                          variant={prompt.type === "DISCOVER_BIRTHDAY" ? "discover" : "nudge"}
                          message={prompt.message}
                          onYes={() => handleBirthdayPromptYes(prompt)}
                          onNo={() => handleBirthdayPromptNo(prompt)}
                          yesLabel={prompt.type === "DISCOVER_BIRTHDAY" ? "Add it" : "Do it"}
                          noLabel="Not now"
                        />
                      );
                    }

                    if (
                      prompt.type === "DISCOVER_ANNIVERSARY" ||
                      prompt.type === "PREP_ANNIVERSARY" ||
                      prompt.type === "ANNIVERSARY_TOMORROW" ||
                      prompt.type === "ANNIVERSARY_TODAY"
                    ) {
                      return (
                        <SmartSuggestionCard
                          variant={prompt.type === "DISCOVER_ANNIVERSARY" ? "discover" : "nudge"}
                          message={prompt.message}
                          onYes={() => handleAnniversaryPromptYes(prompt)}
                          onNo={() => handleAnniversaryPromptNo(prompt)}
                          yesLabel={prompt.type === "DISCOVER_ANNIVERSARY" ? "Add it" : "Do it"}
                          noLabel="Not now"
                        />
                      );
                    }

                    if (
                      prompt.type === "DISCOVER_CHILD_BIRTHDAY" ||
                      prompt.type === "PREP_CHILD_BIRTHDAY" ||
                      prompt.type === "TOMORROW_CHILD_BIRTHDAY" ||
                      prompt.type === "TODAY_CHILD_BIRTHDAY"
                    ) {
                      return (
                        <SmartSuggestionCard
                          variant={prompt.type === "DISCOVER_CHILD_BIRTHDAY" ? "discover" : "nudge"}
                          message={prompt.message}
                          onYes={() => handleKidsBirthdayPromptYes(prompt)}
                          onNo={() => handleKidsBirthdayPromptNo(prompt)}
                          yesLabel={prompt.type === "DISCOVER_CHILD_BIRTHDAY" ? "Add it" : "Do it"}
                          noLabel="Not now"
                        />
                      );
                    }

                    if (prompt.type === "DISCOVER_MOTHER" || prompt.type === "NUDGE_MOTHERS_DAY") {
                      return (
                        <SmartSuggestionCard
                          variant={prompt.type === "DISCOVER_MOTHER" ? "discover" : "nudge"}
                          message={prompt.message}
                          onYes={() => handleMotherPromptYes(prompt)}
                          onNo={() => handleMotherPromptNo(prompt)}
                          yesLabel={prompt.type === "DISCOVER_MOTHER" ? "Yes" : "Text"}
                          noLabel="Not now"
                        />
                      );
                    }

                    if (prompt.type === "DISCOVER_FATHER" || prompt.type === "NUDGE_FATHERS_DAY") {
                      return (
                        <SmartSuggestionCard
                          variant={prompt.type === "DISCOVER_FATHER" ? "discover" : "nudge"}
                          message={prompt.message}
                          onYes={() => handleFatherPromptYes(prompt)}
                          onNo={() => handleFatherPromptNo(prompt)}
                          yesLabel={prompt.type === "DISCOVER_FATHER" ? "Yes" : "Text"}
                          noLabel="Not now"
                        />
                      );
                    }

                    return null;
                  };

                  const renderCareSuggestionCard = (suggestion: typeof activeCareSuggestion) => {
                    if (!suggestion) return null;
                    const message = [suggestion.title, suggestion.message, suggestion.insight].filter(Boolean).join("\n");
                    return (
                      <SmartSuggestionCard
                        variant="nudge"
                        message={message}
                        actions={[
                          {
                            label: suggestion.actionLabel,
                            onClick: () => handleSuggestionAction(suggestion.id),
                          },
                          {
                            label: "Not now",
                            onClick: () => {
                              try {
                                window.localStorage.setItem(
                                  `doknotforget_snooze_${suggestion.id}`,
                                  String(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                );
                              } catch {
                                // ignore
                              }
                              setQuestionTick((v) => v + 1);
                            },
                          },
                        ]}
                      />
                    );
                  };

                  const renderReminderCards = (items: ReminderEvent[], section: "today" | "tomorrow" | "horizon") => (
                    <div style={{ display: "grid", gap: "16px" }}>
                      {items.map((reminder) => {
                        const reminderId = getReminderId(reminder);
                        const display = buildReminderDisplay(reminder, section);
                        const actions = section === "today" ? buildReminderActions(reminder) : [];
                        const isCompleted = Boolean(handledReminderActions[reminderId]);
                        const completionAction = isCompleted
                          ? null
                          : actions.find((action) => action.label === "Done for today") ?? null;
                        const primaryActions = isCompleted
                          ? []
                          : actions.filter((action) => action.label !== "Done for today");

                        return (
                          <div
                            key={reminderId}
                            className={isCompleted ? "smart-card dkf-reminder-complete-card" : "smart-card"}
                            onClick={() => navigate(`/person/${reminder.personId}`)}
                            style={{
                              border: display.cardBorder,
                              borderRadius: "20px",
                              background: display.cardBackground,
                              padding: "18px",
                              overflow: "hidden",
                              display: "grid",
                              gap: "16px",
                              backdropFilter: "blur(4px)",
                              boxShadow: isCompleted ? "0 8px 20px rgba(28, 28, 30, 0.03)" : "0 10px 24px rgba(28, 28, 30, 0.04)",
                              opacity: isCompleted ? 0.72 : 1,
                              cursor: "pointer",
                              animation: isCompleted ? "dkfReminderCompleteCard 260ms ease-out" : undefined,
                              transformOrigin: "center",
                            }}
                          >
                            <div style={{ display: "grid", gap: "11px", minWidth: 0 }}>
                                <div style={{ color: "var(--ink)", fontSize: "16px", lineHeight: 1.5, fontWeight: 700 }}>
                                  {display.title}
                                </div>
                                {section !== "today" ? (
                                  <div
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      color: "var(--ink)",
                                      fontSize: "15px",
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    <span
                                      aria-hidden="true"
                                      style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "999px",
                                        background: "var(--dkf-gold)",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span>{display.date}</span>
                                  </div>
                                ) : null}
                                {display.support ? (
                                  <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.55, marginTop: "4px" }}>
                                    {display.support}
                                  </div>
                                ) : null}
                                {display.giftLine ? (
                                  <div
                                    style={{
                                      color: "var(--ink)",
                                      fontSize: "0.97rem",
                                      lineHeight: 1.55,
                                      marginTop: "6px",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {display.giftLine}
                                  </div>
                                ) : null}

                                {!isCompleted && display.ideas.length ? (
                                  <div
                                    style={{
                                      display: "grid",
                                      gap: "10px",
                                      paddingTop: "18px",
                                    }}
                                  >
                                  {display.ideaHeading ? (
                                    <div style={{ color: "var(--muted)", fontSize: "0.95rem", fontWeight: 600 }}>
                                      {display.ideaHeading}
                                    </div>
                                  ) : null}
                                  <div
                                    style={{
                                      display: "grid",
                                      gap: "10px",
                                      color: "rgba(28, 28, 30, 0.88)",
                                      fontSize: "1rem",
                                      lineHeight: 1.55,
                                    }}
                                  >
                                    {display.ideas.map((idea) => (
                                      <div
                                        key={idea}
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "14px 1fr",
                                          columnGap: "12px",
                                          alignItems: "start",
                                        }}
                                      >
                                        <span style={{ color: "var(--dkf-gold)", fontSize: "0.92rem", lineHeight: 1.45, transform: "translateY(1px)" }}>•</span>
                                        <span>{idea}</span>
                                      </div>
                                    ))}
                                  </div>
                                  </div>
                                ) : null}
                              </div>

                            {!isCompleted && (primaryActions.length > 0 || completionAction) ? (
                              <div style={{ display: "grid", gap: "10px", paddingTop: display.ideas.length ? "16px" : "8px" }}>
                                {primaryActions.length > 0 ? (
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: primaryActions.length > 1 ? "repeat(2, minmax(120px, 138px))" : "minmax(120px, 138px)",
                                      columnGap: "16px",
                                      rowGap: "10px",
                                      alignItems: "start",
                                      justifyContent: primaryActions.length > 1 ? "space-between" : "start",
                                    }}
                                  >
                                    {"href" in primaryActions[0] && primaryActions[0].href ? (
                                      <a
                                        href={primaryActions[0].href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                        }}
                                        aria-disabled={"disabled" in primaryActions[0] && primaryActions[0].disabled ? "true" : undefined}
                                        title={(primaryActions[0] as { title?: string }).title}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          alignSelf: "start",
                                          width: "138px",
                                          minHeight: "44px",
                                          marginLeft: "-8px",
                                          borderRadius: "12px",
                                          border: `1px solid ${CIRCLE_NAVY}`,
                                          padding: "0.74rem 0.88rem",
                                          fontSize: "0.88rem",
                                          fontWeight: 600,
                                          fontFamily: "inherit",
                                          background: CIRCLE_NAVY,
                                          color: "var(--paper)",
                                          cursor: "pointer",
                                          boxShadow: "0 12px 26px rgba(20, 36, 54, 0.18)",
                                          textDecoration: "none",
                                          boxSizing: "border-box",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          opacity: "disabled" in primaryActions[0] && primaryActions[0].disabled ? 0.5 : 1,
                                          pointerEvents: "disabled" in primaryActions[0] && primaryActions[0].disabled ? "none" : undefined,
                                        }}
                                      >
                                        {primaryActions[0].label}
                                      </a>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          const action = primaryActions[0];
                                          if ("onClick" in action && typeof action.onClick === "function") {
                                            action.onClick();
                                          }
                                        }}
                                        disabled={Boolean("disabled" in primaryActions[0] && primaryActions[0].disabled)}
                                        title={"title" in primaryActions[0] && typeof primaryActions[0].title === "string" ? primaryActions[0].title : undefined}
                                        style={{
                                          alignSelf: "start",
                                          width: "138px",
                                          minHeight: "44px",
                                          marginLeft: "-8px",
                                          borderRadius: "12px",
                                          padding: "0.74rem 0.88rem",
                                          fontSize: "0.88rem",
                                          fontWeight: 600,
                                          border: `1px solid ${CIRCLE_NAVY}`,
                                          background: CIRCLE_NAVY,
                                          color: "var(--paper)",
                                          boxShadow: "0 12px 26px rgba(20, 36, 54, 0.18)",
                                          whiteSpace: "nowrap",
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                        }}
                                      >
                                        {primaryActions[0].label}
                                      </button>
                                    )}

                                    {primaryActions.length > 1 ? (
                                      <div
                                        style={{
                                          display: "grid",
                                          gap: "8px",
                                          alignItems: "stretch",
                                          width: "138px",
                                        }}
                                      >
                                        {display.actionHeading ? (
                                          <div
                                            style={{
                                              color: "rgba(108, 111, 115, 0.82)",
                                              fontSize: "0.76rem",
                                              lineHeight: 1.4,
                                              fontWeight: 600,
                                              letterSpacing: "0.02em",
                                              marginBottom: "2px",
                                            }}
                                          >
                                            {display.actionHeading}
                                          </div>
                                        ) : null}
                                        {primaryActions.slice(1).map((action) =>
                                          "href" in action && action.href ? (
                                            <a
                                              key={action.label}
                                              href={action.href}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                              }}
                                              aria-disabled={"disabled" in action && action.disabled ? "true" : undefined}
                                              title={(action as { title?: string }).title}
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(205, 168, 102, 0.28)",
                                                background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(251,247,239,0.98) 100%)",
                                                color: "rgba(28, 28, 30, 0.88)",
                                                fontSize: "0.88rem",
                                                fontWeight: 600,
                                                minHeight: "44px",
                                                padding: "0.74rem 0.88rem",
                                                textDecoration: "none",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                width: "138px",
                                                boxSizing: "border-box",
                                                boxShadow: "0 12px 24px rgba(20, 36, 54, 0.08), 0 2px 6px rgba(205, 168, 102, 0.08), inset 0 1px 0 rgba(255,255,255,0.98)",
                                                opacity: "disabled" in action && action.disabled ? 0.5 : 1,
                                                pointerEvents: "disabled" in action && action.disabled ? "none" : undefined,
                                              }}
                                            >
                                              <span>{reminderSecondaryActionLabel(action.label)}</span>
                                            </a>
                                          ) : (
                                            <button
                                              key={action.label}
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                if ("onClick" in action && typeof action.onClick === "function") {
                                                  action.onClick();
                                                }
                                              }}
                                              disabled={Boolean("disabled" in action && action.disabled)}
                                              title={"title" in action && typeof action.title === "string" ? action.title : undefined}
                                              style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                borderRadius: "12px",
                                                border: "1px solid rgba(205, 168, 102, 0.28)",
                                                background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(251,247,239,0.98) 100%)",
                                                color: "rgba(28, 28, 30, 0.88)",
                                                fontSize: "0.88rem",
                                                fontWeight: 600,
                                                minHeight: "44px",
                                                padding: "0.74rem 0.88rem",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                width: "138px",
                                                boxSizing: "border-box",
                                                boxShadow: "0 12px 24px rgba(20, 36, 54, 0.08), 0 2px 6px rgba(205, 168, 102, 0.08), inset 0 1px 0 rgba(255,255,255,0.98)",
                                              }}
                                            >
                                              <span>{reminderSecondaryActionLabel(action.label)}</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                {completionAction ? (
                                  <div
                                    style={{
                                      paddingTop: "8px",
                                      borderTop: "1px solid rgba(28, 28, 30, 0.06)",
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (typeof completionAction.onClick === "function") {
                                          completionAction.onClick();
                                        }
                                      }}
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        padding: 0,
                                        color: "rgba(28, 28, 30, 0.68)",
                                        fontSize: "0.89rem",
                                        fontWeight: 500,
                                        textDecoration: "underline",
                                        textUnderlineOffset: "3px",
                                      }}
                                    >
                                      {completionAction.label}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}

                            {isCompleted ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "12px",
                                  paddingTop: "4px",
                                  paddingBottom: "4px",
                                }}
                              >
                                <div
                                  style={{
                                    color: "var(--ink)",
                                    fontSize: "1rem",
                                    lineHeight: 1.5,
                                    fontWeight: 500,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.55rem",
                                    animation: "dkfReminderCompleteCheck 180ms ease-out",
                                  }}
                                >
                                  <span
                                    aria-hidden="true"
                                    style={{
                                      width: "1.35rem",
                                      height: "1.35rem",
                                      borderRadius: "999px",
                                      display: "inline-grid",
                                      placeItems: "center",
                                      background: "rgba(215, 186, 118, 0.18)",
                                      color: "var(--ink)",
                                      fontSize: "0.85rem",
                                      lineHeight: 1,
                                    }}
                                  >
                                    ✓
                                  </span>
                                  {`You showed up for ${displayNameOrFallback(reminder.personName)} today`}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    undoReminderHandled(reminder);
                                  }}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    padding: 0,
                                    color: "var(--ink)",
                                    fontSize: "0.95rem",
                                    fontWeight: 600,
                                    textDecoration: "underline",
                                    textUnderlineOffset: "3px",
                                  }}
                                >
                                  Undo
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  );

                  const renderEmpty = () => {
                    if (hasPendingReminders) return null;
                    if (searchTerm.trim() && filteredPeople.length === 0) {
                      return (
                        <div style={{ marginTop: "1.5rem", padding: "2.25rem 0", textAlign: "center" }}>
                          <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No match found.</div>
                        </div>
                      );
                    }

                    return (
                      <div
                        style={{
                          marginTop: "1.5rem",
                          padding: "2.5rem 1.5rem",
                          display: "grid",
                          gap: "14px",
                          justifyItems: "center",
                          textAlign: "center",
                          border: "1px solid var(--border)",
                          borderRadius: "18px",
                          background: "rgba(255,255,255,0.58)",
                        }}
                        >
                          <CircleEmptyStateGraphic />
                          <div
                          style={{
                            color: "var(--ink)",
                            fontSize: "1.35rem",
                            fontWeight: 600,
                            letterSpacing: "-0.02em",
                            fontFamily: "var(--font-serif)",
                          }}
                        >
                          Every important person has a story worth remembering.
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: "0.98rem", lineHeight: 1.55 }}>
                          Birthdays are just the beginning. We&apos;ll help you remember the people, moments, and little details that make someone feel truly remembered.
                        </div>
                        <button
                          type="button"
                          onClick={navigateToAddPerson}
                          style={{
                            marginTop: "4px",
                            border: "1px solid var(--ink)",
                            background: "var(--ink)",
                            color: "var(--paper)",
                            cursor: "pointer",
                            textAlign: "center",
                            fontWeight: 600,
                            letterSpacing: "0.01em",
                            borderRadius: "12px",
                            padding: "0.85rem 1.2rem",
                            fontSize: "1rem",
                            fontFamily: "var(--font-sans)",
                          }}
                        >
                          Start with someone
                        </button>
                      </div>
                    );
                  };

                  const renderRecommendationsSection = (marginTop: string) => {
                    const data = horizonRecommendations;
                    if (!data || data.length === 0) {
                      console.warn("Recommendations component received no data");
                      return null;
                    }

                    const nextEvent = horizonEntries?.[0] ?? null;
                    const targetName = nextEvent?.moment.personName?.trim() || "them";
                    if (!nextEvent) return null;
                    if (nextEvent.reminder) {
                      const reminderContext = resolveReminderContext(
                        nextEvent.reminder,
                        people,
                        relationships,
                        today,
                        relationshipV2Links
                      );
                      if (
                        reminderContext?.kind === "childBirthday" ||
                        reminderContext?.kind === "childThroughRelationship" ||
                        reminderContext?.kind === "careRecipient"
                      ) {
                        return null;
                      }
                      if (reminderContext?.subjectAge !== undefined && reminderContext.subjectAge < 18) {
                        return null;
                      }
                    } else if (nextEvent.moment.momentType === "childBirthday") {
                      return null;
                    }

                    return (
                      <div
                        style={{
                          marginTop,
                          padding: 12,
                          border: "1px solid #ccc",
                          borderRadius: "12px",
                          background: "rgba(255,255,255,0.72)",
                        }}
                      >
                        <h4 style={{ margin: 0, color: "var(--ink)", fontSize: "1rem", fontWeight: 600 }}>
                          {`Plan something a little more thoughtful for ${targetName}`}
                        </h4>
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                          You've got time this week - make it a little more personal.
                        </p>

                        <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                          {data.map((item, index) => (
                            <div key={`${item.url}-${index}`} style={{ color: "var(--ink)", fontSize: "0.96rem" }}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "inherit",
                                  textDecoration: "underline",
                                  textUnderlineOffset: "3px",
                                }}
                              >
                                {item.title}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <>
                      {!hasPendingReminders ? renderEmpty() : null}

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
                            <>{renderPromptGrid(renderReminderCards(todayReminders, "today"))}</>
                          ) : null}
                        </>
                      ) : null}

                      {tomorrowReminders.length > 0 ? (
                        <>
                          <div style={{ ...headerStyle, display: "flex", alignItems: "center", marginTop: todayReminders.length > 0 ? "24px" : "8px" }}>
                            <RaisedGoldBullet />
                            <span>Tomorrow</span>
                          </div>
                          {renderReminderCards(tomorrowReminders, "tomorrow")}
                        </>
                      ) : null}

                      {showDiscoverySurface && activeLegacyPrompt ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: hasPendingReminders ? "24px" : "8px" }}>
                            Thoughtful prompts
                          </div>
                          {renderPromptGrid(renderLegacyPrompt(activeLegacyPrompt))}
                        </>
                      ) : null}

                      {showDiscoverySurface && !activeLegacyPrompt && activeQuestion ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: hasPendingReminders ? "24px" : "8px" }}>
                            A quick question
                          </div>
                          {renderPromptGrid(
                            <MicroQuestionCard
                              suggestion={activeQuestion}
                              onChoose={(optionId, data) => handleQuestionChoose(activeQuestion.id, optionId, data)}
                              onDismiss={() => handleQuestionDismiss(activeQuestion.id)}
                            />
                          )}
                        </>
                      ) : null}

                      {showDiscoverySurface && !activeLegacyPrompt && !activeQuestion && activeCareSuggestion ? (
                        <>
                          <div style={{ ...headerStyle, marginTop: hasPendingReminders ? "24px" : "8px" }}>
                            A thoughtful nudge
                          </div>
                          {renderPromptGrid(renderCareSuggestionCard(activeCareSuggestion))}
                        </>
                      ) : null}

                      {showHorizonSection ? (
                        <>
                          <div
                            style={{
                              ...headerStyle,
                              marginTop: todayReminders.length > 0 || tomorrowReminders.length > 0 ? "72px" : "18px",
                              color: "rgba(108, 111, 115, 0.82)",
                              textAlign: "center",
                              justifyContent: "center",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "999px",
                                background: "var(--dkf-gold)",
                                flexShrink: 0,
                              }}
                            />
                            <span>On the Horizon</span>
                            <span
                              aria-hidden="true"
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "999px",
                                background: "var(--dkf-gold)",
                                flexShrink: 0,
                              }}
                            />
                          </div>
                          <div className="dkf-horizon-divider" aria-hidden="true" />
                          <div style={{ display: "grid", gap: "16px", marginTop: "16px" }}>
                            {horizonEntries.map(({ moment, reminder }) => {
                              if (reminder) {
                                return (
                                  <div key={getReminderId(reminder)}>{renderReminderCards([reminder], "horizon")}</div>
                                );
                              }

                              return (
                                <div
                                  key={moment.id}
                                  className="smart-card"
                                  onClick={() => navigate(`/person/${moment.personId}`)}
                                  style={{
                                    border: "1px solid var(--border)",
                                    borderRadius: "20px",
                                    background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,246,242,0.92) 100%)",
                                    padding: "18px",
                                    display: "grid",
                                    gap: "8px",
                                    backdropFilter: "blur(4px)",
                                    boxShadow: "0 8px 18px rgba(28, 28, 30, 0.03)",
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
                            {isHorizonExpanded
                              ? expandedHorizonEntries.map(({ moment, reminder }) => {
                                  if (reminder) {
                                    return (
                                      <div key={getReminderId(reminder)}>{renderReminderCards([reminder], "horizon")}</div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={moment.id}
                                      className="smart-card"
                                      onClick={() => navigate(`/person/${moment.personId}`)}
                                      style={{
                                        border: "1px solid var(--border)",
                                        borderRadius: "20px",
                                        background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(248,246,242,0.92) 100%)",
                                        padding: "18px",
                                        display: "grid",
                                        gap: "8px",
                                        backdropFilter: "blur(4px)",
                                        boxShadow: "0 8px 18px rgba(28, 28, 30, 0.03)",
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
                                })
                              : null}
                          </div>
                          {hasMoreHorizonEntries ? (
                            <div style={{ marginTop: "14px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => setIsHorizonExpanded((prev) => !prev)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  padding: 0,
                                  color: "rgba(23, 50, 77, 0.82)",
                                  fontSize: "15px",
                                  lineHeight: 1.5,
                                  fontWeight: 500,
                                  cursor: "pointer",
                                }}
                              >
                                {isHorizonExpanded ? "Show less" : "See what’s coming up next"}
                              </button>
                            </div>
                          ) : null}
                          {renderRecommendationsSection("16px")}
                        </>
                      ) : null}
                    </>
                  );
                })()}
            </section>
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
              setSmsSuggestions(null);
              openSmsComposer(phone, message);
            }}
          />
        ) : null}

        {isConnectPersonOpen && recentlyAddedPerson ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Connect ${recentlyAddedPerson.name}`}
            onClick={closeConnectPersonFlow}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(10, 18, 28, 0.24)",
              display: "grid",
              placeItems: "center",
              padding: "20px 16px",
              zIndex: 120,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "520px",
                borderRadius: "24px",
                border: "1px solid rgba(10, 27, 42, 0.08)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248, 241, 233, 0.96) 100%)",
                boxShadow: "0 24px 60px rgba(27,42,65,0.16)",
                padding: "18px",
                display: "grid",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ display: "grid", gap: "6px" }}>
                  <div
                    style={{
                      color: "var(--ink)",
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.4rem",
                      lineHeight: 1.08,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Connect {recentlyAddedPerson.name}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.5 }}>
                    Pick someone you already added.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeConnectPersonFlow}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--muted)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.9rem",
                    fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Close
                </button>
              </div>

              <input
                type="search"
                autoFocus
                value={connectPersonQuery}
                onChange={(event) => setConnectPersonQuery(event.target.value)}
                placeholder="Search your circle"
                style={{
                  width: "100%",
                  padding: "0.85rem 0.95rem",
                  borderRadius: "14px",
                  border: "1px solid rgba(10, 27, 42, 0.1)",
                  background: "rgba(255,255,255,0.92)",
                  color: "var(--ink)",
                  fontSize: "0.98rem",
                }}
              />

              {!connectPersonQuery.trim() ? (
                <div style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  Start typing to quickly find the right person.
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gap: "10px",
                  maxHeight: "240px",
                  overflowY: "auto",
                  paddingRight: "2px",
                  opacity: connectPersonQuery.trim() ? 1 : 0.88,
                }}
              >
                {filteredConnectionTargets.length ? (
                  filteredConnectionTargets.map((person) => {
                    const active = selectedConnectionTargetId === person.id;
                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          setSelectedConnectionTargetId(person.id);
                          setSelectedConnectionType(null);
                        }}
                        style={{
                          textAlign: "left",
                          borderRadius: "16px",
                          border: active
                            ? "1px solid rgba(23, 50, 77, 0.24)"
                            : "1px solid rgba(10, 27, 42, 0.08)",
                          background: active
                            ? "linear-gradient(180deg, rgba(247, 239, 240, 0.96) 0%, rgba(250, 244, 236, 0.94) 100%)"
                            : "rgba(255,255,255,0.82)",
                          color: "var(--ink)",
                          padding: "0.9rem 0.95rem",
                          fontSize: "0.96rem",
                          fontWeight: active ? 700 : 600,
                          boxShadow: active ? "0 10px 22px rgba(27,42,65,0.08)" : "none",
                          cursor: "pointer",
                        }}
                      >
                        {displayNameOrFallback(person.name)}
                      </button>
                    );
                  })
                ) : (
                  <div style={{ color: "var(--muted)", fontSize: "0.94rem", lineHeight: 1.5 }}>
                    No one matches that search yet.
                  </div>
                )}
              </div>

              {selectedConnectionTarget ? (
                <div
                  style={{
                    display: "grid",
                    gap: "10px",
                    paddingTop: "4px",
                    borderTop: "1px solid rgba(10, 27, 42, 0.08)",
                  }}
                >
                  <div style={{ color: "var(--ink)", fontWeight: 600 }}>
                    Who is {recentlyAddedPerson.name} to {displayNameOrFallback(selectedConnectionTarget.name)}?
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px" }}>
                    {(["child", "partner"] as const).map((relationshipType) => {
                      const active = selectedConnectionType === relationshipType;
                      return (
                        <button
                          key={relationshipType}
                          type="button"
                          onClick={() => setSelectedConnectionType(relationshipType)}
                          style={{
                            borderRadius: "999px",
                            border: active
                              ? "1px solid rgba(23, 50, 77, 0.24)"
                              : "1px solid rgba(10, 27, 42, 0.08)",
                            background: active
                              ? "linear-gradient(180deg, rgba(247, 239, 240, 0.96) 0%, rgba(250, 244, 236, 0.94) 100%)"
                              : "rgba(255,255,255,0.82)",
                            color: "var(--ink)",
                            padding: "0.8rem 0.9rem",
                            fontSize: "0.95rem",
                            fontWeight: active ? 700 : 600,
                            cursor: "pointer",
                          }}
                        >
                          {relationshipType === "child" ? "Child" : "Partner"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <button
                  type="button"
                  onClick={closeConnectPersonFlow}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--muted)",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.94rem",
                    fontWeight: 500,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Maybe later
                </button>
                <button
                  type="button"
                  onClick={saveConnectedPersonLink}
                  disabled={!selectedConnectionTargetId || !selectedConnectionType}
                  style={{
                    border: `1px solid ${selectedConnectionTargetId && selectedConnectionType ? CIRCLE_NAVY : "rgba(10, 27, 42, 0.08)"}`,
                    background: selectedConnectionTargetId && selectedConnectionType ? CIRCLE_NAVY : "rgba(255,255,255,0.7)",
                    color: selectedConnectionTargetId && selectedConnectionType ? "var(--paper)" : "var(--muted)",
                    cursor: selectedConnectionTargetId && selectedConnectionType ? "pointer" : "default",
                    borderRadius: "12px",
                    padding: "0.78rem 1rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Save connection
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
    </div>
  );
}
