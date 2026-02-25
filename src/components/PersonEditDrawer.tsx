import { useEffect, useMemo, useState } from "react";
import type { Child, ChildSchoolEventType, Moment, Person } from "../models/Person";
import MomentDatePicker from "./MomentDatePicker";

type Props = {
  isOpen: boolean;
  person: Person;
  onClose: () => void;
  onSave: (updated: Person) => void;
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 18, 24, 0.35)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-end",
  padding: "12px",
  zIndex: 50,
};

const sheetStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "720px",
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "16px",
  boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
  overflow: "hidden",
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

function schoolEventLabel(type: ChildSchoolEventType) {
  if (type === "firstDay") return "First day of school";
  if (type === "kGrad") return "Kindergarten graduation";
  if (type === "5thMoveUp") return "5th grade moving-up";
  if (type === "8thGrad") return "8th grade graduation";
  if (type === "hsGrad") return "High school graduation";
  if (type === "communion") return "Communion";
  if (type === "confirmation") return "Confirmation";
  if (type === "barMitzvah") return "Bar mitzvah";
  if (type === "batMitzvah") return "Bat mitzvah";
  return "Milestone";
}

export default function PersonEditDrawer({ isOpen, person, onClose, onSave }: Props) {
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
  const [hasKids, setHasKids] = useState(Boolean(person.hasKids || (person.children?.length ?? 0) > 0));
  const [religionCulture, setReligionCulture] = useState<Person["religionCulture"] | "">(
    person.religionCulture ?? ""
  );
  const [mothersDayPref, setMothersDayPref] = useState<"" | "include" | "exclude">(
    person.holidayPrefs?.mothersDay === true ? "include" : person.holidayPrefs?.mothersDay === false ? "exclude" : ""
  );
  const [fathersDayPref, setFathersDayPref] = useState<"" | "include" | "exclude">(
    person.holidayPrefs?.fathersDay === true ? "include" : person.holidayPrefs?.fathersDay === false ? "exclude" : ""
  );
  const [children, setChildren] = useState<Child[]>(person.children ?? []);

  const [openBirthday, setOpenBirthday] = useState(false);
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");

  const [openAnniversary, setOpenAnniversary] = useState(false);
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");

  const [childEditingIndex, setChildEditingIndex] = useState<number | null>(null);
  const [childDraftMonthDay, setChildDraftMonthDay] = useState("");
  const [childDraftYear, setChildDraftYear] = useState("");

  const [milestoneEditing, setMilestoneEditing] = useState<{ childIndex: number } | null>(null);
  const [milestoneType, setMilestoneType] = useState<ChildSchoolEventType>("firstDay");
  const [milestoneDraftMonthDay, setMilestoneDraftMonthDay] = useState("");
  const [milestoneDraftYear, setMilestoneDraftYear] = useState("");

  const [sensitiveTitle, setSensitiveTitle] = useState("");
  const [sensitiveDate, setSensitiveDate] = useState("");
  const [sensitiveDraftMonthDay, setSensitiveDraftMonthDay] = useState("");
  const [sensitiveDraftYear, setSensitiveDraftYear] = useState("");
  const [openSensitivePicker, setOpenSensitivePicker] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(person.name ?? "");
    setPhone(person.phone ?? "");
    setHasKids(Boolean(person.hasKids || (person.children?.length ?? 0) > 0));
    setReligionCulture(person.religionCulture ?? "");
    setMothersDayPref(
      person.holidayPrefs?.mothersDay === true ? "include" : person.holidayPrefs?.mothersDay === false ? "exclude" : ""
    );
    setFathersDayPref(
      person.holidayPrefs?.fathersDay === true ? "include" : person.holidayPrefs?.fathersDay === false ? "exclude" : ""
    );
    setChildren(person.children ?? []);

    setOpenBirthday(false);
    setOpenAnniversary(false);
    setChildEditingIndex(null);
    setMilestoneEditing(null);
    setOpenSensitivePicker(false);

    setSensitiveTitle("");
    setSensitiveDate("");
    setSensitiveDraftMonthDay("");
    setSensitiveDraftYear("");
  }, [isOpen, person]);

  if (!isOpen) return null;

  function save() {
    if (!name.trim()) return;

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
      ...person,
      name: name.trim(),
      phone: phone.trim() ? phone.trim() : undefined,
      hasKids: hasKids ? true : false,
      religionCulture: religionCulture || undefined,
      holidayPrefs: hasKids
        ? {
            mothersDay: mothersDayPref === "" ? undefined : mothersDayPref === "include",
            fathersDay: fathersDayPref === "" ? undefined : fathersDayPref === "include",
          }
        : undefined,
      children: hasKids ? children : [],
      moments: nextMoments,
    };

    onSave(deriveMomentBuckets(updated));
    onClose();
  }

  function updateBirthdayFromDraft() {
    const iso = buildMomentIso(birthdayDraftMonthDay, birthdayDraftYear, false);
    if (!iso) return;

    const updatedMoment: Moment = birthdayMoment
      ? { ...birthdayMoment, date: iso, recurring: true }
      : { id: makeId(), type: "birthday", label: "Birthday", date: iso, recurring: true };

    const other = person.moments.filter((m) => m.type !== "birthday");
    const updated = { ...person, moments: [updatedMoment, ...other] };
    onSave(deriveMomentBuckets(updated));
  }

  function updateAnniversaryFromDraft() {
    const iso = buildMomentIso(anniversaryDraftMonthDay, anniversaryDraftYear, true);
    if (!iso) return;

    const updatedMoment: Moment = anniversaryMoment
      ? { ...anniversaryMoment, date: iso, recurring: true }
      : { id: makeId(), type: "anniversary", label: "Anniversary", date: iso, recurring: true };

    const other = person.moments.filter((m) => m.type !== "anniversary");
    const updated = { ...person, moments: [updatedMoment, ...other] };
    onSave(deriveMomentBuckets(updated));
  }

  function removeMomentById(id: string) {
    onSave(deriveMomentBuckets({ ...person, moments: person.moments.filter((m) => m.id !== id) }));
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
        <div className="modalContent" style={{ fontFamily: "var(--font-sans)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.35rem", fontWeight: 600, color: "var(--ink)" }}>
              Edit
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

          <div style={{ marginTop: "18px", display: "grid", gap: "14px" }}>
            <div className="dkf-fade-in-80" style={{ fontWeight: 600, color: "var(--ink)", marginTop: "12px" }}>Details</div>
            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                style={{
                  width: "100%",
                  padding: "0.75rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--card)",
                  color: "var(--ink)",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Phone (optional)</div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                style={{
                  width: "100%",
                  padding: "0.75rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-strong)",
                  background: "var(--card)",
                  color: "var(--ink)",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "2px" }}>
              Family (optional)
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <div className="dkf-fade-in-80" style={{ fontWeight: 600, color: "var(--ink)", marginTop: "12px" }}>Moments</div>

              <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
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
                    borderRadius: "8px",
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
                    borderRadius: "8px",
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

              <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--border)" }}>
                <div className="dkf-fade-in-80" style={{ fontWeight: 600, color: "var(--ink)", marginTop: "12px" }}>Custom moments (optional)</div>

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
                          borderRadius: "8px",
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

                <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
                  <input
                    value={sensitiveTitle}
                    onChange={(e) => setSensitiveTitle(e.target.value)}
                    placeholder="Label (optional)"
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "8px",
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
                      borderRadius: "8px",
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
                      onSave(deriveMomentBuckets({ ...person, moments: [...person.moments, moment] }));
                      setSensitiveTitle("");
                      setSensitiveDate("");
                    }}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "center",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      fontSize: "0.95rem",
                      boxShadow: "none",
                      justifySelf: "start",
                    }}
                  >
                    Add moment
                  </button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "10px" }}>
              <div className="dkf-fade-in-80" style={{ fontWeight: 600, color: "var(--ink)", marginTop: "12px" }}>Family</div>
              <label style={{ display: "flex", alignItems: "center", gap: "0.65rem", marginTop: "10px" }}>
                <input type="checkbox" checked={hasKids} onChange={(e) => setHasKids(e.target.checked)} />
                Has kids
              </label>

              {hasKids ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                  <div style={{ display: "grid", gap: "8px" }}>
                    <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Parent role (optional)</div>
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div>
                        <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Mother’s Day</div>
                        <select
                          value={mothersDayPref}
                          onChange={(e) => setMothersDayPref((e.target.value as typeof mothersDayPref) ?? "")}
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--card)",
                            color: "var(--ink)",
                            marginTop: "6px",
                          }}
                        >
                          <option value="">Ask later</option>
                          <option value="include">Include</option>
                          <option value="exclude">Exclude</option>
                        </select>
                      </div>
                      <div>
                        <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>Father’s Day</div>
                        <select
                          value={fathersDayPref}
                          onChange={(e) => setFathersDayPref((e.target.value as typeof fathersDayPref) ?? "")}
                          style={{
                            width: "100%",
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            border: "1px solid var(--border-strong)",
                            background: "var(--card)",
                            color: "var(--ink)",
                            marginTop: "6px",
                          }}
                        >
                          <option value="">Ask later</option>
                          <option value="include">Include</option>
                          <option value="exclude">Exclude</option>
                          </select>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: "12px" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Religion / culture (optional)</div>
                <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  Helps surface meaningful holidays.
                </div>
                <select
                  value={religionCulture ?? ""}
                  onChange={(e) => setReligionCulture((e.target.value as Person["religionCulture"]) || "")}
                  style={{
                    width: "100%",
                    padding: "0.75rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border-strong)",
                    background: "var(--card)",
                    color: "var(--ink)",
                    fontSize: "1rem",
                    marginTop: "6px",
                  }}
                >
                  <option value="">Optional</option>
                  <option value="christian">Christian</option>
                  <option value="orthodox">Orthodox</option>
                  <option value="jewish">Jewish</option>
                  <option value="muslim">Muslim</option>
                  <option value="none">None</option>
                </select>
              </div>

              {hasKids ? (
                <div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Children</div>

                  {children.map((child, idx) => (
                    <div
                      key={child.id}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--paper)",
                        borderRadius: "8px",
                        padding: "12px",
                        display: "grid",
                        gap: "10px",
                      }}
                    >
                      <input
                        value={child.name ?? ""}
                        onChange={(e) => {
                          const nextName = e.target.value;
                          setChildren((prev) => prev.map((c, i) => (i === idx ? { ...c, name: nextName } : c)));
                        }}
                        placeholder="Child name (optional)"
                        style={{
                          width: "100%",
                          padding: "0.65rem 0.75rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          color: "var(--ink)",
                        }}
                      />

                      <button
                        onClick={() => {
                          const draft = toDraftFromIso(child.birthday ?? child.birthdate ?? "");
                          setChildEditingIndex(idx);
                          setChildDraftMonthDay(draft.monthDay);
                          setChildDraftYear(draft.year);
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "1rem",
                          width: "100%",
                          padding: "0.75rem 0.85rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border-strong)",
                          background: "var(--card)",
                          cursor: "pointer",
                          textAlign: "left",
                          color: "var(--ink)",
                        }}
                      >
                        <span>Birthday</span>
                        <span style={{ color: "var(--muted)" }}>
                          {child.birthday || child.birthdate ? formatMomentDate(child.birthday ?? child.birthdate ?? "") : "Select date"}
                        </span>
                      </button>

                      <div style={{ display: "grid", gap: "8px" }}>
                        <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>School milestones (optional)</div>
                        {(child.schoolEvents ?? []).length ? (
                          <div style={{ display: "grid", gap: "6px" }}>
                            {(child.schoolEvents ?? []).map((ev) => (
                              <div
                                key={`${ev.type}-${ev.date}`}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: "1rem",
                                  padding: "0.6rem 0.75rem",
                                  borderRadius: "8px",
                                  border: "1px solid var(--border)",
                                  background: "var(--card)",
                                }}
                              >
                                <div style={{ color: "var(--ink)" }}>{schoolEventLabel(ev.type)}</div>
                                <button
                                  onClick={() => {
                                    setChildren((prev) =>
                                      prev.map((c, i) => {
                                        if (i !== idx) return c;
                                        return {
                                          ...c,
                                          schoolEvents: (c.schoolEvents ?? []).filter(
                                            (s) => !(s.type === ev.type && s.date === ev.date)
                                          ),
                                        };
                                      })
                                    );
                                  }}
                                  style={{
                                    padding: 0,
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    color: "var(--muted)",
                                    textDecoration: "underline",
                                    textUnderlineOffset: "3px",
                                    fontSize: "0.85rem",
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>None yet.</div>
                        )}

                        <button
                          onClick={() => {
                            setMilestoneEditing({ childIndex: idx });
                            setMilestoneType("firstDay");
                            setMilestoneDraftMonthDay("");
                            setMilestoneDraftYear("");
                          }}
                          style={{
                            padding: 0,
                            border: "none",
                            background: "none",
                            cursor: "pointer",
                            color: "var(--ink)",
                            textDecoration: "underline",
                            textUnderlineOffset: "3px",
                            fontSize: "0.92rem",
                            justifySelf: "start",
                          }}
                        >
                          Add a milestone
                        </button>
                      </div>

                      <button
                        onClick={() => setChildren((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "none",
                          cursor: "pointer",
                          color: "var(--muted)",
                          textDecoration: "underline",
                          textUnderlineOffset: "3px",
                          fontSize: "0.9rem",
                          justifySelf: "start",
                          marginTop: "2px",
                        }}
                      >
                        Remove child
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={() => setChildren((prev) => [...prev, { id: makeId(), name: "", birthday: "" }])}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 500,
                      letterSpacing: "0.01em",
                      borderRadius: "8px",
                      padding: "0.65rem 1rem",
                      fontSize: "0.95rem",
                      justifySelf: "start",
                    }}
                  >
                    + Add child
                  </button>
                </div>
              ) : null}
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "6px", justifyContent: "flex-end" }}>
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
                  borderRadius: "8px",
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
          yearHelperText="Used for milestone reminders."
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
          yearHelperText="Used to calculate years together."
          requireYear
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
          yearHelperText="Optional."
          onSave={() => {
            const iso = buildMomentIso(childDraftMonthDay, childDraftYear, false);
            setChildren((prev) =>
              prev.map((c, i) => (i === childEditingIndex ? { ...c, birthday: iso, birthdate: undefined } : c))
            );
            setChildEditingIndex(null);
          }}
          onCancel={() => setChildEditingIndex(null)}
          onClear={() => {
            setChildren((prev) =>
              prev.map((c, i) => (i === childEditingIndex ? { ...c, birthday: "", birthdate: undefined } : c))
            );
            setChildDraftMonthDay("");
            setChildDraftYear("");
          }}
        />
      ) : null}

      {milestoneEditing ? (
        <div style={overlayStyle} onMouseDown={(e) => e.target === e.currentTarget && setMilestoneEditing(null)}>
          <div style={sheetStyle}>
            <div className="modalContent" style={{ fontFamily: "var(--font-sans)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}>
                  Add milestone
                </div>
                <button
                  onClick={() => setMilestoneEditing(null)}
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
                  <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Type</div>
                  <select
                    value={milestoneType}
                    onChange={(e) => setMilestoneType(e.target.value as ChildSchoolEventType)}
                    style={{
                      width: "100%",
                      padding: "0.75rem 0.85rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-strong)",
                      background: "var(--card)",
                      color: "var(--ink)",
                      fontSize: "1rem",
                    }}
                  >
                    <option value="firstDay">First day of school</option>
                    <option value="kGrad">Kindergarten graduation</option>
                    <option value="5thMoveUp">5th grade moving-up</option>
                    <option value="8thGrad">8th grade graduation</option>
                    <option value="hsGrad">High school graduation</option>
                    <option value="communion">Communion</option>
                    <option value="confirmation">Confirmation</option>
                    <option value="barMitzvah">Bar mitzvah</option>
                    <option value="batMitzvah">Bat mitzvah</option>
                  </select>
                </div>

                <MomentDatePicker
                  isOpen
                  title="Milestone date"
                  mode="custom"
                  monthDay={milestoneDraftMonthDay}
                  setMonthDay={setMilestoneDraftMonthDay}
                  year={milestoneDraftYear}
                  setYear={setMilestoneDraftYear}
                  yearHelperText="Optional."
                  requireYear
                  onSave={() => {
                    const iso = buildMomentIso(milestoneDraftMonthDay, milestoneDraftYear, true);
                    if (!iso) return;
                    const idx = milestoneEditing.childIndex;
                    setChildren((prev) =>
                      prev.map((c, i) => {
                        if (i !== idx) return c;
                        return {
                          ...c,
                          schoolEvents: [...(c.schoolEvents ?? []), { type: milestoneType, date: iso }],
                        };
                      })
                    );
                    setMilestoneEditing(null);
                  }}
                  onCancel={() => setMilestoneEditing(null)}
                  onClear={() => {
                    setMilestoneDraftMonthDay("");
                    setMilestoneDraftYear("");
                  }}
                />
              </div>
            </div>
          </div>
        </div>
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
          yearHelperText="Optional."
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
