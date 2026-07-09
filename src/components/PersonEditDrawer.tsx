import { useEffect, useMemo, useState } from "react";
import type { Moment, Person } from "../models/Person";
import MomentDatePicker from "./MomentDatePicker";
import { normalizePhone } from "../utils/phone";
import {
  getSelectedHolidays,
  PERSON_HOLIDAY_OPTIONS,
  toggleHolidaySelection,
} from "../utils/personHolidays";
import { getSuggestedChildNameFromPersonName } from "../utils/personNameSuggestions";

type Props = {
  isOpen: boolean;
  person: Person;
  startWithNewChild?: boolean;
  onClose: () => void;
  onSave: (updated: Person) => void;
  onAddChildren: (updatedParent: Person, children: FamilyChildDraft[]) => void;
};

export type FamilyChildDraft = {
  id: string;
  name: string;
  monthDay: string;
  year: string;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 18, 24, 0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  padding: "16px",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  zIndex: 50,
};

const sheetStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "720px",
  maxHeight: "calc(100dvh - 24px)",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
  display: "flex",
  flexDirection: "column",
};

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

function toDraftFromIso(value: string) {
  const parts = parseYmd(value);
  if (!parts) return { monthDay: "", year: "" };
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  return { monthDay: `2000-${mm}-${dd}`, year: parts.y > 0 ? String(parts.y) : "" };
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

function momentDate(moment: Moment | undefined | null) {
  return moment?.date ?? "";
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const dateWithYearFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function mergeUniqueMoments(moments: Moment[]) {
  const byId = new Map<string, Moment>();
  for (const m of moments) {
    if (!m?.id) continue;
    if (!byId.has(m.id)) byId.set(m.id, m);
  }
  return Array.from(byId.values());
}

function deriveMomentBuckets(person: Person): Person {
  const combined = mergeUniqueMoments([
    ...(person.moments ?? []),
    ...(person.importantDates ?? []),
    ...(person.sensitiveMoments ?? []),
  ]);

  const sensitive = combined.filter((m) => m.type === "custom" && m.category === "sensitive");
  const important = combined.filter((m) => m.type === "custom" && m.category !== "sensitive");

  return {
    ...person,
    moments: combined,
    importantDates: important,
    sensitiveMoments: sensitive,
  };
}

function formatMomentDate(value: string) {
  const parts = parseYmd(value);
  if (!parts) return value;
  const displayYear = parts.y > 0 ? parts.y : 2000;
  const parsed = new Date(displayYear, parts.m - 1, parts.d);
  if (Number.isNaN(parsed.getTime())) return value;
  return parts.y > 0 ? dateWithYearFormatter.format(parsed) : dateFormatter.format(parsed);
}

export default function PersonEditDrawer({
  isOpen,
  person,
  startWithNewChild = false,
  onClose,
  onSave,
  onAddChildren,
}: Props) {
  const birthdayMoment = useMemo(() => person.moments.find((m) => m.type === "birthday") ?? null, [person]);
  const anniversaryMoment = useMemo(
    () => person.moments.find((m) => m.type === "anniversary") ?? null,
    [person]
  );
  const sensitiveMoments = useMemo(
    () => person.moments.filter((m) => m.type === "custom" && m.category === "sensitive"),
    [person]
  );

  const [name, setName] = useState(person.name ?? "");
  const [phone, setPhone] = useState(person.phone ?? "");
  const [phoneError, setPhoneError] = useState(false);
  const [selectedHolidays, setSelectedHolidays] = useState<NonNullable<Person["selectedHolidays"]>>(
    getSelectedHolidays(person)
  );
  const [mothersDayPref, setMothersDayPref] = useState<"" | "include" | "exclude">(
    person.holidayPrefs?.mothersDay === true ? "include" : person.holidayPrefs?.mothersDay === false ? "exclude" : ""
  );
  const [fathersDayPref, setFathersDayPref] = useState<"" | "include" | "exclude">(
    person.holidayPrefs?.fathersDay === true ? "include" : person.holidayPrefs?.fathersDay === false ? "exclude" : ""
  );
  const [familyChildren, setFamilyChildren] = useState<FamilyChildDraft[]>([]);

  const [openBirthday, setOpenBirthday] = useState(false);
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");

  const [openAnniversary, setOpenAnniversary] = useState(false);
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");

  const [childEditingIndex, setChildEditingIndex] = useState<number | null>(null);
  const [childDraftMonthDay, setChildDraftMonthDay] = useState("");
  const [childDraftYear, setChildDraftYear] = useState("");

  const [sensitiveTitle, setSensitiveTitle] = useState("");
  const [sensitiveDate, setSensitiveDate] = useState("");
  const [momentPulseTick, setMomentPulseTick] = useState(0);
  const [sensitiveDraftMonthDay, setSensitiveDraftMonthDay] = useState("");
  const [sensitiveDraftYear, setSensitiveDraftYear] = useState("");
  const [openSensitivePicker, setOpenSensitivePicker] = useState(false);
  const [showAdditionalDates, setShowAdditionalDates] = useState(false);
  const [showImportantHolidays, setShowImportantHolidays] = useState(false);
  const [dismissedSuggestedChildName, setDismissedSuggestedChildName] = useState<string | null>(null);

  const suggestedChildName = useMemo(() => {
    const detectedName = getSuggestedChildNameFromPersonName(name);
    if (!detectedName) return null;

    const alreadyAdded = familyChildren.some(
      (child) => child.name.trim().toLowerCase() === detectedName.trim().toLowerCase()
    );
    if (alreadyAdded) return null;
    if (dismissedSuggestedChildName?.toLowerCase() === detectedName.toLowerCase()) return null;

    return detectedName;
  }, [dismissedSuggestedChildName, familyChildren, name]);

  useEffect(() => {
    if (!isOpen) return;
    setName(person.name ?? "");
    setPhone(person.phone ?? "");
    setPhoneError(false);
    setSelectedHolidays(getSelectedHolidays(person));
    setMothersDayPref(
      person.holidayPrefs?.mothersDay === true ? "include" : person.holidayPrefs?.mothersDay === false ? "exclude" : ""
    );
    setFathersDayPref(
      person.holidayPrefs?.fathersDay === true ? "include" : person.holidayPrefs?.fathersDay === false ? "exclude" : ""
    );
    setFamilyChildren([]);

    setOpenBirthday(false);
    setOpenAnniversary(false);
    setChildEditingIndex(null);
    setOpenSensitivePicker(false);

    setSensitiveTitle("");
    setSensitiveDate("");
    setSensitiveDraftMonthDay("");
    setSensitiveDraftYear("");
    setMomentPulseTick(0);
    setShowAdditionalDates(Boolean(sensitiveMoments.length));
    setShowImportantHolidays(Boolean(getSelectedHolidays(person).length));
    setDismissedSuggestedChildName(null);
  }, [isOpen, person]);

  useEffect(() => {
    if (!isOpen || !startWithNewChild) return;
    addChildEntry();
  }, [isOpen, startWithNewChild]);

  if (!isOpen) return null;

  function toggleSelectedHoliday(value: NonNullable<Person["selectedHolidays"]>[number]) {
    setSelectedHolidays((prev) => toggleHolidaySelection(prev, value));
  }

  function addChildEntry(childName = "") {
    const childId = makeId();
    setFamilyChildren((prev) => [...prev, { id: childId, name: childName, monthDay: "", year: "" }]);
    requestAnimationFrame(() => {
      const element = document.getElementById(`person-child-${childId}`);
      if (!element) return;
      element.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function buildDraftPerson(momentsOverride?: Moment[]) {
    return {
      ...person,
      name: name.trim(),
      phone: phone.trim() ? normalizePhone(phone) || phone.trim() : undefined,
      hasKids: Boolean((person.children?.length ?? 0) > 0) || familyChildren.length > 0,
      selectedHolidays: selectedHolidays.length ? selectedHolidays : undefined,
      holidayPrefs: familyChildren.length > 0
        ? {
            mothersDay: mothersDayPref === "" ? undefined : mothersDayPref === "include",
            fathersDay: fathersDayPref === "" ? undefined : fathersDayPref === "include",
          }
        : undefined,
      children: person.children ?? [],
      moments: momentsOverride ?? person.moments,
    } satisfies Person;
  }

  function save() {
    if (!name.trim()) return;

    const normalizedPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalizedPhone) {
      setPhoneError(true);
      return;
    }

    const nextMoments: Moment[] = [];

    // Keep/replace birthday + anniversary in a stable way.
    const existingBirthday = birthdayMoment;
    if (existingBirthday?.date) nextMoments.push(existingBirthday);

    const existingAnniversary = anniversaryMoment;
    if (existingAnniversary?.date) nextMoments.push(existingAnniversary);

    // Preserve other existing moments (custom, sensitive, etc.)
    for (const m of person.moments) {
      if (m.type === "birthday" || m.type === "anniversary") continue;
      nextMoments.push(m);
    }

    const updated: Person = {
      ...buildDraftPerson(nextMoments),
      phone: normalizedPhone || undefined,
    };

    onSave(deriveMomentBuckets(updated));
    const validChildren = familyChildren.filter((child) => child.name.trim() && child.monthDay);
    if (validChildren.length) {
      onAddChildren(deriveMomentBuckets(updated), validChildren);
    }
    onClose();
  }

  function updateBirthdayFromDraft() {
    const iso = buildMomentIso(birthdayDraftMonthDay, birthdayDraftYear, false);
    if (!iso) return;

    const updatedMoment: Moment = birthdayMoment
      ? { ...birthdayMoment, date: iso, recurring: true }
      : { id: makeId(), type: "birthday", label: "Birthday", date: iso, recurring: true };

    const other = person.moments.filter((m) => m.type !== "birthday");
    const updated = buildDraftPerson([updatedMoment, ...other]);
    onSave(deriveMomentBuckets(updated));
  }

  function updateAnniversaryFromDraft() {
    const iso = buildMomentIso(anniversaryDraftMonthDay, anniversaryDraftYear, false);
    if (!iso) return;

    const updatedMoment: Moment = anniversaryMoment
      ? { ...anniversaryMoment, date: iso, recurring: true }
      : { id: makeId(), type: "anniversary", label: "Anniversary", date: iso, recurring: true };

    const other = person.moments.filter((m) => m.type !== "anniversary");
    const updated = buildDraftPerson([updatedMoment, ...other]);
    onSave(deriveMomentBuckets(updated));
  }

  function removeMomentById(id: string) {
    onSave(deriveMomentBuckets(buildDraftPerson(person.moments.filter((m) => m.id !== id))));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit person"
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={sheetStyle}>
        <div
          className="modalContent"
          style={{
            fontFamily: "var(--font-sans)",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            minHeight: 0,
            borderRadius: "inherit",
            paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", fontWeight: 600, color: "var(--ink)" }}>
              Edit {name.trim() || person.name.trim() || "person"}
            </div>
            <button
              onClick={onClose}
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
              Close
            </button>
          </div>

          <div style={{ marginTop: "16px", display: "grid", gap: "16px" }}>
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                style={{
                  width: "100%",
                  padding: "0.75rem 0.85rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--card)",
                  color: "var(--ink)",
                  fontSize: "1rem",
                }}
              />
              {suggestedChildName ? (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--paper)",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <div style={{ color: "var(--ink)", fontSize: "0.95rem" }}>Add {suggestedChildName} as a child?</div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => addChildEntry(suggestedChildName)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "var(--ink)",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                        fontSize: "0.92rem",
                      }}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedSuggestedChildName(suggestedChildName)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "var(--muted)",
                        textDecoration: "underline",
                        textUnderlineOffset: "3px",
                        fontSize: "0.92rem",
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Phone (optional)</div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => {
                  const next = e.target.value;
                  setPhone(next);
                  if (!next.trim()) setPhoneError(false);
                  else if (normalizePhone(next)) setPhoneError(false);
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
                }}
              />
              {phoneError ? (
                <div style={{ marginTop: "6px", color: "#b42318", fontSize: "0.85rem" }}>
                  Enter a valid phone number.
                </div>
              ) : null}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <div className="dkf-fade-in-80" style={{ fontWeight: 600, color: "var(--ink)", marginTop: "8px", marginBottom: "16px" }}>Moments</div>

              <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                <button
                  onClick={() => {
                    const draft = toDraftFromIso(momentDate(birthdayMoment));
                    setBirthdayDraftMonthDay(draft.monthDay);
                    setBirthdayDraftYear(draft.year);
                    setOpenBirthday(true);
                  }}
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
                  <span>Birthday</span>
                  <span style={{ color: "var(--muted)" }}>
                    {birthdayMoment?.date ? formatMomentDate(birthdayMoment.date) : "Select date"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    const draft = toDraftFromIso(momentDate(anniversaryMoment));
                    setAnniversaryDraftMonthDay(draft.monthDay);
                    setAnniversaryDraftYear(draft.year);
                    setOpenAnniversary(true);
                  }}
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
                  <span>Anniversary</span>
                  <span style={{ color: "var(--muted)" }}>
                    {anniversaryMoment?.date ? formatMomentDate(anniversaryMoment.date) : "Select date"}
                  </span>
                </button>
              </div>

              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <button
                  type="button"
                  onClick={() => setShowAdditionalDates((prev) => !prev)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--ink)",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                    fontSize: "0.98rem",
                    fontWeight: 500,
                  }}
                >
                  + Add another important date
                </button>

                {showAdditionalDates ? (
                  <>
                    {sensitiveMoments.length ? (
                      <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
                        {sensitiveMoments.map((m) => (
                          <div
                            key={m.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "1rem",
                              padding: "0.75rem 0.85rem",
                              borderRadius: "12px",
                              border: "1px solid var(--border)",
                              background: "var(--card)",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "var(--ink)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {m.label}
                              </div>
                              <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "2px" }}>
                                {formatMomentDate(m.date)}
                              </div>
                            </div>
                            <button
                              onClick={() => removeMomentById(m.id)}
                              title="This removes the moment from your list."
                              style={{
                                padding: 0,
                                border: "none",
                                background: "none",
                                cursor: "pointer",
                                color: "var(--muted)",
                                textDecoration: "underline",
                                textUnderlineOffset: "3px",
                                fontSize: "0.9rem",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ marginTop: "10px", color: "var(--muted)", fontSize: "0.92rem" }}>
                        None yet.
                      </div>
                    )}

                    <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                      <input
                        value={sensitiveTitle}
                        onChange={(e) => setSensitiveTitle(e.target.value)}
                        placeholder="Label"
                        style={{
                          width: "100%",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                          fontSize: "1rem",
                        }}
                      />

                      <button
                        onClick={() => {
                          const draft = toDraftFromIso(sensitiveDate);
                          setSensitiveDraftMonthDay(draft.monthDay);
                          setSensitiveDraftYear(draft.year);
                          setOpenSensitivePicker(true);
                        }}
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
                        <span>Date</span>
                        <span style={{ color: "var(--muted)" }}>
                          {sensitiveDate ? formatMomentDate(sensitiveDate) : "Select date"}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          if (!sensitiveTitle.trim() || !sensitiveDate) return;
                          const moment: Moment = {
                            id: makeId(),
                            type: "custom",
                            label: sensitiveTitle.trim(),
                            date: sensitiveDate,
                            recurring: true,
                            category: "sensitive",
                          };
                          onSave(deriveMomentBuckets(buildDraftPerson([...person.moments, moment])));
                          setSensitiveTitle("");
                          setSensitiveDate("");
                          setMomentPulseTick((t) => t + 1);
                        }}
                        className={momentPulseTick ? "dkf-row-pulse" : undefined}
                        style={{
                          border: "1px solid var(--border-strong)",
                          background: "transparent",
                          color: "var(--ink)",
                          cursor: "pointer",
                          textAlign: "center",
                          fontWeight: 500,
                          letterSpacing: "0.01em",
                          borderRadius: "12px",
                          padding: "0.75rem 1rem",
                          fontSize: "0.95rem",
                          boxShadow: "none",
                          justifySelf: "start",
                        }}
                      >
                        Add moment
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "16px" }}>
              <div className="dkf-fade-in-80" style={{ fontWeight: 600, color: "var(--ink)", marginTop: "8px", marginBottom: "8px" }}>Family</div>
              {familyChildren.length ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "14px" }}>
                  {familyChildren.map((child, idx) => (
                    <div
                      key={child.id}
                      id={`person-child-${child.id}`}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--paper)",
                        borderRadius: "16px",
                        padding: "16px",
                        display: "grid",
                        gap: "12px",
                      }}
                    >
                      <input
                        value={child.name}
                        onChange={(e) => {
                          const nextName = e.target.value;
                          setFamilyChildren((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === idx ? { ...entry, name: nextName } : entry
                            )
                          );
                        }}
                        placeholder="Child name"
                        style={{
                          width: "100%",
                          padding: "0.72rem 0.8rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => {
                          setChildEditingIndex(idx);
                          setChildDraftMonthDay(child.monthDay);
                          setChildDraftYear(child.year);
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                          width: "100%",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "var(--ink)",
                        }}
                      >
                        <span>Birthday</span>
                        <span style={{ color: "var(--muted)" }}>
                          {child.monthDay ? formatMomentDate(buildMomentIso(child.monthDay, child.year, false)) : "Select date"}
                        </span>
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={child.year}
                        onChange={(e) => {
                          const nextYear = e.target.value.replace(/\D/g, "").slice(0, 4);
                          setFamilyChildren((prev) =>
                            prev.map((entry, entryIndex) =>
                              entryIndex === idx ? { ...entry, year: nextYear } : entry
                            )
                          );
                        }}
                        placeholder="Birth year"
                        style={{
                          width: "100%",
                          padding: "0.72rem 0.8rem",
                          borderRadius: "12px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                        }}
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addChildEntry()}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "12px",
                      padding: "0.7rem 1rem",
                      fontSize: "0.95rem",
                      justifySelf: "start",
                    }}
                  >
                    + Add another child
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    onClick={() => addChildEntry()}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "12px",
                      padding: "0.7rem 1rem",
                      fontSize: "0.95rem",
                      justifySelf: "start",
                    }}
                  >
                    + Add child
                  </button>
                </div>
              )}

              <div style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowImportantHolidays((prev) => !prev)}
                  style={{
                    padding: 0,
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: "var(--ink)",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                    fontSize: "0.98rem",
                    fontWeight: 500,
                  }}
                >
                  + Important Holidays
                </button>

                {showImportantHolidays ? (
                  <>
                    <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "8px" }}>
                      Choose any that apply.
                    </div>

                    <div style={{ display: "grid", gap: "0.6rem", marginTop: "10px" }}>
                      {PERSON_HOLIDAY_OPTIONS.map((opt) => (
                        <label
                          key={opt.id}
                          style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "var(--ink)" }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedHolidays.includes(opt.id)}
                            onChange={() => toggleSelectedHoliday(opt.id)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>

            </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "8px", justifyContent: "space-between" }}>
              <button
                onClick={onClose}
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
              <button
                onClick={save}
                style={{
                  border: "1px solid var(--border-strong)",
                  background: "transparent",
                  color: "var(--ink)",
                  cursor: "pointer",
                  textAlign: "center",
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                  borderRadius: "12px",
                  padding: "0.85rem 1.1rem",
                  fontSize: "0.98rem",
                  boxShadow: "none",
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {openBirthday ? (
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
            updateBirthdayFromDraft();
            setOpenBirthday(false);
          }}
          onCancel={() => setOpenBirthday(false)}
          onClear={() => {
            setBirthdayDraftMonthDay("");
            setBirthdayDraftYear("");
            if (birthdayMoment) removeMomentById(birthdayMoment.id);
          }}
        />
      ) : null}

      {openAnniversary ? (
        <MomentDatePicker
          isOpen
          title="Anniversary"
          mode="anniversary"
          monthDay={anniversaryDraftMonthDay}
          setMonthDay={setAnniversaryDraftMonthDay}
          year={anniversaryDraftYear}
          setYear={setAnniversaryDraftYear}
          yearHelperText="Add the year if you know it."
          onSave={() => {
            updateAnniversaryFromDraft();
            setOpenAnniversary(false);
          }}
          onCancel={() => setOpenAnniversary(false)}
          onClear={() => {
            setAnniversaryDraftMonthDay("");
            setAnniversaryDraftYear("");
            if (anniversaryMoment) removeMomentById(anniversaryMoment.id);
          }}
        />
      ) : null}

      {childEditingIndex !== null ? (
        <MomentDatePicker
          isOpen
          title="Child birthday"
          mode="birthday"
          monthDay={childDraftMonthDay}
          setMonthDay={setChildDraftMonthDay}
          year={childDraftYear}
          setYear={setChildDraftYear}
          yearHelperText=""
          onSave={() => {
            setFamilyChildren((prev) =>
              prev.map((child, index) =>
                index === childEditingIndex
                  ? { ...child, monthDay: childDraftMonthDay, year: childDraftYear.trim() }
                  : child
              )
            );
            setChildEditingIndex(null);
          }}
          onCancel={() => setChildEditingIndex(null)}
          onClear={() => {
            setFamilyChildren((prev) =>
              prev.map((child, index) =>
                index === childEditingIndex ? { ...child, monthDay: "", year: "" } : child
              )
            );
            setChildDraftMonthDay("");
            setChildDraftYear("");
            setChildEditingIndex(null);
          }}
        />
      ) : null}

      {openSensitivePicker ? (
        <MomentDatePicker
          isOpen
          title="Sensitive date"
          mode="custom"
          monthDay={sensitiveDraftMonthDay}
          setMonthDay={setSensitiveDraftMonthDay}
          year={sensitiveDraftYear}
          setYear={setSensitiveDraftYear}
          yearHelperText=""
          onSave={() => {
            const iso = buildMomentIso(sensitiveDraftMonthDay, sensitiveDraftYear, false);
            if (!iso) return;
            setSensitiveDate(iso);
            setOpenSensitivePicker(false);
          }}
          onCancel={() => setOpenSensitivePicker(false)}
          onClear={() => {
            setSensitiveDraftMonthDay("");
            setSensitiveDraftYear("");
          }}
        />
      ) : null}
    </div>
  );
}
