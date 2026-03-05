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
import {
  getAnniversaryPrompts,
  getBirthdayPrompts,
  getKidsBirthdayPrompts,
  type AnniversaryPromptItem,
  type BirthdayPromptItem,
  type KidsBirthdayPromptItem,
  type PromptItem,
} from "../engine/promptEngine";
import { daysUntilDate, getNextBirthdayFromIso } from "../utils/birthdayUtils";
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

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
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
  const [arrivalTick, setArrivalTick] = useState(0);
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

  function markReminderActionHandled(actionKey: string) {
    setHandledReminderActions((prev) => {
      if (prev[actionKey]) return prev;
      return { ...prev, [actionKey]: true };
    });
  }

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

  const anniversaryPrompts = useMemo(() => {
    if (activeTab !== "home") return [];
    return getAnniversaryPrompts(people);
  }, [activeTab, people]);

  const birthdayPrompts = useMemo(() => {
    if (activeTab !== "home") return [];
    return getBirthdayPrompts(people);
  }, [activeTab, people]);

  const kidsBirthdayPrompts = useMemo(() => {
    if (activeTab !== "home") return [];
    return getKidsBirthdayPrompts(people);
  }, [activeTab, people]);

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
    setArrivalTick((t) => t + 1);
  }

  function openSmartMessageSuggestions(args: {
    personName: string;
    phone: string;
    suggestions: Array<{ id: "quick" | "friendly" | "thoughtful" | "simple" | "custom"; label: string; message: string }>;
    onAfterSend?: () => void;
  }) {
    setSmsSuggestions(args);
  }

  function dedupePrompts<T>(items: T[], getKey: (item: T) => string) {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const item of items) {
      const key = getKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }

  const visibleAnniversaryPrompts = useMemo(() => {
    const filtered = anniversaryPrompts.filter((p) => {
      try {
        return window.localStorage.getItem(promptDismissKey(p)) !== "1";
      } catch {
        return true;
      }
    });
    return dedupePrompts(filtered, (p) => `${p.type}_${p.personId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anniversaryPrompts, arrivalTick]);

  const visibleBirthdayPrompts = useMemo(() => {
    const filtered = birthdayPrompts.filter((p) => {
      try {
        return window.localStorage.getItem(promptDismissKey(p)) !== "1";
      } catch {
        return true;
      }
    });
    return dedupePrompts(filtered, (p) => `${p.type}_${p.personId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthdayPrompts, arrivalTick]);

  const visibleKidsBirthdayPrompts = useMemo(() => {
    const filtered = kidsBirthdayPrompts.filter((p) => {
      try {
        return window.localStorage.getItem(promptDismissKey(p)) !== "1";
      } catch {
        return true;
      }
    });
    return dedupePrompts(filtered, (p) => `${p.type}_${p.parentId}_${p.childId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kidsBirthdayPrompts, arrivalTick]);

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

  const gentleForecast = useMemo(() => {
    if (activeTab !== "home") return null;

    type ForecastItem = {
      key: string;
      firstName: string;
      type: string;
      label: string;
      date: string;
      daysUntil: number;
      occurrenceIso: string; // YYYY-MM-DD for the next occurrence (used for handled-action keys)
    };

    type ForecastGroups = {
      today: ForecastItem[];
      tomorrow: ForecastItem[];
      week: ForecastItem[];
      month: ForecastItem[];
    };

    function parseLocalYmd(value: string): Date | null {
      const parts = value.split("-");
      if (parts.length !== 3) return null;
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      const d = Number(parts[2]);
      if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
      const parsed = new Date(y, m - 1, d);
      if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
      return parsed;
    }

    const base = today;
    const horizonDays = 30;
    const all: ForecastItem[] = [];

    // Flat array of all moments for all people.
    for (const person of people) {
      if (!person?.id) continue;
      const firstName = (person.name ?? "").trim().split(" ")[0] || person.name;

      for (const moment of person.moments ?? []) {
        if (!moment?.id || !moment?.date) continue;

        let until: number | null = null;
        let occurrenceIso = "";
        if (moment.recurring) {
          const next = getNextBirthdayFromIso(moment.date, base);
          if (next) {
            until = next.daysUntilBirthday;
            occurrenceIso = next.iso;
          }
        } else {
          const d = parseLocalYmd(moment.date);
          if (d) {
            until = daysUntilDate(d, base);
            occurrenceIso = formatYmd(d);
          }
        }
        if (until === null) continue;
        if (until < 0 || until > horizonDays) continue;
        if (!occurrenceIso) continue;

        all.push({
          key: `${person.id}:${moment.id}`,
          firstName,
          type: moment.type,
          label: moment.label || moment.type,
          date: moment.date,
          daysUntil: until,
          occurrenceIso,
        });
      }

      // Kids birthdays (as synthetic moments)
      for (const child of person.children ?? []) {
        const childName = (child.name ?? "").trim();
        const raw = (child.birthday ?? child.birthdate ?? "").trim();
        if (!child.id || !childName || !raw) continue;
        const next = getNextBirthdayFromIso(raw, base);
        if (!next) continue;
        const until = next.daysUntilBirthday;
        if (until < 0 || until > horizonDays) continue;
        all.push({
          key: `${person.id}:child:${child.id}`,
          firstName: childName,
          type: "kidBirthday",
          label: "Birthday",
          date: raw,
          daysUntil: until,
          occurrenceIso: next.iso,
        });
      }
    }

    all.sort((a, b) => (a.daysUntil - b.daysUntil) || a.firstName.localeCompare(b.firstName) || a.label.localeCompare(b.label));

    const groups: ForecastGroups = { today: [], tomorrow: [], week: [], month: [] };
    const todayMoments = all.filter((m) => m.daysUntil === 0);
    const horizonMoments = all.filter((m) => m.daysUntil > 0);

    groups.today = todayMoments;

    for (const item of horizonMoments) {
      if (item.daysUntil === 1) groups.tomorrow.push(item);
      else if (item.daysUntil <= 7) groups.week.push(item);
      else groups.month.push(item);
    }

    // Limit horizon rendering to keep the block tidy.
    const maxItems = 6;
    const limited: ForecastGroups = {
      today: groups.today,
      tomorrow: groups.tomorrow,
      week: groups.week,
      month: groups.month,
    };

    const horizonFlat = [...limited.tomorrow, ...limited.week, ...limited.month].slice(0, maxItems);
    limited.tomorrow = horizonFlat.filter((i) => i.daysUntil === 1);
    limited.week = horizonFlat.filter((i) => i.daysUntil >= 2 && i.daysUntil <= 7);
    limited.month = horizonFlat.filter((i) => i.daysUntil >= 8);

    return limited;
  }, [activeTab, people, today]);

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

  const greetingText = activeTab === "home" ? "Moments that matter today" : "Your contacts.";

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
    const prev = previousPeopleCountRef.current;
    if (people.length > prev) setArrivalTick((t) => t + 1);
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
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "env(safe-area-inset-top) 16px 16px 16px",
          boxSizing: "border-box",
          minHeight: "100vh",
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
            {headerDateFormatter.format(today)}
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
                Start by adding someone important.
              </div>
              <div style={{ marginTop: "0.6rem", color: "var(--muted)", lineHeight: 1.6 }}>
                When you add people, important dates will appear here.
              </div>
              <div style={{ marginTop: "1.5rem", display: "grid", gap: "12px" }}>
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
                  Import from Contacts
                </button>
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
                  Add Manually
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

              <div style={{ marginTop: "2.5rem" }}>
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

                  const todayBirthdayPrompts = visibleBirthdayPrompts.filter((p) => p.type === "TODAY_BIRTHDAY");

                  const todayKidsBirthdayPrompts = visibleKidsBirthdayPrompts.filter((p) => p.type === "TODAY_CHILD_BIRTHDAY");

                  const todayAnniversaryPrompts = visibleAnniversaryPrompts.filter((p) => p.type === "ANNIVERSARY_TODAY");

	                  const todayMoments = gentleForecast?.today ?? [];
	                  const tomorrowMoments = gentleForecast?.tomorrow ?? [];
	                  const comingSoonMoments = gentleForecast?.week ?? [];
	                  const horizonMoments = gentleForecast ? [...tomorrowMoments, ...comingSoonMoments, ...gentleForecast.month] : [];
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

                  const todayBirthdayByPersonId = new Map(todayBirthdayPrompts.map((p) => [p.personId, p] as const));
                  const todayAnniversaryByPersonId = new Map(todayAnniversaryPrompts.map((p) => [p.personId, p] as const));
                  const todayKidBirthdayByKey = new Map(
                    todayKidsBirthdayPrompts.map((p) => [`${p.parentId}:${p.childId}`, p] as const)
                  );

                  function displayNameForForecastItem(itemKey: string, fallbackFirstName: string) {
                    const personId = itemKey.split(":")[0] ?? "";
                    const person = people.find((p) => p.id === personId) ?? null;
                    return person?.name?.trim() || fallbackFirstName;
                  }

                  function possessive(name: string) {
                    const trimmed = (name ?? "").trim();
                    if (!trimmed) return "";
                    return `${trimmed}’s`;
                  }

	                  function formatMomentText(firstNameOrFull: string, type: string, label: string, daysUntil: number) {
                    const name = (firstNameOrFull ?? "").trim();
                    const bdayLike = type === "birthday" || type === "kidBirthday" || label.toLowerCase() === "birthday";
                    const annLike = type === "anniversary" || label.toLowerCase() === "anniversary";

                    if (bdayLike) {
                      if (daysUntil === 0) return `Today is ${possessive(name)} birthday`;
                      if (daysUntil === 1) return `${possessive(name)} birthday is tomorrow`;
                      return `${possessive(name)} birthday is in ${daysUntil} days`;
                    }

                    if (annLike) {
                      if (daysUntil === 0) return `Today is ${possessive(name)} anniversary`;
                      if (daysUntil === 1) return `${possessive(name)} anniversary is tomorrow`;
                      return `${possessive(name)} anniversary is in ${daysUntil} days`;
                    }

                    if (daysUntil === 0) return `${label} for ${name} is today`;
                    if (daysUntil === 1) return `${label} for ${name} is tomorrow`;
	                    return `${label} for ${name} is in ${daysUntil} days`;
	                  }

	                  const handledToday = todayMoments.filter((item) => {
	                    const actionKey = `text|${item.key}|${item.occurrenceIso}`;
	                    return Boolean(handledReminderActions[actionKey]) && item.daysUntil === 0;
	                  });

	                  function handledLine(item: (typeof todayMoments)[number]) {
	                    const personId = item.key.split(":")[0] ?? "";
	                    const person = people.find((p) => p.id === personId) ?? null;
	                    const parentFirst = firstOf(person?.name ?? "");
	                    const childName = (item.type === "kidBirthday" ? item.firstName : "").trim();
	                    const first = firstOf(person?.name ?? item.firstName);

	                    if (item.type === "kidBirthday" && childName) {
	                      return `✓ Texted ${parentFirst} about ${childName}’s birthday`;
	                    }

	                    if (item.type === "anniversary" || item.label.toLowerCase() === "anniversary") {
	                      return `✓ Sent anniversary message to ${first}`;
	                    }

	                    if (item.type === "birthday" || item.label.toLowerCase() === "birthday") {
	                      return `✓ Texted ${first} for birthday`;
	                    }

	                    const label = (item.label ?? "").trim();
	                    if (label) return `✓ Reached out to ${first} — ${label}`;
	                    return `✓ Reached out to ${first}`;
	                  }

	                  const renderPromptGrid = (children: React.ReactNode) => (
	                    <div style={{ display: "grid", gap: "12px", marginBottom: "6px" }}>{children}</div>
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

                  if (todayMoments.length === 0 && horizonMoments.length === 0) {
                    return renderEmpty();
                  }

                  return (
                    <>
	                      {todayMoments.length > 0 ? (
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
	                          {renderPromptGrid(
	                            <>
		                              {todayMoments.map((moment) => {
	                                const personId = moment.key.split(":")[0] ?? "";
	                                const childId = moment.key.includes(":child:") ? moment.key.split(":child:")[1] ?? "" : "";
	                                const person = people.find((p) => p.id === personId) ?? null;
	                                const first = firstOf(person?.name ?? moment.firstName);
		                                const actionKey = `text|${moment.key}|${moment.occurrenceIso}`;
		                                const isUnhandled = !handledReminderActions[actionKey];
		                                const isLateDay = new Date().getHours() >= 21;
		                                const eventLine =
		                                  moment.type === "birthday" || moment.type === "kidBirthday"
		                                    ? `It’s ${moment.firstName}’s birthday today.`
		                                    : moment.type === "anniversary"
		                                      ? `It’s ${moment.firstName}’s anniversary today.`
		                                      : `Today: ${moment.firstName} · ${moment.label}`;

                                const birthdayPrompt = moment.type === "birthday" ? todayBirthdayByPersonId.get(personId) ?? null : null;
                                const anniversaryPrompt =
                                  moment.type === "anniversary" ? todayAnniversaryByPersonId.get(personId) ?? null : null;
                                const kidPrompt =
                                  moment.type === "kidBirthday" && childId
                                    ? todayKidBirthdayByKey.get(`${personId}:${childId}`) ?? null
                                    : null;

                                const prompt = (birthdayPrompt ?? anniversaryPrompt ?? kidPrompt) as
                                  | BirthdayPromptItem
                                  | AnniversaryPromptItem
                                  | KidsBirthdayPromptItem
                                  | null;

		                                const baseMessage = eventLine;
		                                const message =
		                                  isLateDay && isUnhandled
		                                    ? `${baseMessage}\nStill a great time to reach out.`
		                                    : baseMessage;

		                                const actions = [
		                                  {
		                                    label: (() => {
		                                      const isChildBirthday = moment.key.includes(":child:") || moment.type === "kidBirthday";
		                                      const parentRoleLabel =
		                                        person?.parentRole === "mother"
		                                          ? "mom"
		                                          : person?.parentRole === "father"
		                                            ? "dad"
		                                            : "parent";
		                                      const childLabel = (moment.firstName ?? "").trim();
		                                      const baseLabel = isChildBirthday && childLabel
		                                        ? `Text ${first} (${childLabel}’s ${parentRoleLabel})`
		                                        : `Text ${first}`;
		                                      return handledReminderActions[actionKey] ? `${baseLabel} ✓` : baseLabel;
		                                    })(),
		                                    disabled: !person?.phone,
		                                    title: !person?.phone ? "Add a phone number to text them." : undefined,
		                                    onClick: () => {
	                                      if (!person?.phone) return;
                                      markReminderActionHandled(`text|${moment.key}|${moment.occurrenceIso}`);

                                      const toName = (person.name ?? "").trim().split(" ")[0] || person.name || first;
                                      const isKidBirthday = moment.type === "kidBirthday";
                                      const kidName = isKidBirthday ? (moment.firstName ?? "").trim() : "";

                                      const isBirthday = moment.type === "birthday" || isKidBirthday;
                                      const isAnniversary = moment.type === "anniversary" || moment.label?.toLowerCase() === "anniversary";

                                      const birthdayName = kidName || toName;

	                                      const customTitle = moment.type === "custom" ? (moment.label ?? "").trim().toLowerCase() : "";
	                                      const sensitiveKeywords = ["thinking", "loss", "anniversary", "remembering", "tough", "support", "miss"] as const;
	                                      const isSensitiveCustom =
	                                        moment.type === "custom" && sensitiveKeywords.some((k) => customTitle.includes(k));

	                                      const quick = isSensitiveCustom
	                                        ? "Thinking of you today."
	                                        : isKidBirthday
	                                          ? `Happy birthday to ${birthdayName}! Hope it's a great day.`
	                                          : isBirthday
	                                            ? `Happy birthday ${birthdayName}! Hope it's a great day.`
	                                            : isAnniversary
	                                              ? `Happy anniversary, ${toName}! Hope it's a great day.`
	                                              : "Thinking of you today. Hope things go well.";

	                                      const friendly = isSensitiveCustom
	                                        ? "Just wanted to let you know I'm thinking of you today."
	                                        : isKidBirthday
	                                          ? `Hope ${birthdayName} is having a great birthday today!`
	                                          : isBirthday
	                                            ? "Hope you’re having a great birthday today!"
	                                            : isAnniversary
	                                              ? "Hope you’re having a great anniversary today!"
	                                              : "Hope today goes well — thinking of you.";

	                                      const thoughtful = isSensitiveCustom
	                                        ? "Just wanted you to know you're on my mind today."
	                                        : isKidBirthday
	                                          ? `Thinking of ${birthdayName} today and hoping it’s a really special birthday.`
	                                          : isBirthday
	                                            ? "Thinking of you today and hoping it’s a really special birthday."
	                                            : isAnniversary
	                                              ? "Thinking of you today and hoping your anniversary feels special."
	                                              : "Just wanted to check in — thinking of you today and hoping everything goes smoothly.";

	                                      const simple = isSensitiveCustom
	                                        ? "I'm thinking of you."
	                                        : isKidBirthday
	                                          ? `Happy birthday to ${birthdayName}. Hope it's a good one.`
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
	                                        onAfterSend: prompt ? () => dismissPrompt(prompt as any) : undefined,
	                                      });
                                    },
                                  },
	                                  {
	                                    label: `Send ${first} an eCard`,
	                                    href: "https://www.americangreetings.com/ecards",
	                                    onClick: () => {
	                                      if (prompt) dismissPrompt(prompt as any);
	                                    },
	                                  },
	                                  {
	                                    label: `Send ${first} a coffee`,
	                                    href: "https://www.starbucks.com/gift",
	                                    onClick: () => {
	                                      if (prompt) dismissPrompt(prompt as any);
	                                    },
	                                  },
	                                  {
	                                    label: "Dismiss",
	                                    onClick: () => {
	                                      if (prompt) dismissPrompt(prompt as any);
	                                    },
	                                  },
                                ];

                                return (
                                  <SmartSuggestionCard
                                    key={`today_${moment.key}`}
                                    variant="nudge"
                                    message={message}
                                    actions={actions}
                                    onMaybe={undefined}
                                  />
                                );
                              })}
                            </>
                          )}
                        </>
	                      ) : null}

	                      {tomorrowMoments.length > 0 ? (
	                        <div
	                          style={{
	                            border: "1px solid var(--border)",
	                            borderRadius: "16px",
	                            padding: "18px",
	                            background: "rgba(255,255,255,0.7)",
	                            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
	                            marginTop: todayMoments.length > 0 ? "22px" : 0,
	                            marginBottom: "18px",
	                          }}
	                        >
	                          <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--muted)" }}>Tomorrow</div>
	                          <div
	                            style={{
	                              marginTop: "12px",
	                              display: "grid",
	                              gap: "8px",
	                              color: "var(--muted)",
	                              fontSize: "16px",
	                              lineHeight: 1.45,
	                            }}
	                          >
	                            {tomorrowMoments.map((i) => (
	                              <div key={i.key} style={{ display: "flex", alignItems: "center" }}>
	                                <RaisedGoldBullet />
	                                <div style={{ minWidth: 0 }}>
	                                  {formatMomentText(
	                                    displayNameForForecastItem(i.key, i.firstName),
	                                    i.type,
	                                    i.label,
	                                    i.daysUntil
	                                  )}
	                                </div>
	                              </div>
	                            ))}
	                          </div>
	                        </div>
	                      ) : null}

	                      {comingSoonMoments.length > 0 ? (
	                        <div
	                          style={{
	                            border: "1px solid var(--border)",
	                            borderRadius: "16px",
	                            padding: "18px",
	                            background: "rgba(255,255,255,0.7)",
	                            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
	                            marginTop: todayMoments.length > 0 || tomorrowMoments.length > 0 ? "14px" : 0,
	                            marginBottom: "18px",
	                          }}
	                        >
	                          <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--muted)" }}>On the Horizon</div>
	                          <GoldenSunDivider />
                          <div
                            style={{
                              marginTop: "10px",
                              display: "grid",
                              gap: "8px",
                              color: "var(--muted)",
                              fontSize: "16px",
	                              lineHeight: 1.45,
	                            }}
	                          >
	                            {comingSoonMoments.map((i) => (
	                              <div key={i.key} style={{ display: "flex", alignItems: "center" }}>
	                                <RaisedGoldBullet />
	                                <div style={{ minWidth: 0 }}>
	                                  {formatMomentText(
	                                    displayNameForForecastItem(i.key, i.firstName),
	                                    i.type,
	                                    i.label,
	                                    i.daysUntil
	                                  )}
	                                </div>
	                              </div>
	                            ))}
	                          </div>
	                        </div>
	                      ) : null}

	                      {gentleForecast?.month?.length ? (
	                        <div
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: "16px",
                            padding: "18px",
                            background: "rgba(255,255,255,0.7)",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                            marginTop: "14px",
                            marginBottom: "18px",
                          }}
                        >
                          <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--muted)" }}>Plan Ahead</div>
                          <div
                            style={{
                              marginTop: "12px",
                              display: "grid",
                              gap: "8px",
                              color: "var(--muted)",
                              fontSize: "16px",
                              lineHeight: 1.45,
                            }}
                          >
                            {gentleForecast.month.map((i) => (
                              <div key={i.key} style={{ display: "flex", alignItems: "center" }}>
                                <RaisedGoldBullet />
                                <div style={{ minWidth: 0 }}>
                                  {formatMomentText(
                                    displayNameForForecastItem(i.key, i.firstName),
                                    i.type,
                                    i.label,
                                    i.daysUntil
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
	                        </div>
	                      ) : null}

	                      {handledToday.length ? (
	                        <div style={{ marginTop: "22px" }}>
	                          <div style={headerStyle}>Taken Care Of Today</div>
	                          <div style={{ marginTop: "10px", display: "grid", gap: "8px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.45 }}>
	                            {handledToday.map((item) => (
	                              <div key={`handled_${item.key}`} style={{ display: "flex", alignItems: "center" }}>
	                                <div style={{ minWidth: 0 }}>{handledLine(item)}</div>
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
