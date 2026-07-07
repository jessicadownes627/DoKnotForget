import { useEffect, useMemo, useState } from "react";
import type { CareEvent } from "../models/CareEvent";
import type { Moment, Person } from "../models/Person";
import type { Relationship } from "../models/Relationship";
import PersonEditDrawer from "../components/PersonEditDrawer";
import MomentDatePicker from "../components/MomentDatePicker";
import ContactsSearchResults from "../components/ContactsSearchResults";
import { useAppState } from "../appState";
import { useLocation, useNavigate, useParams } from "../router";
import { getNextBirthdayFromIso } from "../utils/birthdayUtils";
import { parseLocalDate } from "../utils/date";
import { filterContacts } from "../utils/contactSearch";
import { normalizePhone } from "../utils/phone";
import { getSelectedHolidays, holidayOptionLabel } from "../utils/personHolidays";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDate(value: string) {
  return parseLocalDate(value);
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

function formatMonthDay(isoMonthDay: string, formatter: Intl.DateTimeFormat) {
  const [mmStr, ddStr] = isoMonthDay.trim().split("-");
  const mm = Number(mmStr);
  const dd = Number(ddStr);
  if (!mmStr || !ddStr || Number.isNaN(mm) || Number.isNaN(dd)) return isoMonthDay;
  const parsed = new Date(2000, mm - 1, dd);
  if (Number.isNaN(parsed.getTime())) return isoMonthDay;
  if (parsed.getMonth() !== mm - 1 || parsed.getDate() !== dd) return isoMonthDay;
  return formatter.format(parsed);
}

function formatBirthday(
  dateString: string | undefined,
  monthDayFormatter: Intl.DateTimeFormat,
  fullDateFormatter: Intl.DateTimeFormat
) {
  if (!dateString) return "";

  const [yearStr, monthStr, dayStr] = dateString.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!monthStr || !dayStr || Number.isNaN(month) || Number.isNaN(day)) return "";

  const parsed = new Date(year > 0 ? year : 2000, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return "";
  if (parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return "";

  return year > 0 ? fullDateFormatter.format(parsed) : monthDayFormatter.format(parsed);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseYmd(value: string) {
  const [yStr, mStr, dStr] = value.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!yStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
  return { y, m, d };
}

function buildMomentIso(monthDay: string, year: string, requireYear: boolean) {
  if (!monthDay) return "";
  const parts = parseYmd(monthDay);
  if (!parts) return "";
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const y = year.trim();
  if (!y) return requireYear ? "" : `0000-${mm}-${dd}`;
  return `${y.padStart(4, "0")}-${mm}-${dd}`;
}

function connectionDraftFromIso(value: string | undefined) {
  if (!value) return { monthDay: "", year: "" };
  const parts = parseYmd(value);
  if (!parts) return { monthDay: "", year: "" };
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  return {
    monthDay: `2000-${mm}-${dd}`,
    year: parts.y > 0 ? String(parts.y) : "",
  };
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

  if (!hasHadBirthdayThisYear) age -= 1;
  return age >= 0 ? age : undefined;
}

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function formatRelationshipType(type: Relationship["type"] | "parent") {
  if (type === "other") return "Someone important";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

type EditableConnection = {
  person: Person;
  type: Relationship["type"] | "parent";
  relationshipId: string | null;
};

type MomentComposerState =
  | { kind: "hidden" }
  | { kind: "chooser" }
  | { kind: "birthday" }
  | { kind: "anniversary" }
  | { kind: "custom"; momentId: string | null };

function SurfaceCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      className="dkf-enter"
      style={{
        borderRadius: "28px",
        border: "1px solid rgba(10, 27, 42, 0.08)",
        background: "rgba(255,255,255,0.88)",
        boxShadow: "0 16px 45px rgba(32, 26, 17, 0.06)",
        padding: "1.1rem",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function ActionPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: "999px",
        border: "1px solid rgba(10, 27, 42, 0.1)",
        background: "rgba(255,255,255,0.92)",
        color: "var(--ink)",
        padding: "0.8rem 0.95rem",
        fontSize: "0.94rem",
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  );
}

export default function PersonDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { people, relationships, careEvents, updatePerson, updatePersonFields, upsertRelationship, deletePerson } =
    useAppState();
  const person = people.find((p) => p.id === id) ?? null;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [initialChildId, setInitialChildId] = useState<string | null>(null);
  const [startWithNewChild, setStartWithNewChild] = useState(false);
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  const [connectionType, setConnectionType] = useState<"partner" | "child" | "grandchild" | "familyMember">("child");
  const [connectionName, setConnectionName] = useState("");
  const [connectionPhone, setConnectionPhone] = useState("");
  const [connectionPhoneError, setConnectionPhoneError] = useState(false);
  const [connectionBirthdayMonthDay, setConnectionBirthdayMonthDay] = useState("");
  const [connectionBirthdayYear, setConnectionBirthdayYear] = useState("");
  const [isConnectionBirthdayOpen, setIsConnectionBirthdayOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<EditableConnection | null>(null);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [momentComposer, setMomentComposer] = useState<MomentComposerState>({ kind: "hidden" });
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");
  const [customMomentTitle, setCustomMomentTitle] = useState("");
  const [customMomentDate, setCustomMomentDate] = useState("");
  const [customDraftMonthDay, setCustomDraftMonthDay] = useState("");
  const [customDraftYear, setCustomDraftYear] = useState("");
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [isPhoneEditorOpen, setIsPhoneEditorOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneDraftError, setPhoneDraftError] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (!person) navigate("/home", { replace: true });
  }, [navigate, person]);

  if (!person) return null;

  const resolvedPerson = person;
  const reviewImportedIds = Array.isArray(location.state?.reviewImportedIds)
    ? (location.state.reviewImportedIds as unknown[]).filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    : [];
  const returnToImportReview = location.state?.returnToImportReview === true && reviewImportedIds.length > 0;
  const startConnectionType =
    location.state?.startConnectionType === "child" || location.state?.startConnectionType === "partner"
      ? location.state.startConnectionType
      : null;

  function navigateBack() {
    if (returnToImportReview) {
      navigate("/import", { state: { reviewImportedIds } });
      return;
    }
    navigate("/home", { state: { defaultTab: "contacts" } });
  }

  useEffect(() => {
    if (!startConnectionType) return;
    resetConnectionDraft();
    setConnectionType(startConnectionType);
    setIsAddConnectionOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, navigate, startConnectionType]);

  const monthDayFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }),
    []
  );
  const fullDateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }),
    []
  );

  const birthdayMoment = useMemo(
    () => (person.moments ?? []).find((m) => m.type === "birthday") ?? null,
    [person.moments]
  );
  const anniversaryMoment = useMemo(
    () => (person.moments ?? []).find((m) => m.type === "anniversary") ?? null,
    [person.moments]
  );

  const birthdayInfo = useMemo(() => {
    const b = birthdayMoment;
    if (!b?.date) return null;
    const next = getNextBirthdayFromIso(b.date, today);
    if (!next) return null;
    const formattedDate = formatBirthday(b.date, monthDayFormatter, fullDateFormatter);
    const age = calculateAge(b.date, today);
    if (!formattedDate) return null;
    return {
      formattedDate,
      age,
      isToday: next.daysUntilBirthday === 0,
      daysUntil: next.daysUntilBirthday,
    };
  }, [birthdayMoment, fullDateFormatter, monthDayFormatter, today]);

  const anniversaryDisplay = useMemo(() => {
    const mmdd = getAnniversaryMonthDay(person);
    if (!mmdd) return null;
    return formatMonthDay(mmdd, monthDayFormatter);
  }, [monthDayFormatter, person]);

  const otherMoments = useMemo(() => {
    return (person.moments ?? [])
      .filter((moment) => moment.type === "custom")
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [person.moments]);

  const relationshipsForPerson = (relationships ?? []).filter(
    (rel) => rel.fromId === person.id || rel.toId === person.id
  );

  const relatedPeople = (() => {
    const items: EditableConnection[] = relationshipsForPerson
      .map((rel) => {
        const otherId = rel.fromId === person.id ? rel.toId : rel.fromId;
        const otherPerson = (people ?? []).find((p) => p.id === otherId) ?? null;
        if (!otherPerson) return null;
        const displayType: EditableConnection["type"] =
          rel.type === "child"
            ? rel.fromId === person.id
              ? "child"
              : "parent"
            : rel.type;
        return { person: otherPerson, type: displayType, relationshipId: rel.id };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const hasPartnerRelationship = items.some(
      (item) => item.type === "partner" && item.person.id === person.partnerId
    );
    if (person.partnerId && !hasPartnerRelationship) {
      const partner = people.find((candidate) => candidate.id === person.partnerId) ?? null;
      if (partner) items.push({ person: partner, type: "partner", relationshipId: null });
    }

    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.type}:${item.person.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const groupedRelatedPeople = useMemo(() => {
    const relationshipOrder: Array<Relationship["type"]> = ["partner", "child", "parent", "sibling", "friend", "other"];
    return relationshipOrder
      .map((type) => ({
        type,
        items: relatedPeople
          .filter((item) => item.type === type)
          .sort((a, b) => a.person.name.localeCompare(b.person.name)),
      }))
      .filter((group) => group.items.length > 0);
  }, [relatedPeople]);

  const availableConnections = useMemo(() => {
    const connectedIds = new Set(relatedPeople.map((item) => item.person.id));
    return people.filter((candidate) => {
      if (candidate.id === resolvedPerson.id) return false;
      if (editingConnection?.person.id === candidate.id) return true;
      return !connectedIds.has(candidate.id);
    });
  }, [editingConnection?.person.id, people, relatedPeople, resolvedPerson.id]);

  const filteredConnectionResults = useMemo(() => {
    return filterContacts(availableConnections, connectionSearch).slice(0, 8);
  }, [availableConnections, connectionSearch]);

  const selectedConnection =
    !editingConnection && selectedConnectionId
      ? availableConnections.find((candidate) => candidate.id === selectedConnectionId) ?? null
      : null;

  const familyTimeline = useMemo(() => {
    const events: Array<{ id: string; label: string; targetDate: Date }> = [];

    const addRecurringEvent = (id: string, label: string, isoDate: string | undefined) => {
      if (!isoDate) return;
      const next = getNextBirthdayFromIso(isoDate, today);
      if (!next || next.target < today) return;
      events.push({ id, label, targetDate: next.target });
    };

    const addOneTimeOrRecurringMoment = (momentId: string, label: string, isoDate: string, recurring: boolean) => {
      if (!isoDate) return;
      if (recurring) {
        addRecurringEvent(momentId, label, isoDate);
        return;
      }
      const parsed = parseLocalDate(isoDate);
      if (!parsed || parsed < today) return;
      events.push({ id: momentId, label, targetDate: parsed });
    };

    addRecurringEvent(`${resolvedPerson.id}:birthday`, `${possessive(resolvedPerson.name)} birthday`, birthdayMoment?.date);
    const anniversaryIso = anniversaryMoment?.date
      ? anniversaryMoment.date
      : resolvedPerson.anniversary
        ? `0000-${resolvedPerson.anniversary}`
        : undefined;
    addRecurringEvent(`${resolvedPerson.id}:anniversary`, `${possessive(resolvedPerson.name)} anniversary`, anniversaryIso);

    for (const child of resolvedPerson.children ?? []) {
      const childBirthday = (child.birthday ?? child.birthdate ?? "").trim();
      if (!childBirthday) continue;
      const childName = child.name?.trim() || "Child";
      addRecurringEvent(`${resolvedPerson.id}:child:${child.id}`, `${childName}'s birthday`, childBirthday);
    }

    for (const moment of resolvedPerson.moments ?? []) {
      if (moment.type !== "custom") continue;
      addOneTimeOrRecurringMoment(moment.id, moment.label, moment.date, moment.recurring);
    }

    return events
      .sort((a, b) => {
        if (a.targetDate.getTime() !== b.targetDate.getTime()) {
          return a.targetDate.getTime() - b.targetDate.getTime();
        }
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      })
      .slice(0, 3);
  }, [
    anniversaryMoment?.date,
    birthdayMoment?.date,
    resolvedPerson.anniversary,
    resolvedPerson.children,
    resolvedPerson.id,
    resolvedPerson.moments,
    resolvedPerson.name,
    today,
  ]);

  const careHistory = useMemo(() => {
    return [...careEvents]
      .filter((event) => event.personId === person.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 3);
  }, [careEvents, person.id]);

  const children = useMemo(() => {
    return [...(person.children ?? [])].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
    );
  }, [person.children]);

  const selectedHolidays = getSelectedHolidays(person);

  const relationshipLine = useMemo(() => {
    const primary = groupedRelatedPeople[0];
    if (!primary?.items.length) return null;
    if (primary.type === "partner") return "Connected to a partner";
    if (primary.type === "child") return `Connected to ${children.length} ${children.length === 1 ? "child" : "children"}`;
    return primary.items.length === 1
      ? `Connected to ${primary.items[0].person.name}`
      : `Connected to ${primary.items.length} people`;
  }, [children.length, groupedRelatedPeople]);

  const portraitSubtitle = birthdayInfo
    ? birthdayInfo.isToday
      ? `${possessive(person.name)} birthday is today`
      : birthdayInfo.daysUntil === 1
        ? `${possessive(person.name)} birthday is tomorrow`
        : `${possessive(person.name)} birthday is in ${birthdayInfo.daysUntil} days`
    : anniversaryDisplay
      ? `Anniversary on ${anniversaryDisplay}`
      : relationshipLine ?? "A living page in your circle";

  function formatCareEventDate(timestamp: string) {
    const parsed = parseLocalDate(timestamp.slice(0, 10));
    if (!parsed) return timestamp;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parsed);
  }

  function describeCareEvent(event: CareEvent) {
    const personName = resolvedPerson.name.trim() || "them";
    if (event.note?.trim()) return event.note.trim();
    if (event.type === "text") return `Texted ${personName}`;
    if (event.type === "ecard") return `Sent ${personName} an eCard`;
    if (event.type === "gift") return `Sent ${personName} a gift`;
    if (event.type === "coffee") return `Bought ${personName} a coffee`;
    if ((resolvedPerson.moments ?? []).some((moment) => moment.type === "birthday")) {
      return `Completed ${possessive(personName)} birthday reminder`;
    }
    return `Checked in with ${personName}`;
  }

  function updateMomentBuckets(nextMoments: Moment[]) {
    updatePerson({
      ...resolvedPerson,
      moments: nextMoments,
      importantDates: nextMoments.filter((moment) => moment.type === "custom" && moment.category !== "sensitive"),
      sensitiveMoments: nextMoments.filter((moment) => moment.type === "custom" && moment.category === "sensitive"),
    });
  }

  function resetMomentComposer() {
    setMomentComposer({ kind: "hidden" });
    setBirthdayDraftMonthDay("");
    setBirthdayDraftYear("");
    setAnniversaryDraftMonthDay("");
    setAnniversaryDraftYear("");
    setCustomMomentTitle("");
    setCustomMomentDate("");
    setCustomDraftMonthDay("");
    setCustomDraftYear("");
    setIsCustomDatePickerOpen(false);
  }

  function openBirthdayEditor() {
    const draft = connectionDraftFromIso(birthdayMoment?.date);
    setBirthdayDraftMonthDay(draft.monthDay);
    setBirthdayDraftYear(draft.year);
    setMomentComposer({ kind: "birthday" });
  }

  function openAnniversaryEditor() {
    const draft = connectionDraftFromIso(anniversaryMoment?.date);
    setAnniversaryDraftMonthDay(draft.monthDay);
    setAnniversaryDraftYear(draft.year);
    setMomentComposer({ kind: "anniversary" });
  }

  function openCustomMomentEditor(moment?: Moment) {
    setCustomMomentTitle(moment?.label ?? "");
    setCustomMomentDate(moment?.date ?? "");
    const draft = connectionDraftFromIso(moment?.date);
    setCustomDraftMonthDay(draft.monthDay);
    setCustomDraftYear(draft.year);
    setMomentComposer({ kind: "custom", momentId: moment?.id ?? null });
  }

  function saveBirthdayFromDraft() {
    const iso = buildMomentIso(birthdayDraftMonthDay, birthdayDraftYear, false);
    if (!iso) return;
    const updatedMoment: Moment = birthdayMoment
      ? { ...birthdayMoment, date: iso, recurring: true }
      : { id: makeId(), type: "birthday", label: "Birthday", date: iso, recurring: true };
    const other = resolvedPerson.moments.filter((moment) => moment.type !== "birthday");
    updateMomentBuckets([updatedMoment, ...other]);
    setMomentComposer({ kind: "hidden" });
  }

  function saveAnniversaryFromDraft() {
    const iso = buildMomentIso(anniversaryDraftMonthDay, anniversaryDraftYear, false);
    if (!iso) return;
    const updatedMoment: Moment = anniversaryMoment
      ? { ...anniversaryMoment, date: iso, recurring: true }
      : { id: makeId(), type: "anniversary", label: "Anniversary", date: iso, recurring: true };
    const other = resolvedPerson.moments.filter((moment) => moment.type !== "anniversary");
    updatePerson({
      ...resolvedPerson,
      anniversary: `${iso.split("-")[1]}-${iso.split("-")[2]}`,
      moments: [updatedMoment, ...other],
      importantDates: resolvedPerson.importantDates,
      sensitiveMoments: resolvedPerson.sensitiveMoments,
    });
    setMomentComposer({ kind: "hidden" });
  }

  function saveCustomMoment() {
    if (!customMomentTitle.trim() || !customMomentDate) return;
    const existingId = momentComposer.kind === "custom" ? momentComposer.momentId : null;
    const nextMoment: Moment = {
      id: existingId ?? makeId(),
      type: "custom",
      label: customMomentTitle.trim(),
      date: customMomentDate,
      recurring: true,
    };
    const remaining = resolvedPerson.moments.filter((moment) => moment.id !== existingId);
    updateMomentBuckets([...remaining, nextMoment].sort((a, b) => a.label.localeCompare(b.label)));
    resetMomentComposer();
  }

  function resetConnectionDraft() {
    setConnectionType(resolvedPerson.partnerId ? "child" : "partner");
    setConnectionName("");
    setConnectionPhone("");
    setConnectionPhoneError(false);
    setConnectionBirthdayMonthDay("");
    setConnectionBirthdayYear("");
    setIsConnectionBirthdayOpen(false);
    setEditingConnection(null);
    setConnectionSearch("");
    setSelectedConnectionId(null);
  }

  function openAddConnection(startType: "child" | "partner" | "familyMember" = "familyMember") {
    resetConnectionDraft();
    setConnectionType(startType);
    setIsAddConnectionOpen(true);
  }

  function saveConnection() {
    if (editingConnection) {
      const trimmedName = connectionName.trim();
      if (!trimmedName) return;

      const normalizedPhone = connectionPhone.trim() ? normalizePhone(connectionPhone) : null;
      if (connectionPhone.trim() && !normalizedPhone) {
        setConnectionPhoneError(true);
        return;
      }

      const birthdayIso = buildMomentIso(connectionBirthdayMonthDay, connectionBirthdayYear, false);
      const existingMoments = [...(editingConnection.person.moments ?? [])];
      const existingBirthdayIndex = existingMoments.findIndex((moment) => moment.type === "birthday");
      if (birthdayIso) {
        const nextBirthdayMoment = {
          id: existingBirthdayIndex >= 0 ? existingMoments[existingBirthdayIndex].id : makeId(),
          type: "birthday" as const,
          label: "Birthday",
          date: birthdayIso,
          recurring: true,
        };
        if (existingBirthdayIndex >= 0) existingMoments[existingBirthdayIndex] = nextBirthdayMoment;
        else existingMoments.unshift(nextBirthdayMoment);
      } else if (existingBirthdayIndex >= 0) {
        existingMoments.splice(existingBirthdayIndex, 1);
      }

      const relationshipType: Relationship["type"] =
        connectionType === "partner" ? "partner" : connectionType === "child" ? "child" : "other";

      updatePerson({
        ...editingConnection.person,
        name: trimmedName,
        phone: normalizedPhone || undefined,
        moments: existingMoments,
        importantDates: existingMoments.filter((moment) => moment.type === "custom"),
        partnerId:
          relationshipType === "partner"
            ? resolvedPerson.id
            : editingConnection.person.partnerId === resolvedPerson.id
              ? null
              : editingConnection.person.partnerId,
      });

      updatePerson({
        ...resolvedPerson,
        partnerId:
          relationshipType === "partner"
            ? editingConnection.person.id
            : resolvedPerson.partnerId === editingConnection.person.id
              ? null
              : resolvedPerson.partnerId,
      });

      upsertRelationship({
        id: editingConnection.relationshipId ?? makeId(),
        fromId: resolvedPerson.id,
        toId: editingConnection.person.id,
        type: relationshipType,
      });

      setIsAddConnectionOpen(false);
      resetConnectionDraft();
      return;
    }

    if (!selectedConnection) return;
    if (!people.some((candidate) => candidate.id === selectedConnection.id)) return;

    const relationshipType: Relationship["type"] =
      connectionType === "partner" ? "partner" : connectionType === "child" ? "child" : "other";

    updatePerson({
      ...resolvedPerson,
      partnerId: relationshipType === "partner" ? selectedConnection.id : resolvedPerson.partnerId,
    });

    if (relationshipType === "partner") {
      updatePerson({
        ...selectedConnection,
        partnerId: resolvedPerson.id,
      });
    }

    upsertRelationship({
      id: makeId(),
      fromId: resolvedPerson.id,
      toId: selectedConnection.id,
      type: relationshipType,
    });

    setIsAddConnectionOpen(false);
    resetConnectionDraft();
  }

  function openPersonEditor() {
    setInitialChildId(null);
    setStartWithNewChild(false);
    setIsEditOpen(true);
  }

  function openChildEditor(childId: string) {
    setInitialChildId(childId);
    setStartWithNewChild(false);
    setIsEditOpen(true);
  }

  function openAddChildEditor() {
    setInitialChildId(null);
    setStartWithNewChild(true);
    setIsAddConnectionOpen(false);
    setIsEditOpen(true);
  }

  function openPhoneEditor() {
    setPhoneDraft(resolvedPerson.phone ?? "");
    setPhoneDraftError(false);
    setIsPhoneEditorOpen(true);
  }

  function savePhone() {
    const normalizedPhone = phoneDraft.trim() ? normalizePhone(phoneDraft) : null;
    if (phoneDraft.trim() && !normalizedPhone) {
      setPhoneDraftError(true);
      return;
    }
    updatePersonFields(resolvedPerson.id, { phone: normalizedPhone || undefined });
    setIsPhoneEditorOpen(false);
  }

  const promptCards = useMemo(() => {
    const cards: Array<{ title: string; action: string; onClick: () => void }> = [];
    if (!anniversaryDisplay) {
      cards.push({
        title: "Add an anniversary while you're here",
        action: "Add anniversary",
        onClick: openAnniversaryEditor,
      });
    }
    if (!children.length) {
      cards.push({
        title: "Someone else connected might matter too",
        action: "Add child",
        onClick: openAddChildEditor,
      });
    }
    if (!relatedPeople.some((item) => item.type === "partner") && !resolvedPerson.partnerId) {
      cards.push({
        title: "A partner can make this page feel fuller",
        action: "Add partner",
        onClick: () => openAddConnection("partner"),
      });
    }
    if (!resolvedPerson.phone) {
      cards.push({
        title: "Make reaching out easier from reminders",
        action: "Add phone number",
        onClick: openPhoneEditor,
      });
    }
    return cards.slice(0, 2);
  }, [anniversaryDisplay, children.length, relatedPeople, resolvedPerson.partnerId, resolvedPerson.phone]);

  const pageBackground =
    "radial-gradient(circle at top, rgba(243, 232, 209, 0.95) 0%, rgba(247, 244, 238, 0.96) 36%, rgba(244, 239, 231, 1) 100%)";

  return (
    <div style={{ background: pageBackground, color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding:
            "calc(env(safe-area-inset-top) + 24px) 16px calc(32px + env(safe-area-inset-bottom)) 16px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "grid", gap: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            <button
              type="button"
              onClick={navigateBack}
              style={{ border: "none", background: "none", color: "var(--muted)", padding: 0 }}
            >
              Back
            </button>
            <button
              type="button"
              onClick={openPersonEditor}
              style={{ border: "none", background: "none", color: "var(--muted)", padding: 0 }}
            >
              Edit details
            </button>
          </div>

          <SurfaceCard style={{ padding: "1.2rem 1.2rem 1.3rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div
                aria-hidden="true"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "22px",
                  background: "linear-gradient(145deg, rgba(240,225,196,0.95), rgba(222,196,145,0.95))",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ink)",
                  fontSize: "1.2rem",
                  fontWeight: 700,
                }}
              >
                {(resolvedPerson.name.trim()[0] ?? "?").toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "2rem",
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {resolvedPerson.name.trim()}
                </div>
                <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.95rem" }}>
                  {portraitSubtitle}
                </div>
              </div>
            </div>

            <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.7rem" }}>
              <ActionPill label="Add a moment" onClick={() => setMomentComposer({ kind: "chooser" })} />
              <ActionPill label="Add family" onClick={() => openAddConnection("child")} />
              <ActionPill label="Make reaching out easier" onClick={openPhoneEditor} />
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>Important moments</div>
                <div style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                  What helps you remember {resolvedPerson.name.trim()} well.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMomentComposer({ kind: "chooser" })}
                style={{ border: "none", background: "none", color: "var(--ink)", padding: 0, fontWeight: 600 }}
              >
                Add
              </button>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
              <button
                type="button"
                onClick={openBirthdayEditor}
                style={{
                  border: "1px solid rgba(10, 27, 42, 0.08)",
                  background: "rgba(255,255,255,0.84)",
                  borderRadius: "20px",
                  padding: "1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                }}
              >
                <div style={{ fontWeight: 600 }}>🎂 {possessive(resolvedPerson.name)} birthday</div>
                <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                  {birthdayInfo
                    ? birthdayInfo.isToday
                      ? `${birthdayInfo.formattedDate} · today`
                      : `${birthdayInfo.formattedDate} · in ${birthdayInfo.daysUntil} days`
                    : "Add a date"}
                </div>
              </button>

              <button
                type="button"
                onClick={openAnniversaryEditor}
                style={{
                  border: "1px solid rgba(10, 27, 42, 0.08)",
                  background: "rgba(255,255,255,0.84)",
                  borderRadius: "20px",
                  padding: "1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                }}
              >
                <div style={{ fontWeight: 600 }}>💕 Anniversary</div>
                <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                  {anniversaryDisplay ?? "Add a date"}
                </div>
              </button>

              {otherMoments.map((moment) => (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => openCustomMomentEditor(moment)}
                  style={{
                    border: "1px solid rgba(10, 27, 42, 0.08)",
                    background: "rgba(255,255,255,0.84)",
                    borderRadius: "20px",
                    padding: "1rem",
                    textAlign: "left",
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>✨ {moment.label}</div>
                  <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                    {parseIsoDate(moment.date)
                      ? Number(moment.date.split("-")[0] ?? 0) > 0
                        ? fullDateFormatter.format(parseIsoDate(moment.date) as Date)
                        : monthDayFormatter.format(parseIsoDate(moment.date) as Date)
                      : moment.date}
                  </div>
                </button>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>People around {resolvedPerson.name.trim()}</div>
                <div style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                  The people connected to this page.
                </div>
              </div>
              <button
                type="button"
                onClick={() => openAddConnection("familyMember")}
                style={{ border: "none", background: "none", color: "var(--ink)", padding: 0, fontWeight: 600 }}
              >
                Add
              </button>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
              {children.map((child) => {
                const birthday = formatBirthday(child.birthday ?? child.birthdate ?? undefined, monthDayFormatter, fullDateFormatter);
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => openChildEditor(child.id)}
                    style={{
                      border: "1px solid rgba(10, 27, 42, 0.08)",
                      background: "rgba(255,255,255,0.84)",
                      borderRadius: "20px",
                      padding: "1rem",
                      textAlign: "left",
                      color: "var(--ink)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{child.name?.trim() || "Unnamed child"}</div>
                    <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                      {birthday ? `Birthday: ${birthday}` : "Child in your circle"}
                    </div>
                  </button>
                );
              })}

              {groupedRelatedPeople.map((group) =>
                group.items.map((item) => (
                  <button
                    key={`${group.type}-${item.person.id}`}
                    type="button"
                    onClick={() => navigate(`/person/${item.person.id}`)}
                    style={{
                      border: "1px solid rgba(10, 27, 42, 0.08)",
                      background: "rgba(255,255,255,0.84)",
                      borderRadius: "20px",
                      padding: "1rem",
                      textAlign: "left",
                      color: "var(--ink)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{item.person.name}</div>
                    <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                      {formatRelationshipType(group.type)}
                    </div>
                  </button>
                ))
              )}

              {!children.length && groupedRelatedPeople.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>No one else is connected yet.</div>
              ) : null}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>Ways to show up</div>
                <div style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                  Small things that make reminders easier to act on.
                </div>
              </div>
              <button
                type="button"
                onClick={openPhoneEditor}
                style={{ border: "none", background: "none", color: "var(--ink)", padding: 0, fontWeight: 600 }}
              >
                Edit
              </button>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
              <button
                type="button"
                onClick={openPhoneEditor}
                style={{
                  border: "1px solid rgba(10, 27, 42, 0.08)",
                  background: "rgba(255,255,255,0.84)",
                  borderRadius: "20px",
                  padding: "1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                }}
              >
                <div style={{ fontWeight: 600 }}>📱 Phone number</div>
                <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                  {resolvedPerson.phone
                    ? `${resolvedPerson.phone} · ready for quick texting from reminders`
                    : "Add a number if you'd like to text directly from reminders"}
                </div>
              </button>

              {selectedHolidays.length ? (
                <div
                  style={{
                    border: "1px solid rgba(10, 27, 42, 0.08)",
                    background: "rgba(255,255,255,0.84)",
                    borderRadius: "20px",
                    padding: "1rem",
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>🎉 Holidays that matter</div>
                  <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                    {selectedHolidays.map((holidayId) => (
                      <span
                        key={holidayId}
                        style={{
                          borderRadius: "999px",
                          background: "rgba(242,231,210,0.95)",
                          padding: "0.5rem 0.7rem",
                          fontSize: "0.88rem",
                        }}
                      >
                        {holidayOptionLabel(holidayId)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {careHistory.length ? (
                <div
                  style={{
                    border: "1px solid rgba(10, 27, 42, 0.08)",
                    background: "rgba(255,255,255,0.84)",
                    borderRadius: "20px",
                    padding: "1rem",
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Recent care</div>
                  <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.6rem" }}>
                    {careHistory.map((event) => (
                      <div key={event.id} style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
                        <span style={{ color: "var(--ink)" }}>{formatCareEventDate(event.timestamp)}</span> ·{" "}
                        {describeCareEvent(event)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </SurfaceCard>

          {familyTimeline.length || promptCards.length ? (
            <SurfaceCard>
              <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>While you're here</div>
              <div style={{ marginTop: "0.25rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                One more small thing could make this page even more helpful.
              </div>

              {familyTimeline.length ? (
                <div style={{ marginTop: "1rem", display: "grid", gap: "0.7rem" }}>
                  {familyTimeline.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        border: "1px solid rgba(10, 27, 42, 0.08)",
                        background: "rgba(255,255,255,0.84)",
                        borderRadius: "18px",
                        padding: "0.95rem 1rem",
                        color: "var(--ink)",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{event.label}</div>
                      <div style={{ marginTop: "0.22rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                        {monthDayFormatter.format(event.targetDate)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {promptCards.length ? (
                <div style={{ marginTop: familyTimeline.length ? "1rem" : "1rem", display: "grid", gap: "0.7rem" }}>
                  {promptCards.map((card, index) => (
                    <button
                      key={`${card.title}-${index}`}
                      type="button"
                      onClick={card.onClick}
                      style={{
                        border: "1px dashed rgba(10, 27, 42, 0.16)",
                        background: "rgba(255,255,255,0.7)",
                        borderRadius: "18px",
                        padding: "0.95rem 1rem",
                        textAlign: "left",
                        color: "var(--ink)",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{card.title}</div>
                      <div style={{ marginTop: "0.22rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                        {card.action}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </SurfaceCard>
          ) : null}

          <div
            style={{
              paddingTop: "0.4rem",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                const ok = window.confirm("Are you sure you want to delete this contact?\nThis cannot be undone.");
                if (!ok) return;
                deletePerson(resolvedPerson.id);
                navigateBack();
              }}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "#b42318",
                fontSize: "14px",
                fontWeight: 500,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Delete contact
            </button>
          </div>
        </div>
      </div>

      {momentComposer.kind === "chooser" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add a moment"
          onClick={resetMomentComposer}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 20, 0.22)",
            display: "grid",
            placeItems: "center",
            padding: "1.25rem",
            zIndex: 80,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              borderRadius: "26px",
              border: "1px solid rgba(10, 27, 42, 0.08)",
              background: "rgba(255,255,255,0.98)",
              boxShadow: "0 24px 60px rgba(20, 16, 10, 0.16)",
              padding: "1.2rem",
              display: "grid",
              gap: "0.8rem",
            }}
          >
            <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>What should we remember for {resolvedPerson.name.trim()}?</div>
            <ActionPill label="🎂 Birthday" onClick={openBirthdayEditor} />
            <ActionPill label="💕 Anniversary" onClick={openAnniversaryEditor} />
            <ActionPill label="✨ Important date" onClick={() => openCustomMomentEditor()} />
            <button
              type="button"
              onClick={resetMomentComposer}
              style={{ border: "none", background: "none", color: "var(--muted)", padding: 0, justifySelf: "start" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <MomentDatePicker
        isOpen={momentComposer.kind === "birthday"}
        title={`${possessive(resolvedPerson.name)} birthday`}
        mode="birthday"
        monthDay={birthdayDraftMonthDay}
        setMonthDay={setBirthdayDraftMonthDay}
        year={birthdayDraftYear}
        setYear={setBirthdayDraftYear}
        yearHelperText="The year helps with milestone birthdays, but it's okay if you don't know it."
        onSave={saveBirthdayFromDraft}
        onCancel={resetMomentComposer}
        onClear={() => {
          setBirthdayDraftMonthDay("");
          setBirthdayDraftYear("");
          if (birthdayMoment) {
            updateMomentBuckets(resolvedPerson.moments.filter((moment) => moment.id !== birthdayMoment.id));
          }
          setMomentComposer({ kind: "hidden" });
        }}
      />

      <MomentDatePicker
        isOpen={momentComposer.kind === "anniversary"}
        title={`${resolvedPerson.name.trim()}'s anniversary`}
        mode="anniversary"
        monthDay={anniversaryDraftMonthDay}
        setMonthDay={setAnniversaryDraftMonthDay}
        year={anniversaryDraftYear}
        setYear={setAnniversaryDraftYear}
        yearHelperText=""
        onSave={saveAnniversaryFromDraft}
        onCancel={resetMomentComposer}
        onClear={() => {
          setAnniversaryDraftMonthDay("");
          setAnniversaryDraftYear("");
          updatePerson({
            ...resolvedPerson,
            anniversary: undefined,
            moments: resolvedPerson.moments.filter((moment) => moment.type !== "anniversary"),
          });
          setMomentComposer({ kind: "hidden" });
        }}
      />

      {momentComposer.kind === "custom" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Important date"
          onClick={resetMomentComposer}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 20, 0.22)",
            display: "grid",
            placeItems: "center",
            padding: "1.25rem",
            zIndex: 80,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "540px",
              borderRadius: "26px",
              border: "1px solid rgba(10, 27, 42, 0.08)",
              background: "rgba(255,255,255,0.98)",
              boxShadow: "0 24px 60px rgba(20, 16, 10, 0.16)",
              padding: "1.2rem",
              display: "grid",
              gap: "0.9rem",
            }}
          >
            <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>What should we remember for {resolvedPerson.name.trim()}?</div>
            <input
              value={customMomentTitle}
              onChange={(e) => setCustomMomentTitle(e.target.value)}
              placeholder="Birthday dinner, anniversary, important date..."
              style={{
                width: "100%",
                padding: "0.95rem 1rem",
                borderRadius: "16px",
                border: "1px solid rgba(10, 27, 42, 0.1)",
                background: "rgba(255,255,255,0.95)",
              }}
            />
            <button
              type="button"
              onClick={() => {
                const draft = connectionDraftFromIso(customMomentDate);
                setCustomDraftMonthDay(draft.monthDay);
                setCustomDraftYear(draft.year);
                setIsCustomDatePickerOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem",
                borderRadius: "16px",
                border: "1px solid rgba(10, 27, 42, 0.1)",
                background: "rgba(255,255,255,0.95)",
                color: "var(--ink)",
              }}
            >
              <span>Choose the date</span>
              <span style={{ color: "var(--muted)" }}>
                {customMomentDate ? formatBirthday(customMomentDate, monthDayFormatter, fullDateFormatter) : "Month and day"}
              </span>
            </button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <button
                type="button"
                onClick={resetMomentComposer}
                style={{ border: "none", background: "none", padding: 0, color: "var(--muted)", fontSize: "0.92rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomMoment}
                style={{ border: "none", background: "none", padding: 0, color: "var(--ink)", fontSize: "0.95rem", fontWeight: 700 }}
              >
                Save date
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MomentDatePicker
        isOpen={isCustomDatePickerOpen}
        title="Important date"
        mode="custom"
        monthDay={customDraftMonthDay}
        setMonthDay={setCustomDraftMonthDay}
        year={customDraftYear}
        setYear={setCustomDraftYear}
        yearHelperText="Add the year only if it helps."
        onSave={() => {
          const iso = buildMomentIso(customDraftMonthDay, customDraftYear, false);
          if (!iso) return;
          setCustomMomentDate(iso);
          setIsCustomDatePickerOpen(false);
        }}
        onCancel={() => setIsCustomDatePickerOpen(false)}
        onClear={() => {
          setCustomDraftMonthDay("");
          setCustomDraftYear("");
          setCustomMomentDate("");
        }}
      />

      {isPhoneEditorOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Phone number"
          onClick={() => setIsPhoneEditorOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10, 14, 20, 0.22)",
            display: "grid",
            placeItems: "center",
            padding: "1.25rem",
            zIndex: 80,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "520px",
              borderRadius: "26px",
              border: "1px solid rgba(10, 27, 42, 0.08)",
              background: "rgba(255,255,255,0.98)",
              boxShadow: "0 24px 60px rgba(20, 16, 10, 0.16)",
              padding: "1.2rem",
              display: "grid",
              gap: "0.8rem",
            }}
          >
            <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>Make reaching out easier</div>
            <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
              If you'd like to text {resolvedPerson.name.trim()} directly from reminders, add a phone number.
            </div>
            <input
              type="tel"
              value={phoneDraft}
              onChange={(e) => {
                setPhoneDraft(e.target.value);
                if (!e.target.value.trim()) setPhoneDraftError(false);
                else if (normalizePhone(e.target.value)) setPhoneDraftError(false);
              }}
              placeholder="Phone number"
              style={{
                width: "100%",
                padding: "0.95rem 1rem",
                borderRadius: "16px",
                border: "1px solid rgba(10, 27, 42, 0.1)",
                background: "rgba(255,255,255,0.95)",
              }}
            />
            {phoneDraftError ? <div style={{ color: "#b42318", fontSize: "0.86rem" }}>Enter a valid phone number.</div> : null}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <button
                type="button"
                onClick={() => setIsPhoneEditorOpen(false)}
                style={{ border: "none", background: "none", padding: 0, color: "var(--muted)", fontSize: "0.92rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePhone}
                style={{ border: "none", background: "none", padding: 0, color: "var(--ink)", fontSize: "0.95rem", fontWeight: 700 }}
              >
                Save number
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddConnectionOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add connection"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 18, 24, 0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-end",
            padding: "12px",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            zIndex: 55,
          }}
          onMouseDown={(e) => {
            if (e.target !== e.currentTarget) return;
            setIsAddConnectionOpen(false);
            resetConnectionDraft();
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "720px",
              maxHeight: "calc(100dvh - 24px)",
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div className="modalContent" style={{ fontFamily: "var(--font-sans)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}>
                  {editingConnection ? "Edit connection" : "Add someone connected"}
                </div>
                <button
                  onClick={() => {
                    setIsAddConnectionOpen(false);
                    resetConnectionDraft();
                  }}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    color: "var(--muted)",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  Cancel
                </button>
              </div>

              <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Connection</div>
                  <select
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value as typeof connectionType)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "12px",
                      border: "1px solid var(--border-strong)",
                      background: "var(--card)",
                      color: "var(--ink)",
                      fontSize: "1rem",
                      marginTop: "6px",
                    }}
                  >
                    <option value="partner" disabled={Boolean(person.partnerId && person.partnerId !== editingConnection?.person.id)}>
                      Partner
                    </option>
                    <option value="child">Child</option>
                    <option value="grandchild">Grandchild</option>
                    <option value="familyMember">Someone important</option>
                  </select>
                </div>

                {editingConnection ? (
                  <>
                    <div>
                      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Name</div>
                      <input
                        value={connectionName}
                        onChange={(e) => setConnectionName(e.target.value)}
                        placeholder="Name"
                        style={{
                          width: "100%",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                          fontSize: "1rem",
                          marginTop: "6px",
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Phone (optional)</div>
                      <input
                        type="tel"
                        value={connectionPhone}
                        onChange={(e) => {
                          const next = e.target.value;
                          setConnectionPhone(next);
                          if (!next.trim()) setConnectionPhoneError(false);
                          else if (normalizePhone(next)) setConnectionPhoneError(false);
                        }}
                        placeholder="Phone"
                        style={{
                          width: "100%",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                          fontSize: "1rem",
                          marginTop: "6px",
                        }}
                      />
                      {connectionPhoneError ? (
                        <div style={{ marginTop: "6px", color: "#b42318", fontSize: "0.85rem" }}>
                          Enter a valid phone number.
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => setIsConnectionBirthdayOpen(true)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        width: "100%",
                        padding: "0.85rem 0.95rem",
                        borderRadius: "12px",
                        border: "1px solid var(--border-strong)",
                        background: "var(--card)",
                        cursor: "pointer",
                        color: "var(--ink)",
                        fontSize: "0.98rem",
                        textAlign: "left",
                      }}
                    >
                      <span>Birthday (optional)</span>
                      <span style={{ color: "var(--muted)" }}>
                        {buildMomentIso(connectionBirthdayMonthDay, connectionBirthdayYear, false)
                          ? formatMonthDay(
                              buildMomentIso(connectionBirthdayMonthDay, connectionBirthdayYear, false)
                                .split("-")
                                .slice(1)
                                .join("-"),
                              monthDayFormatter
                            )
                          : "Select date"}
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    {connectionType === "child" ? (
                      <button
                        onClick={openAddChildEditor}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--ink)",
                          textDecoration: "underline",
                          textUnderlineOffset: "3px",
                          fontSize: "0.95rem",
                          justifySelf: "start",
                        }}
                      >
                        Create a new child
                      </button>
                    ) : null}

                    <div>
                      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Choose someone already in your circle</div>
                      <input
                        value={connectionSearch}
                        onChange={(e) => setConnectionSearch(e.target.value)}
                        placeholder="Search your circle"
                        autoFocus
                        style={{
                          width: "100%",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                          fontSize: "1rem",
                          marginTop: "6px",
                        }}
                      />
                    </div>

                    {selectedConnection ? (
                      <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>
                        Selected: <span style={{ color: "var(--ink)", fontWeight: 500 }}>{selectedConnection.name}</span>
                      </div>
                    ) : null}

                    <ContactsSearchResults
                      results={filteredConnectionResults}
                      onSelect={(selectedPerson) => {
                        setSelectedConnectionId(selectedPerson.id);
                        setConnectionSearch(selectedPerson.name);
                      }}
                    />
                  </>
                )}

                <button
                  onClick={saveConnection}
                  disabled={editingConnection ? !connectionName.trim() : !selectedConnectionId}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color:
                      editingConnection
                        ? connectionName.trim()
                          ? "var(--ink)"
                          : "var(--muted)"
                        : selectedConnectionId
                          ? "var(--ink)"
                          : "var(--muted)",
                    cursor:
                      editingConnection
                        ? connectionName.trim()
                          ? "pointer"
                          : "default"
                        : selectedConnectionId
                          ? "pointer"
                          : "default",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.85rem 1.1rem",
                    fontSize: "0.98rem",
                    boxShadow: "none",
                  }}
                >
                  {editingConnection ? "Save connection" : "Add to the page"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isConnectionBirthdayOpen ? (
        <MomentDatePicker
          isOpen
          title="Connection birthday"
          mode="birthday"
          monthDay={connectionBirthdayMonthDay}
          setMonthDay={setConnectionBirthdayMonthDay}
          year={connectionBirthdayYear}
          setYear={setConnectionBirthdayYear}
          yearHelperText=""
          onSave={() => setIsConnectionBirthdayOpen(false)}
          onCancel={() => setIsConnectionBirthdayOpen(false)}
          onClear={() => {
            setConnectionBirthdayMonthDay("");
            setConnectionBirthdayYear("");
          }}
        />
      ) : null}

      <PersonEditDrawer
        isOpen={isEditOpen}
        person={person}
        initialChildId={initialChildId}
        startWithNewChild={startWithNewChild}
        onClose={() => {
          setIsEditOpen(false);
          setInitialChildId(null);
          setStartWithNewChild(false);
        }}
        onSave={(updated) => {
          updatePerson(updated);
          setInitialChildId(null);
          setStartWithNewChild(false);
        }}
      />
    </div>
  );
}
