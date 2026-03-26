import { useEffect, useMemo, useState } from "react";
import type { CareEvent } from "../models/CareEvent";
import type { Person } from "../models/Person";
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

type EditableConnection = {
  person: Person;
  type: Relationship["type"];
  relationshipId: string | null;
};

export default function PersonDetail({}: {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { people, relationships, careEvents, updatePerson, upsertRelationship, deletePerson } = useAppState();
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

  const birthdayInfo = useMemo(() => {
    const b = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
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
    };
  }, [fullDateFormatter, monthDayFormatter, person.moments, today]);

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
        return { person: otherPerson, type: rel.type, relationshipId: rel.id };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const hasPartnerRelationship = items.some(
      (item) => item.type === "partner" && item.person.id === person.partnerId
    );
    if (person.partnerId && !hasPartnerRelationship) {
      const partner = people.find((candidate) => candidate.id === person.partnerId) ?? null;
      if (partner) {
        items.push({ person: partner, type: "partner", relationshipId: null });
      }
    }

    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.type}:${item.person.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const relationshipOrder: Array<Relationship["type"]> = ["partner", "child", "parent", "sibling", "friend", "other"];

  const groupedRelatedPeople = relationshipOrder
    .map((type) => ({
      type,
      items: relatedPeople
        .filter((item) => item.type === type)
        .sort((a, b) => a.person.name.localeCompare(b.person.name)),
    }))
    .filter((group) => group.items.length > 0);

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
    const events: Array<{ id: string; personName: string; label: string; targetDate: Date }> = [];

    const addRecurringEvent = (id: string, label: string, isoDate: string | undefined) => {
      if (!isoDate) return;
      const next = getNextBirthdayFromIso(isoDate, today);
      if (!next || next.target < today) return;
      events.push({
        id,
        personName: resolvedPerson.name,
        label,
        targetDate: next.target,
      });
    };

    const addOneTimeOrRecurringMoment = (momentId: string, label: string, isoDate: string, recurring: boolean) => {
      if (!isoDate) return;
      if (recurring) {
        addRecurringEvent(momentId, label, isoDate);
        return;
      }
      const parsed = parseLocalDate(isoDate);
      if (!parsed || parsed < today) return;
      events.push({
        id: momentId,
        personName: resolvedPerson.name,
        label,
        targetDate: parsed,
      });
    };

    const birthdayMoment = (resolvedPerson.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
    addRecurringEvent(
      `${resolvedPerson.id}:birthday`,
      "Birthday",
      birthdayMoment?.date
    );

    const anniversaryMoment = (resolvedPerson.moments ?? []).find((moment) => moment.type === "anniversary") ?? null;
    const anniversaryIso = anniversaryMoment?.date
      ? anniversaryMoment.date
      : resolvedPerson.anniversary
        ? `0000-${resolvedPerson.anniversary}`
        : undefined;
    addRecurringEvent(`${resolvedPerson.id}:anniversary`, "Anniversary", anniversaryIso);

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

    for (const moment of resolvedPerson.importantDates ?? []) {
      if (moment.type !== "custom") continue;
      addOneTimeOrRecurringMoment(`important:${moment.id}`, moment.label, moment.date, moment.recurring);
    }

    for (const moment of resolvedPerson.sensitiveMoments ?? []) {
      if (moment.type !== "custom") continue;
      addOneTimeOrRecurringMoment(`sensitive:${moment.id}`, moment.label, moment.date, moment.recurring);
    }

    return events
      .sort((a, b) => {
        if (a.targetDate.getTime() !== b.targetDate.getTime()) {
          return a.targetDate.getTime() - b.targetDate.getTime();
        }
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
      });
  }, [
    resolvedPerson.anniversary,
    resolvedPerson.children,
    resolvedPerson.id,
    resolvedPerson.importantDates,
    resolvedPerson.moments,
    resolvedPerson.name,
    resolvedPerson.sensitiveMoments,
    today,
  ]);

  const careHistory = useMemo(() => {
    return [...careEvents]
      .filter((event) => event.personId === person.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [careEvents, person.id]);

  const children = useMemo(() => {
    return [...(person.children ?? [])].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
    );
  }, [person.children]);

  const selectedHolidays = getSelectedHolidays(person);

  function formatRelationshipType(type: Relationship["type"]) {
    if (type === "other") return "Family member";
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

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

  function openAddConnection() {
    resetConnectionDraft();
    setIsAddConnectionOpen(true);
  }

  function openEditConnection(connection: EditableConnection) {
    const birthdayMoment = (connection.person.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
    const draft = connectionDraftFromIso(birthdayMoment?.date);
    setEditingConnection(connection);
    setConnectionType(connection.type === "partner" || connection.type === "child" ? connection.type : "familyMember");
    setConnectionName(connection.person.name ?? "");
    setConnectionPhone(connection.person.phone ?? "");
    setConnectionPhoneError(false);
    setConnectionBirthdayMonthDay(draft.monthDay);
    setConnectionBirthdayYear(draft.year);
    setIsConnectionBirthdayOpen(false);
    setConnectionSearch("");
    setSelectedConnectionId(connection.person.id);
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
        const birthdayMoment = {
          id: existingBirthdayIndex >= 0 ? existingMoments[existingBirthdayIndex].id : makeId(),
          type: "birthday" as const,
          label: "Birthday",
          date: birthdayIso,
          recurring: true,
        };
        if (existingBirthdayIndex >= 0) existingMoments[existingBirthdayIndex] = birthdayMoment;
        else existingMoments.unshift(birthdayMoment);
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

    if (people.some((candidate) => candidate.id === selectedConnection.id) === false) return;
    if (relatedPeople.some((item) => item.person.id === selectedConnection.id)) {
      setIsAddConnectionOpen(false);
      resetConnectionDraft();
      return;
    }

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

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "env(safe-area-inset-top) var(--space-16) var(--space-16)",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto", paddingTop: "32px" }}>
          <div style={{ marginBottom: "1.75rem", display: "flex", justifyContent: "space-between" }}>
            <button
              onClick={navigateBack}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                padding: 0,
              }}
            >
              ← Back
            </button>
            <button
              onClick={openPersonEditor}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                padding: 0,
              }}
            >
              Edit
            </button>
          </div>

          <div style={{ maxWidth: "560px", margin: "0 auto" }}>
            <section aria-label="Header">
              <div
                style={{
                  width: "100%",
                  background: "var(--paper)",
                  borderRadius: "16px",
                  padding: "16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "30px",
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    color: "var(--ink)",
                  }}
                >
                  {person.name.trim()}
                </div>
                {person.phone ? (
                  <div style={{ marginTop: "10px", color: "var(--muted)", lineHeight: 1.5, fontSize: "16px" }}>
                    {person.phone}
                  </div>
                ) : null}
              </div>
            </section>

            <section aria-label="Important dates" style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>Important dates</div>

              <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Birthday</div>
                  <div style={{ marginTop: "4px", color: "var(--ink)", fontSize: "1rem" }}>
                    {birthdayInfo?.formattedDate ?? "Add date"}
                  </div>
                  {birthdayInfo?.age !== undefined ? (
                    <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "0.95rem" }}>
                      {birthdayInfo.isToday ? `Turns ${birthdayInfo.age} today 🎂` : `Age ${birthdayInfo.age}`}
                    </div>
                  ) : null}
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Anniversary</div>
                  <div style={{ marginTop: "4px", color: "var(--ink)", fontSize: "1rem" }}>
                    {anniversaryDisplay ?? "Add date"}
                  </div>
                </div>

                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Other important dates</div>
                  {otherMoments.length ? (
                    <div style={{ marginTop: "8px", display: "grid", gap: "8px" }}>
                      {otherMoments.map((moment) => (
                        <div key={moment.id} style={{ color: "var(--ink)" }}>
                          <div>{moment.label}</div>
                          <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginTop: "2px" }}>
                            {parseIsoDate(moment.date)
                              ? Number(moment.date.split("-")[0] ?? 0) > 0
                                ? fullDateFormatter.format(parseIsoDate(moment.date) as Date)
                                : monthDayFormatter.format(parseIsoDate(moment.date) as Date)
                              : moment.date}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <button
                    onClick={openPersonEditor}
                    style={{
                      marginTop: "10px",
                      padding: 0,
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      color: "var(--ink)",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                      fontSize: "0.95rem",
                    }}
                  >
                    Add moment
                  </button>
                </div>
              </div>
            </section>

            <section aria-label="Children" style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>Children</div>

              {children.length ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                  {children.map((child) => {
                    const birthday = formatBirthday(
                      child.birthday ?? child.birthdate ?? undefined,
                      monthDayFormatter,
                      fullDateFormatter
                    );

                    return (
                      <button
                        key={child.id}
                        onClick={() => openChildEditor(child.id)}
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: "14px",
                          background: "rgba(255,255,255,0.6)",
                          padding: "16px",
                          textAlign: "left",
                          cursor: "pointer",
                          color: "var(--ink)",
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{child.name?.trim() || "Unnamed child"}</div>
                        <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "0.95rem" }}>
                          {birthday || "Add date"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: "16px", color: "var(--muted)", lineHeight: 1.6 }}>
                  No children added yet.
                </div>
              )}

              <button
                onClick={openAddChildEditor}
                style={{
                  marginTop: "16px",
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--ink)",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  fontSize: "0.95rem",
                }}
              >
                + Add child
              </button>
            </section>

            <section aria-label="Connections" style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>
                Connections
              </div>

              {groupedRelatedPeople.length ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                  {groupedRelatedPeople.map((group) => (
                    <div key={group.type}>
                      <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {formatRelationshipType(group.type)}
                      </div>
                      <div style={{ display: "grid", gap: "12px" }}>
                        {group.items.map((item) => (
                          <button
                            key={item.person.id}
                            onClick={() => openEditConnection(item)}
                            style={{
                              border: "1px solid var(--border)",
                              borderRadius: "14px",
                              background: "rgba(255,255,255,0.6)",
                              padding: "12px 14px",
                              textAlign: "left",
                              cursor: "pointer",
                              color: "var(--ink)",
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>{item.person.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: "16px", color: "var(--muted)", lineHeight: 1.6 }}>
                  No connections yet — link someone to unlock shared reminders
                </div>
              )}

              <button
                onClick={openAddConnection}
                style={{
                  marginTop: "16px",
                  width: "100%",
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--ink)",
                  cursor: "pointer",
                  textAlign: "center",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                  borderRadius: "12px",
                  padding: "0.8rem 1rem",
                  fontSize: "0.95rem",
                }}
              >
                Link a person
              </button>
            </section>

            <section aria-label="Family timeline" style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>Family Timeline</div>

              {familyTimeline.length ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                  {familyTimeline.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        display: "grid",
                        gap: "4px",
                        padding: "16px",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.6)",
                      }}
                    >
                      <div style={{ color: "var(--ink)", fontSize: "0.98rem" }}>
                        {event.personName} — {event.label}{" "}
                        {monthDayFormatter.format(event.targetDate)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: "16px", color: "var(--muted)", lineHeight: 1.6 }}>
                  No upcoming family moments.
                </div>
              )}
            </section>

            <section aria-label="Details" style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>Details</div>
              <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                <div>
                  <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "8px" }}>Important Holidays</div>
                  {selectedHolidays.length ? (
                    <div style={{ display: "grid", gap: "0.6rem" }}>
                      {selectedHolidays.map((holidayId) => (
                        <label
                          key={holidayId}
                          style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "var(--ink)" }}
                        >
                          <input type="checkbox" checked readOnly />
                          {holidayOptionLabel(holidayId)}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>No holidays selected.</div>
                  )}
                </div>
              </div>
            </section>

            <section aria-label="Care history" style={{ marginTop: "32px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>Care History</div>

              {careHistory.length ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
                  {careHistory.map((event) => (
                    <div
                      key={event.id}
                      style={{
                        display: "grid",
                        gap: "4px",
                        padding: "16px",
                        border: "1px solid var(--border)",
                        borderRadius: "14px",
                        background: "rgba(255,255,255,0.6)",
                      }}
                    >
                      <div style={{ color: "var(--ink)", fontSize: "0.98rem" }}>
                        {formatCareEventDate(event.timestamp)} — {describeCareEvent(event)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: "16px", color: "var(--muted)", lineHeight: 1.6 }}>
                  No interactions recorded yet.
                </div>
              )}
            </section>

            <div
              style={{
                marginTop: "34px",
                paddingTop: "18px",
                paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
                borderTop: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm(
                    "Are you sure you want to delete this contact?\nThis cannot be undone."
                  );
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
                  fontFamily: "var(--font-sans)",
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
      </div>

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
                  {editingConnection ? "Edit connection" : "Link a person"}
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
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Relationship type</div>
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
                    <option
                      value="partner"
                      disabled={Boolean(person.partnerId && person.partnerId !== editingConnection?.person.id)}
                    >
                      Partner
                    </option>
                    <option value="child">Child</option>
                    <option value="grandchild">Grandchild</option>
                    <option value="familyMember">Family member</option>
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
                              buildMomentIso(connectionBirthdayMonthDay, connectionBirthdayYear, false).split("-").slice(1).join("-"),
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
                        + Create new child
                      </button>
                    ) : null}

                    <div>
                      <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Choose a contact</div>
                      <input
                        value={connectionSearch}
                        onChange={(e) => setConnectionSearch(e.target.value)}
                        placeholder="Search existing contacts"
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
                    color: editingConnection ? (connectionName.trim() ? "var(--ink)" : "var(--muted)") : selectedConnectionId ? "var(--ink)" : "var(--muted)",
                    cursor: editingConnection ? (connectionName.trim() ? "pointer" : "default") : selectedConnectionId ? "pointer" : "default",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.85rem 1.1rem",
                    fontSize: "0.98rem",
                    boxShadow: "none",
                  }}
                >
                  {editingConnection ? "Save connection" : "Link contact"}
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
