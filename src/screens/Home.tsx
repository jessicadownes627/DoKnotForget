import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "../models/Person";
import { openSmsComposer } from "../components/SoonReminderCard";
import Brand from "../components/Brand";
import BowIcon from "../components/BowIcon";
import PeopleIndex from "./PeopleIndex";
import CareSuggestionCard from "../components/CareSuggestionCard";
import { generateCareSuggestions } from "../utils/careSuggestions";
import MicroQuestionCard from "../components/MicroQuestionCard";
import { useLocation, useNavigate } from "../router";
import { useAppState } from "../appState";
import SmartSuggestionCard from "../components/SmartSuggestionCard";
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
import { getFathersDay, getMothersDay } from "../utils/holidayUtils";
import { getNextAnniversary } from "../utils/anniversaryUtils";
import { daysUntilDate, getNextBirthdayFromIso } from "../utils/birthdayUtils";
import MomentDatePicker from "../components/MomentDatePicker";
import { RaisedGoldBullet } from "../components/common/GoldBullets";
import GoldenSunDivider from "../components/GoldenSunDivider";
import ContactsSearchResults from "../components/ContactsSearchResults";
import { filterContacts } from "../utils/contactSearch";

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
  const { people, updatePerson, updatePersonFields } = useAppState();
  const initialTab = location.state?.defaultTab === "contacts" ? "contacts" : "home";
  const [activeTab, setActiveTab] = useState<"home" | "contacts">(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const [questionTick, setQuestionTick] = useState(0);
  const [shouldPulseBow, setShouldPulseBow] = useState(false);
  const [arrivalTick, setArrivalTick] = useState(0);
  const previousPeopleCountRef = useRef<number>(people.length);

  const today = useMemo(() => startOfToday(), []);

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

  const motherPrompts = useMemo(() => {
    if (activeTab !== "home") return [];
    return getMotherPrompts(people);
  }, [activeTab, people]);

  const fatherPrompts = useMemo(() => {
    if (activeTab !== "home") return [];
    return getFatherPrompts(people);
  }, [activeTab, people]);

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

  const visibleMotherPrompts = useMemo(() => {
    const filtered = motherPrompts.filter((p) => {
      try {
        return window.localStorage.getItem(promptDismissKey(p)) !== "1";
      } catch {
        return true;
      }
    });
    return dedupePrompts(filtered, (p) => `${p.type}_${p.personId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motherPrompts, arrivalTick]);

  const visibleFatherPrompts = useMemo(() => {
    const filtered = fatherPrompts.filter((p) => {
      try {
        return window.localStorage.getItem(promptDismissKey(p)) !== "1";
      } catch {
        return true;
      }
    });
    return dedupePrompts(filtered, (p) => `${p.type}_${p.personId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fatherPrompts, arrivalTick]);

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
    const parsed = new Date(`${iso}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function getAnniversaryMonthDay(person: Person): string | null {
    const stored = (person.anniversary ?? "").trim();
    if (stored) return stored;
    const moment = (person.moments ?? []).find((m) => m.type === "anniversary") ?? null;
    if (!moment?.date) return null;
    const parts = moment.date.split("-");
    if (parts.length !== 3) return null;
    const mm = parts[1];
    const dd = parts[2];
    if (!mm || !dd) return null;
    return `${mm}-${dd}`;
  }

  const gentleForecast = useMemo(() => {
    if (activeTab !== "home") return null;

    type Candidate = {
      key: string;
      entityKey: string;
      daysUntil: number;
      message: string;
      priority: number;
    };

    function timePhrase(days: number) {
      if (days === 0) return "today";
      if (days === 1) return "tomorrow";
      if (days >= 6) return "next week";
      return `in ${days} days`;
    }

    const base = today;
    const candidates: Candidate[] = [];

    // Holidays
    const year = new Date().getFullYear();
    const mothersDay = getMothersDay(year);
    const fathersDay = getFathersDay(year);
    const mdUntil = daysUntilDate(mothersDay, base);
    const fdUntil = daysUntilDate(fathersDay, base);
    if (mdUntil >= 0 && mdUntil <= 7) {
      candidates.push({
        key: `holiday_md_${year}`,
        entityKey: "holiday:mothers_day",
        daysUntil: mdUntil,
        message: `Mother’s Day is ${timePhrase(mdUntil)}`,
        priority: 1,
      });
    }
    if (fdUntil >= 0 && fdUntil <= 7) {
      candidates.push({
        key: `holiday_fd_${year}`,
        entityKey: "holiday:fathers_day",
        daysUntil: fdUntil,
        message: `Father’s Day is ${timePhrase(fdUntil)}`,
        priority: 1,
      });
    }

    // Anniversaries (dedupe by pair)
    const seenPairs = new Set<string>();
    for (const person of people) {
      if (!person?.id) continue;
      const partnerId = (person.partnerId ?? "").trim();
      if (!partnerId) continue;
      const partner = people.find((p) => p.id === partnerId) ?? null;
      if (!partner) continue;

      const pairKey = [person.id, partnerId].sort().join("_");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const monthDay = getAnniversaryMonthDay(person);
      if (!monthDay) continue;
      const next = getNextAnniversary(monthDay);
      if (!next) continue;
      const until = daysUntilDate(next, base);
      if (until < 0 || until > 7) continue;

      candidates.push({
        key: `anniv_${pairKey}_${next.getFullYear()}`,
        entityKey: `anniv:${pairKey}`,
        daysUntil: until,
        message: `Your anniversary with ${partner.name} is ${timePhrase(until)}`,
        priority: 1,
      });
    }

    // Adult birthdays + custom moments
    for (const person of people) {
      if (!person?.id) continue;

      const birthdayMoment = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
      if (birthdayMoment?.date) {
        const next = getNextBirthdayFromIso(birthdayMoment.date, base);
        if (next && next.daysUntilBirthday >= 0 && next.daysUntilBirthday <= 7) {
          candidates.push({
            key: `bday_${person.id}_${next.year}`,
            entityKey: `person:${person.id}`,
            daysUntil: next.daysUntilBirthday,
            message: `${person.name}’s birthday ${timePhrase(next.daysUntilBirthday)}`,
            priority: 0,
          });
        }
      }

      for (const moment of person.moments ?? []) {
        if (moment.type !== "custom") continue;
        let until: number | null = null;
        if (moment.recurring) {
          const next = getNextBirthdayFromIso(moment.date, base);
          if (next) until = next.daysUntilBirthday;
        } else {
          const d = isoToDate(moment.date);
          if (d) until = daysUntilDate(d, base);
        }
        if (until === null) continue;
        if (until < 0 || until > 7) continue;
        candidates.push({
          key: `custom_${person.id}_${moment.id}`,
          entityKey: `person:${person.id}`,
          daysUntil: until,
          message: `${moment.label} ${timePhrase(until)}`,
          priority: 2,
        });
      }
    }

    // Kids birthdays (treat each child separately)
    for (const parent of people) {
      if (!parent?.id) continue;
      for (const child of parent.children ?? []) {
        const name = (child.name ?? "").trim();
        if (!child.id || !name) continue;
        const raw = (child.birthday ?? child.birthdate ?? "").trim();
        if (!raw) continue;
        const next = getNextBirthdayFromIso(raw, base);
        if (!next) continue;
        if (next.daysUntilBirthday < 0 || next.daysUntilBirthday > 7) continue;
        candidates.push({
          key: `childbday_${parent.id}_${child.id}_${next.year}`,
          entityKey: `child:${parent.id}:${child.id}`,
          daysUntil: next.daysUntilBirthday,
          message: `${name}’s birthday ${timePhrase(next.daysUntilBirthday)}`,
          priority: 0,
        });
      }
    }

    // Nearest per entity
    const bestByEntity = new Map<string, Candidate>();
    for (const c of candidates) {
      const existing = bestByEntity.get(c.entityKey);
      if (!existing) {
        bestByEntity.set(c.entityKey, c);
        continue;
      }
      if (c.daysUntil < existing.daysUntil) {
        bestByEntity.set(c.entityKey, c);
        continue;
      }
      if (c.daysUntil === existing.daysUntil && c.priority < existing.priority) {
        bestByEntity.set(c.entityKey, c);
      }
    }

    const items = Array.from(bestByEntity.values())
      .sort((a, b) => (a.daysUntil - b.daysUntil) || (a.priority - b.priority) || a.message.localeCompare(b.message))
      .slice(0, 3);

    return items.length ? items.map((i) => i.message) : [];
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
      if (person.phone) openSmsComposer(person.phone, `Happy birthday, ${person.name}!`);
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
    if (prompt.type === "DISCOVER_MOTHER") {
      updatePersonFields(prompt.personId, { isMother: true });
      dismissPrompt(prompt);
      return;
    }

    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (person?.phone) openSmsComposer(person.phone, `Happy Mother’s Day, ${person.name}!`);
    dismissPrompt(prompt);
  }

  function handleMotherPromptNo(prompt: MotherPromptItem) {
    if (prompt.type === "DISCOVER_MOTHER") {
      updatePersonFields(prompt.personId, { isMother: false });
      dismissPrompt(prompt);
      return;
    }

    dismissPrompt(prompt);
  }

  function handleMotherPromptMaybe(prompt: MotherPromptItem) {
    if (prompt.type === "DISCOVER_MOTHER") {
      dismissPrompt(prompt);
      return;
    }

    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (!person) {
      dismissPrompt(prompt);
      return;
    }

    const year = new Date().getFullYear();
    const mothersDay = getMothersDay(year);
    const date = formatYmd(mothersDay);
    const already = (person.moments ?? []).some((m) => m.type === "custom" && m.label === "Mother’s Day" && m.date === date);
    if (!already) {
      updatePerson({
        ...person,
        moments: [
          ...(person.moments ?? []),
          { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: "custom", label: "Mother’s Day", date, recurring: false },
        ],
      });
    }

    dismissPrompt(prompt);
  }

  function handleFatherPromptYes(prompt: FatherPromptItem) {
    if (prompt.type === "DISCOVER_FATHER") {
      updatePersonFields(prompt.personId, { isFather: true });
      dismissPrompt(prompt);
      return;
    }

    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (person?.phone) openSmsComposer(person.phone, `Happy Father’s Day, ${person.name}!`);
    dismissPrompt(prompt);
  }

  function handleFatherPromptNo(prompt: FatherPromptItem) {
    if (prompt.type === "DISCOVER_FATHER") {
      updatePersonFields(prompt.personId, { isFather: false });
      dismissPrompt(prompt);
      return;
    }

    dismissPrompt(prompt);
  }

  function handleFatherPromptMaybe(prompt: FatherPromptItem) {
    if (prompt.type === "DISCOVER_FATHER") {
      dismissPrompt(prompt);
      return;
    }

    const person = people.find((p) => p.id === prompt.personId) ?? null;
    if (!person) {
      dismissPrompt(prompt);
      return;
    }

    const year = new Date().getFullYear();
    const fathersDay = getFathersDay(year);
    const date = formatYmd(fathersDay);
    const already = (person.moments ?? []).some((m) => m.type === "custom" && m.label === "Father’s Day" && m.date === date);
    if (!already) {
      updatePerson({
        ...person,
        moments: [
          ...(person.moments ?? []),
          { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type: "custom", label: "Father’s Day", date, recurring: false },
        ],
      });
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

    if (suggestion.action.kind === "view") {
      navigate(`/person/${person.id}`);
      return;
    }

    if (suggestion.action.kind === "text") {
      openSmsComposer(person.phone, suggestion.action.body);
      return;
    }

    if (suggestion.action.kind === "giftIdeas") {
      const query = encodeURIComponent(`gift ideas for ${person.name}`);
      const url = `https://www.google.com/search?q=${query}`;
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = url;
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

  const greetingText = activeTab === "home" ? "Your upcoming moments." : "Your contacts.";

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
              <div style={{ marginTop: "1.5rem" }}>
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
                  + Add someone important
                </button>
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
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: "16px",
                    padding: "18px",
                    background: "rgba(255,255,255,0.7)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    marginBottom: "14px",
                  }}
                >
                  <div style={{ fontSize: "22px", fontWeight: 600, color: "var(--muted)" }}>
                    Here’s what’s on the horizon…
                  </div>
                  <GoldenSunDivider />
                  <div style={{ marginTop: "10px", display: "grid", gap: "8px", color: "var(--muted)", fontSize: "16px", lineHeight: 1.45 }}>
                    {gentleForecast && gentleForecast.length ? (
                      gentleForecast.map((line) => (
                        <div key={line} style={{ display: "flex", alignItems: "center" }}>
                          <RaisedGoldBullet />
                          <div style={{ minWidth: 0 }}>{line}</div>
                        </div>
                      ))
                    ) : (
                      <div>Nothing big this week — enjoy the quiet ✨</div>
                    )}
                  </div>
                </div>

                {(() => {
                  const headerStyle: React.CSSProperties = {
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--muted)",
                    letterSpacing: "-0.01em",
                    marginTop: "18px",
                    marginBottom: "10px",
                  };

                  const firstOf = (fullName: string) => (fullName ?? "").trim().split(" ")[0] || fullName || "Text";

                  const todayBirthdayPrompts = visibleBirthdayPrompts.filter((p) => p.type === "TODAY_BIRTHDAY");
                  const comingBirthdayPrompts = visibleBirthdayPrompts.filter(
                    (p) => p.type === "TOMORROW_BIRTHDAY" || p.type === "PREP_BIRTHDAY"
                  );
                  const suggestionBirthdayPrompts = visibleBirthdayPrompts.filter((p) => p.type === "DISCOVER_BIRTHDAY");

                  const todayKidsBirthdayPrompts = visibleKidsBirthdayPrompts.filter((p) => p.type === "TODAY_CHILD_BIRTHDAY");
                  const comingKidsBirthdayPrompts = visibleKidsBirthdayPrompts.filter(
                    (p) => p.type === "TOMORROW_CHILD_BIRTHDAY" || p.type === "PREP_CHILD_BIRTHDAY"
                  );
                  const suggestionKidsBirthdayPrompts = visibleKidsBirthdayPrompts.filter((p) => p.type === "DISCOVER_CHILD_BIRTHDAY");

                  const todayAnniversaryPrompts = visibleAnniversaryPrompts.filter((p) => p.type === "ANNIVERSARY_TODAY");
                  const comingAnniversaryPrompts = visibleAnniversaryPrompts.filter((p) => {
                    if (p.type === "ANNIVERSARY_TOMORROW") return true;
                    if (p.type === "PREP_ANNIVERSARY") return (p as any).daysUntilAnniversary <= 7;
                    return false;
                  });
                  const suggestionAnniversaryPrompts = visibleAnniversaryPrompts.filter((p) => {
                    if (p.type === "DISCOVER_ANNIVERSARY") return true;
                    if (p.type === "PREP_ANNIVERSARY") return (p as any).daysUntilAnniversary > 7;
                    return false;
                  });

                  const comingMotherPrompts = visibleMotherPrompts.filter((p) => p.type === "NUDGE_MOTHERS_DAY");
                  const suggestionMotherPrompts = visibleMotherPrompts.filter((p) => p.type === "DISCOVER_MOTHER");

                  const comingFatherPrompts = visibleFatherPrompts.filter((p) => p.type === "NUDGE_FATHERS_DAY");
                  const suggestionFatherPrompts = visibleFatherPrompts.filter((p) => p.type === "DISCOVER_FATHER");

                  const careQuestions = visibleCareSuggestions.filter((s) => s.type === "question" && s.question);
                  const careNonQuestions = visibleCareSuggestions.filter((s) => s.type !== "question");
                  const careToday = careNonQuestions.filter((s) => s.sortDaysUntil === 0);
                  const careComing = careNonQuestions.filter((s) => s.sortDaysUntil >= 1 && s.sortDaysUntil <= 7);
                  const careLater = careNonQuestions.filter((s) => s.sortDaysUntil > 7);

                  const hasToday =
                    todayBirthdayPrompts.length ||
                    todayKidsBirthdayPrompts.length ||
                    todayAnniversaryPrompts.length ||
                    careToday.length;

                  const hasComing =
                    comingBirthdayPrompts.length ||
                    comingKidsBirthdayPrompts.length ||
                    comingAnniversaryPrompts.length ||
                    comingMotherPrompts.length ||
                    comingFatherPrompts.length ||
                    careComing.length;

                  const hasSuggestions =
                    suggestionBirthdayPrompts.length ||
                    suggestionKidsBirthdayPrompts.length ||
                    suggestionAnniversaryPrompts.length ||
                    suggestionMotherPrompts.length ||
                    suggestionFatherPrompts.length ||
                    Boolean(partnerLinkPrompt) ||
                    careQuestions.length ||
                    careLater.length;

                  const renderCareList = (list: typeof visibleCareSuggestions) => {
                    if (!list.length) return null;
                    return (
                      <div
                        key={`${arrivalTick}_${list.length}`}
                        className={arrivalTick ? "dkf-arrival" : undefined}
                        style={{ marginTop: "1.1rem", display: "grid", gap: "1.75rem" }}
                      >
                        {list.flatMap((suggestion, idx) => {
                          const items: React.ReactNode[] = [];

                          if (idx === 6 && list.length > 6) {
                            items.push(
                              <div key="more-break" style={{ marginTop: "8px" }}>
                                <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>More moments ahead</div>
                              </div>
                            );
                          }

                          items.push(
                            <div key={suggestion.id} className="dkf-enter" style={{ animationDelay: `${idx * 12}ms` }}>
                              {suggestion.type === "question" && suggestion.question ? (
                                <MicroQuestionCard
                                  suggestion={suggestion}
                                  onChoose={(optionId, data) => handleQuestionChoose(suggestion.id, optionId, data)}
                                  onDismiss={() => handleQuestionDismiss(suggestion.id)}
                                />
                              ) : (
                                <CareSuggestionCard
                                  suggestion={suggestion}
                                  onAction={() => handleSuggestionAction(suggestion.id)}
                                  onSnooze={() => setQuestionTick((v) => v + 1)}
                                />
                              )}
                            </div>
                          );

                          return items;
                        })}
                      </div>
                    );
                  };

                  const renderPromptGrid = (children: React.ReactNode) => (
                    <div style={{ display: "grid", gap: "12px", marginBottom: "8px" }}>{children}</div>
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

                  if (!hasToday && !hasComing && !hasSuggestions) return renderEmpty();

                  return (
                    <>
                      {hasToday ? (
                        <>
                          <div style={headerStyle}>Happening today</div>
                          {renderPromptGrid(
                            <>
                              {todayAnniversaryPrompts.map((p) => {
                                const personName = people.find((x) => x.id === p.personId)?.name ?? "";
                                const first = firstOf(personName);
                                const yesLabel = `Text ${first}`;
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.personId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={yesLabel}
                                    noLabel="Not now"
                                    onYes={() => handleAnniversaryPromptYes(p)}
                                    onNo={() => handleAnniversaryPromptNo(p)}
                                    onMaybe={undefined}
                                  />
                                );
                              })}

                              {todayKidsBirthdayPrompts.map((p) => {
                                const parentName = people.find((x) => x.id === p.parentId)?.name ?? "";
                                const first = firstOf(parentName);
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.parentId}_${p.childId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={`Text ${first}`}
                                    noLabel="Not now"
                                    onYes={() => handleKidsBirthdayPromptYes(p)}
                                    onNo={() => handleKidsBirthdayPromptNo(p)}
                                    onMaybe={undefined}
                                  />
                                );
                              })}

                              {todayBirthdayPrompts.map((p) => {
                                const personName = people.find((x) => x.id === p.personId)?.name ?? "";
                                const first = firstOf(personName);
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.personId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={`Text ${first}`}
                                    noLabel="Not now"
                                    onYes={() => handleBirthdayPromptYes(p)}
                                    onNo={() => handleBirthdayPromptNo(p)}
                                    onMaybe={undefined}
                                  />
                                );
                              })}
                            </>
                          )}
                          {renderCareList(careToday)}
                        </>
                      ) : null}

                      {hasComing ? (
                        <>
                          <div style={headerStyle}>Coming up</div>
                          {renderPromptGrid(
                            <>
                              {comingMotherPrompts.map((p) => {
                                const personName = people.find((x) => x.id === p.personId)?.name ?? "";
                                const first = firstOf(personName);
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.personId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={`Text ${first}`}
                                    noLabel="Not now"
                                    maybeLabel="Remind me Sunday"
                                    onYes={() => handleMotherPromptYes(p)}
                                    onNo={() => handleMotherPromptNo(p)}
                                    onMaybe={() => handleMotherPromptMaybe(p)}
                                  />
                                );
                              })}

                              {comingFatherPrompts.map((p) => {
                                const personName = people.find((x) => x.id === p.personId)?.name ?? "";
                                const first = firstOf(personName);
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.personId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={`Text ${first}`}
                                    noLabel="Not now"
                                    maybeLabel="Remind me Sunday"
                                    onYes={() => handleFatherPromptYes(p)}
                                    onNo={() => handleFatherPromptNo(p)}
                                    onMaybe={() => handleFatherPromptMaybe(p)}
                                  />
                                );
                              })}

                              {comingAnniversaryPrompts.map((p) => {
                                const personName = people.find((x) => x.id === p.personId)?.name ?? "";
                                const first = firstOf(personName);
                                const yesLabel =
                                  p.type === "PREP_ANNIVERSARY" ? "Yes, remind me" : `Text ${first}`;
                                const noLabel = p.type === "PREP_ANNIVERSARY" ? "Skip" : "Not now";
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.personId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={yesLabel}
                                    noLabel={noLabel}
                                    onYes={() => handleAnniversaryPromptYes(p)}
                                    onNo={() => handleAnniversaryPromptNo(p)}
                                    onMaybe={undefined}
                                  />
                                );
                              })}

                              {comingKidsBirthdayPrompts.map((p) => {
                                const parentName = people.find((x) => x.id === p.parentId)?.name ?? "";
                                const first = firstOf(parentName);
                                const yesLabel =
                                  p.type === "PREP_CHILD_BIRTHDAY" ? "See ideas" : `Text ${first}`;
                                const noLabel = p.type === "PREP_CHILD_BIRTHDAY" ? "Not now" : "Not now";
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.parentId}_${p.childId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={yesLabel}
                                    noLabel={noLabel}
                                    onYes={() => handleKidsBirthdayPromptYes(p)}
                                    onNo={() => handleKidsBirthdayPromptNo(p)}
                                    onMaybe={undefined}
                                  />
                                );
                              })}

                              {comingBirthdayPrompts.map((p) => {
                                const personName = people.find((x) => x.id === p.personId)?.name ?? "";
                                const first = firstOf(personName);
                                const yesLabel =
                                  p.type === "PREP_BIRTHDAY" ? "See ideas" : `Text ${first}`;
                                return (
                                  <SmartSuggestionCard
                                    key={`${p.personId}_${p.type}`}
                                    variant="nudge"
                                    message={p.message}
                                    yesLabel={yesLabel}
                                    noLabel="Not now"
                                    onYes={() => handleBirthdayPromptYes(p)}
                                    onNo={() => handleBirthdayPromptNo(p)}
                                    onMaybe={undefined}
                                  />
                                );
                              })}
                            </>
                          )}
                          {renderCareList(careComing)}
                        </>
                      ) : null}

                      {hasSuggestions ? (
                        <>
                          <div style={headerStyle}>Suggestions</div>
                          {renderPromptGrid(
                            <>
                              {suggestionMotherPrompts.map((p) => (
                                <SmartSuggestionCard
                                  key={`${p.personId}_${p.type}`}
                                  variant="discover"
                                  message={p.message}
                                  yesLabel="Yes"
                                  noLabel="No"
                                  maybeLabel="Not sure"
                                  onYes={() => handleMotherPromptYes(p)}
                                  onNo={() => handleMotherPromptNo(p)}
                                  onMaybe={() => handleMotherPromptMaybe(p)}
                                />
                              ))}

                              {suggestionFatherPrompts.map((p) => (
                                <SmartSuggestionCard
                                  key={`${p.personId}_${p.type}`}
                                  variant="discover"
                                  message={p.message}
                                  yesLabel="Yes"
                                  noLabel="No"
                                  maybeLabel="Not sure"
                                  onYes={() => handleFatherPromptYes(p)}
                                  onNo={() => handleFatherPromptNo(p)}
                                  onMaybe={() => handleFatherPromptMaybe(p)}
                                />
                              ))}

                              {suggestionAnniversaryPrompts.map((p) => (
                                <SmartSuggestionCard
                                  key={`${p.personId}_${p.type}`}
                                  variant="discover"
                                  message={p.message}
                                  yesLabel="Add anniversary"
                                  noLabel="Not now"
                                  onYes={() => handleAnniversaryPromptYes(p)}
                                  onNo={() => handleAnniversaryPromptNo(p)}
                                  onMaybe={undefined}
                                />
                              ))}

                              {partnerLinkPrompt ? (
                                <SmartSuggestionCard
                                  key={`${partnerLinkPrompt.personId}_${partnerLinkPrompt.partnerId}_PARTNER_LINK`}
                                  variant="nudge"
                                  message={`Would you like to connect ${partnerLinkPrompt.personName} with ${partnerLinkPrompt.partnerName} so dates stay together?`}
                                  yesLabel="Link them"
                                  maybeLabel="Not now"
                                  noLabel="Never show again"
                                  onYes={() => {
                                    const personId = partnerLinkPrompt.personId;
                                    const partnerId = partnerLinkPrompt.partnerId;
                                    const pairKey = `${personId}_${partnerId}`;
                                    updatePersonFields(partnerId, { partnerId: personId });
                                    try {
                                      window.localStorage.setItem(
                                        `doknotforget_dismissed_PARTNER_LINK_never_${pairKey}`,
                                        "1"
                                      );
                                    } catch {
                                      // ignore
                                    }
                                    setPartnerLinkPrompt(null);
                                  }}
                                  onMaybe={() => {
                                    const year = new Date().getFullYear();
                                    const personId = partnerLinkPrompt.personId;
                                    const partnerId = partnerLinkPrompt.partnerId;
                                    const pairKey = `${personId}_${partnerId}`;
                                    try {
                                      window.localStorage.setItem(
                                        `doknotforget_dismissed_PARTNER_LINK_${year}_${pairKey}`,
                                        "1"
                                      );
                                    } catch {
                                      // ignore
                                    }
                                    setPartnerLinkPrompt(null);
                                  }}
                                  onNo={() => {
                                    const personId = partnerLinkPrompt.personId;
                                    const partnerId = partnerLinkPrompt.partnerId;
                                    const pairKey = `${personId}_${partnerId}`;
                                    try {
                                      window.localStorage.setItem(
                                        `doknotforget_dismissed_PARTNER_LINK_never_${pairKey}`,
                                        "1"
                                      );
                                    } catch {
                                      // ignore
                                    }
                                    setPartnerLinkPrompt(null);
                                  }}
                                />
                              ) : null}

                              {suggestionKidsBirthdayPrompts.map((p) => (
                                <SmartSuggestionCard
                                  key={`${p.parentId}_${p.childId}_${p.type}`}
                                  variant="discover"
                                  message={p.message}
                                  yesLabel="Add birthday"
                                  noLabel="Not now"
                                  onYes={() => handleKidsBirthdayPromptYes(p)}
                                  onNo={() => handleKidsBirthdayPromptNo(p)}
                                  onMaybe={undefined}
                                />
                              ))}

                              {suggestionBirthdayPrompts.map((p) => (
                                <SmartSuggestionCard
                                  key={`${p.personId}_${p.type}`}
                                  variant="discover"
                                  message={p.message}
                                  yesLabel="Add birthday"
                                  noLabel="Not now"
                                  onYes={() => handleBirthdayPromptYes(p)}
                                  onNo={() => handleBirthdayPromptNo(p)}
                                  onMaybe={undefined}
                                />
                              ))}
                            </>
                          )}
                          {renderCareList([...careQuestions, ...careLater])}
                        </>
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
      </div>
    </div>
    </div>
  );
}
