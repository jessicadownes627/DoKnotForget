import { useEffect, useMemo, useState } from "react";
import type { CareEvent } from "../models/CareEvent";
import type { Moment, Person } from "../models/Person";
import type { Relationship } from "../models/Relationship";
import MomentDatePicker from "../components/MomentDatePicker";
import { useAppState } from "../appState";
import { useLocation, useNavigate, useParams } from "../router";
import { getNextBirthdayFromIso } from "../utils/birthdayUtils";
import { parseLocalDate } from "../utils/date";
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
  | { kind: "birthday" }
  | { kind: "anniversary" }
  | { kind: "custom"; momentId: string | null };

function SurfaceCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      className="dkf-enter"
      style={{
        borderRadius: "26px",
        border: "1px solid rgba(28, 28, 30, 0.06)",
        background: "rgba(255,255,255,0.94)",
        boxShadow: "0 12px 28px rgba(28, 28, 30, 0.045)",
        padding: "1.05rem",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function RowChevron() {
  return (
    <span aria-hidden="true" style={{ color: "rgba(28, 28, 30, 0.36)", fontSize: "1rem", lineHeight: 1 }}>
      ›
    </span>
  );
}

export default function PersonDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { people, relationships, careEvents, updatePerson, updatePersonFields, deletePerson } =
    useAppState();
  const person = people.find((p) => p.id === id) ?? null;
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
  const [phoneEditorMode, setPhoneEditorMode] = useState<"direct" | "separate">("direct");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneDraftError, setPhoneDraftError] = useState(false);
  const [isConnectPersonOpen, setIsConnectPersonOpen] = useState(false);
  const [contactChoiceTarget, setContactChoiceTarget] = useState<Person | null>(null);
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

  function navigateBack() {
    if (returnToImportReview) {
      navigate("/import", { state: { reviewImportedIds } });
      return;
    }
    navigate("/home", { state: { defaultTab: "contacts" } });
  }

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

  const careRecipient = useMemo(
    () =>
      resolvedPerson.careRecipientId
        ? people.find((candidate) => candidate.id === resolvedPerson.careRecipientId) ?? null
        : null,
    [people, resolvedPerson.careRecipientId]
  );

  const availableConnectionTargets = useMemo(() => {
    const excludedIds = new Set<string>([resolvedPerson.id, ...relatedPeople.map((item) => item.person.id)]);
    return people
      .filter((candidate) => !excludedIds.has(candidate.id) && candidate.name.trim())
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [people, relatedPeople, resolvedPerson.id]);

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

  const careHistory = useMemo(() => {
    const grouped = new Map<string, CareEvent>();

    [...careEvents]
      .filter((event) => event.personId === person.id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .forEach((event) => {
        const day = event.timestamp.slice(0, 10);
        const key = `${day}:${careEventContext(event)}`;
        const existing = grouped.get(key);
        if (!existing || careEventPriority(event) > careEventPriority(existing)) {
          grouped.set(key, event);
        }
      });

    return Array.from(grouped.values())
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

  function careEventContext(event: CareEvent) {
    const note = (event.note ?? "").toLowerCase();
    if (note.includes("birthday")) return "birthday";
    if (note.includes("anniversary")) return "anniversary";
    return "general";
  }

  function careEventPriority(event: CareEvent) {
    if (event.type === "text") return 5;
    if (event.type === "ecard") return 4;
    if (event.type === "gift") return 3;
    if (event.type === "coffee") return 2;
    return 1;
  }

  function recentCareTitle(event: CareEvent) {
    const personName = resolvedPerson.name.trim() || "them";
    const date = formatCareEventDate(event.timestamp);
    const context = careEventContext(event);

    if (context === "birthday") return `${date} · ${possessive(personName)} birthday`;
    if (context === "anniversary") return `${date} · Anniversary`;
    return `${date} · ${personName}`;
  }

  function recentCareDetail(event: CareEvent) {
    const personName = resolvedPerson.name.trim() || "them";
    if (event.type === "text") return "You reached out";
    if (event.type === "ecard") return "Sent an eCard";
    if (event.type === "gift") return "Sent a gift";
    if (event.type === "coffee") return "Sent a little treat";
    if (careEventContext(event) === "birthday" || careEventContext(event) === "anniversary") {
      return `You showed up for ${personName}`;
    }
    return "You showed up";
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

  function openPhoneEditor() {
    setPhoneDraft(resolvedPerson.phone ?? "");
    setPhoneDraftError(false);
    setPhoneEditorMode("direct");
    setIsPhoneEditorOpen(true);
  }

  function openAddConnectedPerson() {
    setIsConnectPersonOpen(true);
  }

  function connectExistingPerson(target: Person) {
    setIsConnectPersonOpen(false);
    if (target.phone) {
      setContactChoiceTarget(target);
      return;
    }
    updatePersonFields(resolvedPerson.id, { careRecipientId: target.id });
  }

  function useConnectedPersonNumber() {
    if (!contactChoiceTarget) return;
    updatePersonFields(resolvedPerson.id, { careRecipientId: contactChoiceTarget.id });
    setContactChoiceTarget(null);
  }

  function addSeparatePhoneNumber() {
    setContactChoiceTarget(null);
    setPhoneDraft(resolvedPerson.phone ?? "");
    setPhoneDraftError(false);
    setPhoneEditorMode("separate");
    setIsPhoneEditorOpen(true);
  }

  function openCreateConnectedPerson() {
    setIsConnectPersonOpen(false);
    navigate("/add", {
      state: {
        connectedToPersonId: resolvedPerson.id,
        connectedToPersonName: resolvedPerson.name.trim(),
      },
    });
  }

  function savePhone() {
    const normalizedPhone = phoneDraft.trim() ? normalizePhone(phoneDraft) : null;
    if (phoneDraft.trim() && !normalizedPhone) {
      setPhoneDraftError(true);
      return;
    }
    updatePersonFields(resolvedPerson.id, {
      phone: normalizedPhone || undefined,
    });
    setIsPhoneEditorOpen(false);
    setPhoneEditorMode("direct");
  }

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
              gap: "1rem",
            }}
          >
            <button
              type="button"
              onClick={navigateBack}
              style={{
                border: "none",
                background: "none",
                color: "var(--muted)",
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "1rem", lineHeight: 1 }}>
                ←
              </span>
              Back
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
                  background: "linear-gradient(145deg, rgba(248,244,237,0.98), rgba(239,232,221,0.98))",
                  border: "1px solid rgba(28, 28, 30, 0.06)",
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
                    fontSize: "1.86rem",
                    lineHeight: 1.02,
                    letterSpacing: "-0.028em",
                  }}
                >
                  {resolvedPerson.name.trim()}
                </div>
                <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.95rem" }}>
                  {portraitSubtitle}
                </div>
                {careRecipient ? (
                  <div style={{ marginTop: "0.35rem", color: "rgba(28, 28, 30, 0.62)", fontSize: "0.88rem" }}>
                    <span>{`Messages for ${resolvedPerson.name.trim()} will go to `}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/person/${careRecipient.id}`)}
                      style={{
                        border: "none",
                        background: "none",
                        padding: 0,
                        margin: 0,
                        color: "var(--ink)",
                        fontSize: "inherit",
                        fontWeight: 600,
                        fontFamily: "inherit",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        cursor: "pointer",
                      }}
                    >
                      {careRecipient.name}
                    </button>
                    <span>{`'s phone.`}</span>
                  </div>
                ) : null}
              </div>
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
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
              <button
                type="button"
                onClick={openPhoneEditor}
                style={{
                  border: "1px solid rgba(28, 28, 30, 0.07)",
                  background: "rgba(255,255,255,0.98)",
                  borderRadius: "18px",
                  padding: "0.95rem 1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>Phone number</div>
                  <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                    {resolvedPerson.phone
                      ? `${resolvedPerson.phone} · ready for quick texting from reminders`
                      : "Add a number if you'd like to text directly from reminders"}
                  </div>
                </div>
                <RowChevron />
              </button>

              {selectedHolidays.length ? (
                <div
                  style={{
                    border: "1px solid rgba(28, 28, 30, 0.07)",
                    background: "rgba(255,255,255,0.98)",
                    borderRadius: "18px",
                    padding: "0.95rem 1rem",
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Holidays that matter</div>
                  <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                    {selectedHolidays.map((holidayId) => (
                      <span
                        key={holidayId}
                        style={{
                          borderRadius: "999px",
                          background: "rgba(246, 243, 238, 0.98)",
                          border: "1px solid rgba(28, 28, 30, 0.06)",
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
                    border: "1px solid rgba(28, 28, 30, 0.07)",
                    background: "rgba(255,255,255,0.98)",
                    borderRadius: "18px",
                    padding: "0.95rem 1rem",
                    color: "var(--ink)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>Recent care</div>
                  <div style={{ marginTop: "0.7rem", display: "grid", gap: "0.6rem" }}>
                    {careHistory.map((event) => (
                      <div key={event.id} style={{ display: "grid", gap: "0.18rem" }}>
                        <div style={{ color: "var(--ink)", fontSize: "0.92rem", fontWeight: 600 }}>
                          {recentCareTitle(event)}
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
                          {recentCareDetail(event)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
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
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
              <button
                type="button"
                onClick={openBirthdayEditor}
                style={{
                  border: "1px solid rgba(28, 28, 30, 0.07)",
                  background: "rgba(255,255,255,0.98)",
                  borderRadius: "18px",
                  padding: "0.95rem 1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{possessive(resolvedPerson.name)} birthday</div>
                  <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                    {birthdayInfo
                      ? birthdayInfo.isToday
                        ? `${birthdayInfo.formattedDate} · today`
                        : `${birthdayInfo.formattedDate} · in ${birthdayInfo.daysUntil} days`
                      : "Add a date"}
                  </div>
                </div>
                <RowChevron />
              </button>

              <button
                type="button"
                onClick={openAnniversaryEditor}
                style={{
                  border: "1px solid rgba(28, 28, 30, 0.07)",
                  background: "rgba(255,255,255,0.98)",
                  borderRadius: "18px",
                  padding: "0.95rem 1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>Anniversary</div>
                  <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                    {anniversaryDisplay ?? "Add a date"}
                  </div>
                </div>
                <RowChevron />
              </button>

              {otherMoments.map((moment) => (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => openCustomMomentEditor(moment)}
                  style={{
                    border: "1px solid rgba(28, 28, 30, 0.07)",
                    background: "rgba(255,255,255,0.98)",
                    borderRadius: "18px",
                    padding: "0.95rem 1rem",
                    textAlign: "left",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{moment.label}</div>
                    <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                      {parseIsoDate(moment.date)
                        ? Number(moment.date.split("-")[0] ?? 0) > 0
                          ? fullDateFormatter.format(parseIsoDate(moment.date) as Date)
                          : monthDayFormatter.format(parseIsoDate(moment.date) as Date)
                        : moment.date}
                    </div>
                  </div>
                  <RowChevron />
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
                onClick={openAddConnectedPerson}
                style={{ border: "none", background: "none", color: "var(--ink)", padding: 0, fontWeight: 600 }}
              >
                Add
              </button>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.85rem" }}>
              {children.map((child) => {
                const birthday = formatBirthday(child.birthday ?? child.birthdate ?? undefined, monthDayFormatter, fullDateFormatter);
                return (
                  <div
                    key={child.id}
                    style={{
                      border: "1px solid rgba(28, 28, 30, 0.07)",
                      background: "rgba(255,255,255,0.98)",
                      borderRadius: "18px",
                      padding: "0.95rem 1rem",
                      color: "var(--ink)",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{child.name?.trim() || "Unnamed child"}</div>
                    <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                      {birthday ? `Birthday: ${birthday}` : "Child in your circle"}
                    </div>
                  </div>
                );
              })}

              {groupedRelatedPeople.map((group) =>
                group.items.map((item) => (
                  <button
                    key={`${group.type}-${item.person.id}`}
                    type="button"
                    onClick={() => navigate(`/person/${item.person.id}`)}
                    style={{
                      border: "1px solid rgba(28, 28, 30, 0.07)",
                      background: "rgba(255,255,255,0.98)",
                      borderRadius: "18px",
                      padding: "0.95rem 1rem",
                      textAlign: "left",
                      color: "var(--ink)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{item.person.name}</div>
                      <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                        {formatRelationshipType(group.type)}
                      </div>
                    </div>
                    <RowChevron />
                  </button>
                ))
              )}

              {careRecipient && !relatedPeople.some((item) => item.person.id === careRecipient.id) ? (
                <button
                  type="button"
                  onClick={() => navigate(`/person/${careRecipient.id}`)}
                  style={{
                    border: "1px solid rgba(28, 28, 30, 0.07)",
                    background: "rgba(255,255,255,0.98)",
                    borderRadius: "18px",
                    padding: "0.95rem 1rem",
                    textAlign: "left",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{careRecipient.name}</div>
                    <div style={{ marginTop: "0.28rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                      Primary contact for reminders
                    </div>
                  </div>
                  <RowChevron />
                </button>
              ) : null}

              {!children.length && groupedRelatedPeople.length === 0 && !careRecipient ? (
                <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>No one else is connected yet.</div>
              ) : null}
            </div>
          </SurfaceCard>

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

      <MomentDatePicker
        isOpen={momentComposer.kind === "birthday"}
        title={`${possessive(resolvedPerson.name)} birthday`}
        mode="birthday"
        monthDay={birthdayDraftMonthDay}
        setMonthDay={setBirthdayDraftMonthDay}
        year={birthdayDraftYear}
        setYear={setBirthdayDraftYear}
        yearHelperText="The year helps with milestone birthdays and age-based reminders."
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
                {customMomentDate ? formatBirthday(customMomentDate, monthDayFormatter, fullDateFormatter) : "Month, day, year"}
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
        yearHelperText="Add the year if you know it."
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
          onClick={() => {
            setIsPhoneEditorOpen(false);
            setPhoneEditorMode("direct");
          }}
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
            <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>
              {phoneEditorMode === "separate" ? `Add a different number for ${resolvedPerson.name.trim()}` : "Make reaching out easier"}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
              {phoneEditorMode === "separate"
                ? `Use a separate number for ${resolvedPerson.name.trim()} instead of routing reminders through someone else.`
                : `If you'd like to text ${resolvedPerson.name.trim()} directly from reminders, add a phone number.`}
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
                onClick={() => {
                  setIsPhoneEditorOpen(false);
                  setPhoneEditorMode("direct");
                }}
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

      {contactChoiceTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Use ${contactChoiceTarget.name.trim()} as contact`}
          onClick={() => setContactChoiceTarget(null)}
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
              gap: "0.9rem",
            }}
          >
            <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>
              {`Use ${contactChoiceTarget.name.trim()}'s number when reaching out about ${resolvedPerson.name.trim()}?`}
            </div>
            <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
              {`${contactChoiceTarget.name.trim()} can be the contact point for reminders about ${resolvedPerson.name.trim()} without copying their number.`}
            </div>

            <div style={{ display: "grid", gap: "0.7rem" }}>
              <button
                type="button"
                onClick={useConnectedPersonNumber}
                style={{
                  border: "1px solid rgba(28, 28, 30, 0.07)",
                  background: "rgba(255,255,255,0.98)",
                  borderRadius: "18px",
                  padding: "0.95rem 1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {`Text ${contactChoiceTarget.name.trim()} for ${resolvedPerson.name.trim()}`}
                </div>
                <RowChevron />
              </button>

              <button
                type="button"
                onClick={addSeparatePhoneNumber}
                style={{
                  border: "1px solid rgba(28, 28, 30, 0.07)",
                  background: "rgba(255,255,255,0.98)",
                  borderRadius: "18px",
                  padding: "0.95rem 1rem",
                  textAlign: "left",
                  color: "var(--ink)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                }}
              >
                <div style={{ fontWeight: 600 }}>{`${resolvedPerson.name.trim()} has their own number`}</div>
                <RowChevron />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <button
                type="button"
                onClick={() => setContactChoiceTarget(null)}
                style={{ border: "none", background: "none", padding: 0, color: "var(--muted)", fontSize: "0.92rem" }}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isConnectPersonOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Connect ${resolvedPerson.name.trim()}`}
          onClick={() => setIsConnectPersonOpen(false)}
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
              gap: "0.9rem",
            }}
          >
            <div style={{ fontSize: "1.08rem", fontWeight: 600 }}>Who should you reach out to for {resolvedPerson.name.trim()}?</div>
            <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
              Pick someone you've already added, or add someone new if they aren't here yet.
            </div>

            <div style={{ display: "grid", gap: "0.7rem", maxHeight: "320px", overflowY: "auto" }}>
              {availableConnectionTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => connectExistingPerson(target)}
                  style={{
                    border: "1px solid rgba(28, 28, 30, 0.07)",
                    background: "rgba(255,255,255,0.98)",
                    borderRadius: "18px",
                    padding: "0.95rem 1rem",
                    textAlign: "left",
                    color: "var(--ink)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    boxShadow: "0 6px 18px rgba(28, 28, 30, 0.03)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{target.name}</div>
                  <RowChevron />
                </button>
              ))}
              {!availableConnectionTargets.length ? (
                <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>No one else is in your circle yet.</div>
              ) : null}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem" }}>
              <button
                type="button"
                onClick={() => setIsConnectPersonOpen(false)}
                style={{ border: "none", background: "none", padding: 0, color: "var(--muted)", fontSize: "0.92rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={openCreateConnectedPerson}
                style={{ border: "none", background: "none", padding: 0, color: "var(--ink)", fontSize: "0.95rem", fontWeight: 700 }}
              >
                Someone else
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
