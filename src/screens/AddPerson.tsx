import { useEffect, useState } from "react";
import type { Child, Moment, Person } from "../models/Person";
import type { Relationship, RelationshipType } from "../models/Relationship";
import MomentDatePicker from "../components/MomentDatePicker";

type Props = {
  people: Person[];
  person?: Person;
  onSave: (payload: {
    person: Person;
    createdPeople: Person[];
    createdRelationships: Relationship[];
  }) => void;
  onBack: () => void;
};

export default function AddPerson({ people, person: initialPerson, onSave, onBack }: Props) {
  const [name, setName] = useState("");
  const [birthdayMonthDay, setBirthdayMonthDay] = useState("");
  const [birthdayYear, setBirthdayYear] = useState("");
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");
  const [anniversary, setAnniversary] = useState("");
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");
  const [phone, setPhone] = useState("");
  const [hasKids, setHasKids] = useState(false);
  const [parentRole, setParentRole] = useState<Person["parentRole"]>("parent");
  const [religionCulture, setReligionCulture] = useState<Person["religionCulture"] | "">("");
  const [children, setChildren] = useState<Child[]>([]);
  const [childEditingIndex, setChildEditingIndex] = useState<number | null>(null);
  const [childDraftMonthDay, setChildDraftMonthDay] = useState("");
  const [childDraftYear, setChildDraftYear] = useState("");
  const [customMoments, setCustomMoments] = useState<Array<{ title: string; date: string }>>([]);
  const [customMomentTitle, setCustomMomentTitle] = useState("");
  const [customMomentDate, setCustomMomentDate] = useState("");
  const [customDraftMonthDay, setCustomDraftMonthDay] = useState("");
  const [customDraftYear, setCustomDraftYear] = useState("");
  const [isCustomDatePickerOpen, setIsCustomDatePickerOpen] = useState(false);
  const [editingCustomMomentIndex, setEditingCustomMomentIndex] = useState<number | null>(null);
  const [editingCustomMomentTitle, setEditingCustomMomentTitle] = useState("");
  const [editingCustomMomentDate, setEditingCustomMomentDate] = useState("");
  const [editingCustomDraftMonthDay, setEditingCustomDraftMonthDay] = useState("");
  const [editingCustomDraftYear, setEditingCustomDraftYear] = useState("");
  const [isEditingCustomDatePickerOpen, setIsEditingCustomDatePickerOpen] = useState(false);
  const [createdRelatedPeople, setCreatedRelatedPeople] = useState<Person[]>([]);
  const [relatedDrafts, setRelatedDrafts] = useState<
    Array<{ id: string; toId: string; name: string; type: RelationshipType }>
  >([]);
  const [relatedName, setRelatedName] = useState("");
  const [relatedType, setRelatedType] = useState<RelationshipType>("child");
  const [openRow, setOpenRow] = useState<
    "name" | "phone" | "family" | "birthday" | "anniversary" | "custom" | "related" | null
  >(null);

  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  const dateWithYearFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function formatDate(value: string) {
    if (!value) return "";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return dateFormatter.format(parsed);
  }

  function formatMomentDate(value: string) {
    const parts = parseYmd(value);
    if (!parts) return value;
    const displayYear = parts.y > 0 ? parts.y : 2000;
    const parsed = new Date(displayYear, parts.m - 1, parts.d);
    if (Number.isNaN(parsed.getTime())) return value;
    return parts.y > 0 ? dateWithYearFormatter.format(parsed) : dateFormatter.format(parsed);
  }

  function parseYmd(value: string) {
    const [yStr, mStr, dStr] = value.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!yStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return { y, m, d };
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

  function makeId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  useEffect(() => {
    if (!initialPerson) return;

    setName(initialPerson.name ?? "");
    setPhone(initialPerson.phone ?? "");
    setHasKids(Boolean(initialPerson.hasKids || (initialPerson.children?.length ?? 0) > 0));
    setParentRole(initialPerson.parentRole ?? "parent");
    setReligionCulture(initialPerson.religionCulture ?? "");
    setChildren(initialPerson.children ?? []);
    setChildEditingIndex(null);
    setChildDraftMonthDay("");
    setChildDraftYear("");

    const birthdayMoment =
      initialPerson.moments.find((m: Moment) => m.type === "birthday") ?? null;
    if (birthdayMoment?.date) {
      const parts = parseYmd(birthdayMoment.date);
      if (parts) {
        setBirthdayMonthDay(`2000-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`);
        const y = parts.y > 0 ? String(parts.y) : "";
        setBirthdayYear(y);
      } else {
        setBirthdayMonthDay("");
        setBirthdayYear("");
      }
    } else {
      setBirthdayMonthDay("");
      setBirthdayYear("");
    }

    const anniversaryMoment =
      initialPerson.moments.find((m: Moment) => m.type === "anniversary") ?? null;
    setAnniversary(anniversaryMoment?.date ?? "");

    const custom = initialPerson.moments
      .filter((m) => m.type === "custom")
      .map((m) => ({ title: m.label, date: m.date }));
    setCustomMoments(custom);

    setCustomMomentTitle("");
    setCustomMomentDate("");
    setCustomDraftMonthDay("");
    setCustomDraftYear("");
    setIsCustomDatePickerOpen(false);
    setIsEditingCustomDatePickerOpen(false);
    setOpenRow(null);
  }, [initialPerson]);

  function handleSave() {
    if (!name.trim()) return;

    const birthdayIso = buildBirthdayIso(birthdayMonthDay, birthdayYear);
    const moments: Moment[] = [];
    if (birthdayIso) {
      moments.push({
        id: makeId(),
        type: "birthday",
        label: "Birthday",
        date: birthdayIso,
        recurring: true,
      });
    }
    if (anniversary) {
      moments.push({
        id: makeId(),
        type: "anniversary",
        label: "Anniversary",
        date: anniversary,
        recurring: true,
      });
    }
    for (const custom of customMoments) {
      if (!custom.title.trim() || !custom.date) continue;
      moments.push({
        id: makeId(),
        type: "custom",
        label: custom.title.trim(),
        date: custom.date,
        recurring: true,
      });
    }

    const basePerson: Person = initialPerson ?? {
      id: makeId(),
      name: "",
      moments: [],
    };

    const person: Person = {
      ...basePerson,
      id: basePerson.id,
      name: name.trim(),
      phone: phone || undefined,
      moments,
      hasKids: hasKids || (children.length ? true : undefined),
      parentRole: hasKids ? parentRole : undefined,
      religionCulture: religionCulture || undefined,
      children: hasKids ? children : undefined,
      importantDates: moments.filter((m) => m.type === "custom"),
    };

    const createdRelationships: Relationship[] = relatedDrafts.map((draft) => ({
      id: makeId(),
      fromId: person.id,
      toId: draft.toId,
      type: draft.type,
    }));

    onSave({
      person,
      createdPeople: createdRelatedPeople,
      createdRelationships,
    });
  }

  function handleSaveCustomMoment() {
    if (!customMomentTitle.trim() || !customMomentDate) return;
    setCustomMoments((prev) => [
      ...prev,
      { title: customMomentTitle.trim(), date: customMomentDate },
    ]);
    setCustomMomentTitle("");
    setCustomMomentDate("");
    setCustomDraftMonthDay("");
    setCustomDraftYear("");
    setOpenRow(null);
  }

  function startEditingCustomMoment(index: number) {
    const moment = customMoments[index];
    if (!moment) return;
    setEditingCustomMomentIndex(index);
    setEditingCustomMomentTitle(moment.title);
    setEditingCustomMomentDate(moment.date);
    {
      const draft = toDraftFromIso(moment.date);
      setEditingCustomDraftMonthDay(draft.monthDay);
      setEditingCustomDraftYear(draft.year);
    }
    setIsEditingCustomDatePickerOpen(false);
    setOpenRow(null);
  }

  function handleUpdateCustomMoment() {
    if (editingCustomMomentIndex === null) return;
    if (!editingCustomMomentTitle.trim() || !editingCustomMomentDate) return;
    setCustomMoments((prev) =>
      prev.map((moment, idx) =>
        idx === editingCustomMomentIndex
          ? { title: editingCustomMomentTitle.trim(), date: editingCustomMomentDate }
          : moment
      )
    );
    setEditingCustomMomentIndex(null);
    setEditingCustomMomentTitle("");
    setEditingCustomMomentDate("");
    setEditingCustomDraftMonthDay("");
    setEditingCustomDraftYear("");
    setIsEditingCustomDatePickerOpen(false);
  }

  function deleteCustomMomentByIndex(index: number) {
    setCustomMoments((prev) => prev.filter((_, idx) => idx !== index));
    if (editingCustomMomentIndex === index) {
      setEditingCustomMomentIndex(null);
      setEditingCustomMomentTitle("");
      setEditingCustomMomentDate("");
      setEditingCustomDraftMonthDay("");
      setEditingCustomDraftYear("");
      setIsEditingCustomDatePickerOpen(false);
    } else if (editingCustomMomentIndex !== null && index < editingCustomMomentIndex) {
      setEditingCustomMomentIndex(editingCustomMomentIndex - 1);
    }
  }

  function handleAddRelatedPerson() {
    const typedName = relatedName.trim();
    if (!typedName) return;

    const normalized = typedName.toLowerCase();
    const existing =
      people.find((p) => p.name.trim().toLowerCase() === normalized) ??
      createdRelatedPeople.find((p) => p.name.trim().toLowerCase() === normalized) ??
      null;

    let relatedPerson = existing;
    if (!relatedPerson) {
      relatedPerson = {
        id: makeId(),
        name: typedName,
        moments: [],
      };
      setCreatedRelatedPeople((prev) => [...prev, relatedPerson!]);
    }

    setRelatedDrafts((prev) => [
      ...prev,
      { id: makeId(), toId: relatedPerson!.id, name: relatedPerson!.name, type: relatedType },
    ]);
    setRelatedName("");
    setRelatedType("child");
    setOpenRow(null);
  }

  function deleteRelatedDraftById(id: string) {
    setRelatedDrafts((prev) => prev.filter((draft) => draft.id !== id));
  }

  return (
    <div style={{ padding: "3.5rem", maxWidth: "700px", margin: "0 auto" }}>
      <h2>Add someone important</h2>

      <p style={{ marginTop: "1.25rem", color: "var(--muted)" }}>
        This stays private — just for you.
      </p>

      <div style={{ marginTop: "2.25rem", maxWidth: "520px" }}>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          Details
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenRow(openRow === "name" ? null : "name")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenRow(openRow === "name" ? null : "name");
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
          <div style={{ color: "var(--ink)" }}>Name</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>
            {name.trim() ? name.trim() : "Required"}
          </div>
        </div>

        {openRow === "name" ? (
          <div style={{ marginTop: "0.75rem" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
              onBlur={() => setOpenRow(null)}
            />
          </div>
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenRow(openRow === "phone" ? null : "phone")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenRow(openRow === "phone" ? null : "phone");
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
          <div style={{ color: "var(--ink)" }}>Phone</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>
            Optional
          </div>
        </div>

        {openRow === "phone" ? (
          <div style={{ marginTop: "0.75rem" }}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
              onBlur={() => setOpenRow(null)}
            />
            <div style={{ marginTop: "0.35rem", color: "var(--muted)", fontSize: "0.85rem" }}>
              Used for reminder texts
            </div>
          </div>
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenRow(openRow === "family" ? null : "family")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenRow(openRow === "family" ? null : "family");
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
          <div style={{ color: "var(--ink)" }}>Family</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>
            {hasKids ? (children.length ? `${children.length} ${children.length === 1 ? "child" : "children"}` : "Has kids") : "Optional"}
          </div>
        </div>

        {openRow === "family" ? (
          <div style={{ marginTop: "0.9rem", display: "grid", gap: "1.15rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "var(--ink)" }}>
              <input
                type="checkbox"
                checked={hasKids}
                onChange={(e) => setHasKids(e.target.checked)}
              />
              Has kids
            </label>

            {hasKids ? (
              <div style={{ display: "grid", gap: "0.65rem" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Parent role</div>
                <select
                  value={parentRole ?? "parent"}
                  onChange={(e) => setParentRole(e.target.value as Person["parentRole"])}
                  style={{ width: "100%", padding: "0.65rem 0.75rem", borderRadius: "12px" }}
                >
                  <option value="parent">Parent</option>
                  <option value="mother">Mother</option>
                  <option value="father">Father</option>
                </select>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "0.45rem" }}>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Religion / culture</div>
              <select
                value={religionCulture ?? ""}
                onChange={(e) => setReligionCulture((e.target.value as Person["religionCulture"]) || "")}
                style={{ width: "100%", padding: "0.65rem 0.75rem", borderRadius: "12px" }}
              >
                <option value="">Optional</option>
                <option value="christian">Christian</option>
                <option value="orthodox">Orthodox</option>
                <option value="jewish">Jewish</option>
                <option value="muslim">Muslim</option>
                <option value="none">None</option>
              </select>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                Helps surface holidays like Easter, Hanukkah, or Ramadan.
              </div>
            </div>

            {hasKids ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Children</div>

                {children.length ? (
                  <div style={{ display: "grid", gap: "1rem" }}>
                    {children.map((child, idx) => (
                      <div
                        key={child.id}
                        style={{
                          border: "1px solid rgba(27, 42, 65, 0.18)",
                          borderRadius: "14px",
                          padding: "0.85rem 0.95rem",
                          background: "rgba(249,246,241,0.45)",
                        }}
                      >
                        <input
                          value={child.name ?? ""}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setChildren((prev) =>
                              prev.map((c, pIdx) => (pIdx === idx ? { ...c, name: nextName } : c))
                            );
                          }}
                          placeholder="Child name (optional)"
                          style={{
                            padding: "0.55rem 0",
                            fontSize: "1rem",
                            width: "100%",
                            color: "var(--ink)",
                          }}
                        />

                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            const draft = toDraftFromIso(child.birthday ?? child.birthdate ?? "");
                            setChildEditingIndex(idx);
                            setChildDraftMonthDay(draft.monthDay);
                            setChildDraftYear(draft.year);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              const draft = toDraftFromIso(child.birthday ?? child.birthdate ?? "");
                              setChildEditingIndex(idx);
                              setChildDraftMonthDay(draft.monthDay);
                              setChildDraftYear(draft.year);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            justifyContent: "space-between",
                            padding: "0.65rem 0 0.35rem",
                            cursor: "pointer",
                            gap: "1rem",
                          }}
                        >
                          <div style={{ color: "var(--ink)" }}>Birthday</div>
                          <div style={{ color: "var(--muted)", textAlign: "right" }}>
                            {child.birthday || child.birthdate ? formatMomentDate(child.birthday ?? child.birthdate ?? "") : "Select date"}
                          </div>
                        </div>

                        <button
                          onClick={() => setChildren((prev) => prev.filter((_, pIdx) => pIdx !== idx))}
                          style={{
                            padding: 0,
                            border: "none",
                            background: "none",
                            color: "var(--muted)",
                            cursor: "pointer",
                            fontSize: "0.88rem",
                            textDecoration: "underline",
                            textUnderlineOffset: "3px",
                            marginTop: "0.4rem",
                          }}
                        >
                          Remove child
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <button
                  onClick={() =>
                    setChildren((prev) => [
                      ...prev,
                      { id: makeId(), name: "", birthday: "" },
                    ])
                  }
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "8px",
                    padding: "0.55rem 0.95rem",
                    fontSize: "0.95rem",
                  }}
                >
                  + Add child
                </button>
              </div>
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
                  if (!iso) return;
                  setChildren((prev) =>
                    prev.map((c, idx) => (idx === childEditingIndex ? { ...c, birthday: iso, birthdate: undefined } : c))
                  );
                  setChildEditingIndex(null);
                }}
                onCancel={() => setChildEditingIndex(null)}
                onClear={() => {
                  setChildren((prev) =>
                    prev.map((c, idx) => (idx === childEditingIndex ? { ...c, birthday: "", birthdate: undefined } : c))
                  );
                  setChildDraftMonthDay("");
                  setChildDraftYear("");
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: "2.25rem", maxWidth: "520px" }}>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          Moments
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (openRow === "birthday") {
              setOpenRow(null);
              return;
            }
            setBirthdayDraftMonthDay(birthdayMonthDay);
            setBirthdayDraftYear(birthdayYear);
            setOpenRow("birthday");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (openRow === "birthday") {
                setOpenRow(null);
                return;
              }
              setBirthdayDraftMonthDay(birthdayMonthDay);
              setBirthdayDraftYear(birthdayYear);
              setOpenRow("birthday");
            }
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
	          <div style={{ color: "var(--ink)" }}>Birthday</div>
	          <div style={{ color: "var(--muted)", textAlign: "right" }}>
	            {birthdayMonthDay ? formatMomentDate(buildBirthdayIso(birthdayMonthDay, birthdayYear)) : "Select date"}
	          </div>
	        </div>

        {openRow === "birthday" ? (
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
              setBirthdayMonthDay(birthdayDraftMonthDay);
              setBirthdayYear(birthdayDraftYear);
              setOpenRow(null);
            }}
            onCancel={() => setOpenRow(null)}
            onClear={() => {
              setBirthdayDraftMonthDay("");
              setBirthdayDraftYear("");
            }}
          />
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            if (openRow === "anniversary") {
              setOpenRow(null);
              return;
            }
            const draft = toDraftFromIso(anniversary);
            setAnniversaryDraftMonthDay(draft.monthDay);
            setAnniversaryDraftYear(draft.year);
            setOpenRow("anniversary");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              if (openRow === "anniversary") {
                setOpenRow(null);
              } else {
                const draft = toDraftFromIso(anniversary);
                setAnniversaryDraftMonthDay(draft.monthDay);
                setAnniversaryDraftYear(draft.year);
                setOpenRow("anniversary");
              }
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
          <div style={{ color: "var(--ink)" }}>Anniversary</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>
            {anniversary ? formatMomentDate(anniversary) : "Select date"}
          </div>
        </div>

        {openRow === "anniversary" ? (
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
              const iso = buildMomentIso(anniversaryDraftMonthDay, anniversaryDraftYear, true);
              if (!iso) return;
              setAnniversary(iso);
              setOpenRow(null);
            }}
            onCancel={() => setOpenRow(null)}
            onClear={() => {
              setAnniversaryDraftMonthDay("");
              setAnniversaryDraftYear("");
            }}
          />
        ) : null}

        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenRow(openRow === "custom" ? null : "custom")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenRow(openRow === "custom" ? null : "custom");
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
          <div style={{ color: "var(--ink)" }}>Add custom moment</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>
            Add
          </div>
        </div>

        {openRow === "custom" ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "1rem" }}>
            <input
              value={customMomentTitle}
              onChange={(e) => setCustomMomentTitle(e.target.value)}
              placeholder="Title"
              autoFocus
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
            />
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                const draft = toDraftFromIso(customMomentDate);
                setCustomDraftMonthDay(draft.monthDay);
                setCustomDraftYear(draft.year);
                setIsCustomDatePickerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  const draft = toDraftFromIso(customMomentDate);
                  setCustomDraftMonthDay(draft.monthDay);
                  setCustomDraftYear(draft.year);
                  setIsCustomDatePickerOpen(true);
                }
              }}
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                padding: "0.75rem 0",
                cursor: "pointer",
                borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
                gap: "1rem",
              }}
            >
              <div style={{ color: "var(--ink)" }}>Date</div>
              <div style={{ color: "var(--muted)", textAlign: "right" }}>
                {customMomentDate ? formatMomentDate(customMomentDate) : "Select date"}
              </div>
            </div>
            <MomentDatePicker
              isOpen={isCustomDatePickerOpen}
              title="Custom moment"
              mode="custom"
              monthDay={customDraftMonthDay}
              setMonthDay={setCustomDraftMonthDay}
              year={customDraftYear}
              setYear={setCustomDraftYear}
              yearHelperText="Optional."
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
              }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                onClick={handleSaveCustomMoment}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "var(--ink)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Done
              </button>
              <button
                onClick={() => {
                  setCustomMomentTitle("");
                  setCustomMomentDate("");
                  setCustomDraftMonthDay("");
                  setCustomDraftYear("");
                  setIsCustomDatePickerOpen(false);
                  setOpenRow(null);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {customMoments.length ? (
          <div style={{ marginTop: "0.75rem" }}>
            {customMoments.map((moment, idx) => (
              <div key={`${moment.title}-${moment.date}-${idx}`}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    padding: "0.5rem 0",
                    gap: "1rem",
                  }}
                >
                  <div style={{ color: "var(--muted)", minWidth: 0 }}>{moment.title}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexShrink: 0 }}>
                    <div style={{ color: "var(--muted)", textAlign: "right" }}>
                      {formatDate(moment.date)}
                    </div>
                    <button
                      onClick={() => startEditingCustomMoment(idx)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: "var(--muted)",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        textAlign: "right",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCustomMomentByIndex(idx)}
                      style={{
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: "var(--muted)",
                        fontSize: "0.9rem",
                        cursor: "pointer",
                        textAlign: "right",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingCustomMomentIndex === idx ? (
                  <div style={{ marginTop: "0.75rem", display: "grid", gap: "1rem" }}>
                    <input
                      value={editingCustomMomentTitle}
                      onChange={(e) => setEditingCustomMomentTitle(e.target.value)}
                      placeholder="Title"
                      autoFocus
                      style={{
                        padding: "0.75rem 0",
                        fontSize: "1rem",
                        width: "100%",
                        color: "var(--ink)",
                      }}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        const draft = toDraftFromIso(editingCustomMomentDate);
                        setEditingCustomDraftMonthDay(draft.monthDay);
                        setEditingCustomDraftYear(draft.year);
                        setIsEditingCustomDatePickerOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          const draft = toDraftFromIso(editingCustomMomentDate);
                          setEditingCustomDraftMonthDay(draft.monthDay);
                          setEditingCustomDraftYear(draft.year);
                          setIsEditingCustomDatePickerOpen(true);
                        }
                      }}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        padding: "0.75rem 0",
                        cursor: "pointer",
                        borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ color: "var(--ink)" }}>Date</div>
                      <div style={{ color: "var(--muted)", textAlign: "right" }}>
                        {editingCustomMomentDate ? formatMomentDate(editingCustomMomentDate) : "Select date"}
                      </div>
                    </div>
                    <MomentDatePicker
                      isOpen={isEditingCustomDatePickerOpen}
                      title="Custom moment"
                      mode="custom"
                      monthDay={editingCustomDraftMonthDay}
                      setMonthDay={setEditingCustomDraftMonthDay}
                      year={editingCustomDraftYear}
                      setYear={setEditingCustomDraftYear}
                      yearHelperText="Optional."
                      onSave={() => {
                        const iso = buildMomentIso(editingCustomDraftMonthDay, editingCustomDraftYear, false);
                        if (!iso) return;
                        setEditingCustomMomentDate(iso);
                        setIsEditingCustomDatePickerOpen(false);
                      }}
                      onCancel={() => setIsEditingCustomDatePickerOpen(false)}
                      onClear={() => {
                        setEditingCustomDraftMonthDay("");
                        setEditingCustomDraftYear("");
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <button
                        onClick={handleUpdateCustomMoment}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "none",
                          color: "var(--ink)",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        Done
                      </button>
                      <button
                        onClick={() => {
                          setEditingCustomMomentIndex(null);
                          setEditingCustomMomentTitle("");
                          setEditingCustomMomentDate("");
                          setEditingCustomDraftMonthDay("");
                          setEditingCustomDraftYear("");
                          setIsEditingCustomDatePickerOpen(false);
                        }}
                        style={{
                          padding: 0,
                          border: "none",
                          background: "none",
                          color: "var(--muted)",
                          fontSize: "0.9rem",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: "2.25rem", maxWidth: "520px" }}>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          Related people
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenRow(openRow === "related" ? null : "related")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenRow(openRow === "related" ? null : "related");
          }}
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "0.75rem 0",
            cursor: "pointer",
            borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
            gap: "1rem",
          }}
        >
          <div style={{ color: "var(--ink)" }}>Add related person</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>Add</div>
        </div>

        {openRow === "related" ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "1rem" }}>
            <input
              list="related-people"
              value={relatedName}
              onChange={(e) => setRelatedName(e.target.value)}
              placeholder="Name"
              autoFocus
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
            />
            <datalist id="related-people">
              {people.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
              {createdRelatedPeople.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <select
              value={relatedType}
              onChange={(e) => setRelatedType(e.target.value as RelationshipType)}
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                maxWidth: "240px",
                color: "var(--ink)",
                background: "transparent",
              }}
            >
              <option value="partner">partner</option>
              <option value="child">child</option>
              <option value="parent">parent</option>
              <option value="sibling">sibling</option>
              <option value="friend">friend</option>
              <option value="other">other</option>
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <button
                onClick={handleAddRelatedPerson}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "var(--ink)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Done
              </button>
              <button
                onClick={() => {
                  setRelatedName("");
                  setRelatedType("child");
                  setOpenRow(null);
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {relatedDrafts.length ? (
          <div style={{ marginTop: "0.75rem" }}>
            {relatedDrafts.map((draft) => (
              <div
                key={draft.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  padding: "0.5rem 0",
                  gap: "1rem",
                }}
              >
                <div style={{ color: "var(--muted)", minWidth: 0 }}>{draft.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexShrink: 0 }}>
                  <div style={{ color: "var(--muted)", textAlign: "right" }}>{draft.type}</div>
                  <button
                    onClick={() => deleteRelatedDraftById(draft.id)}
                    style={{
                      padding: 0,
                      border: "none",
                      background: "none",
                      color: "var(--muted)",
                      fontSize: "0.9rem",
                      cursor: "pointer",
                      textAlign: "right",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: "2.25rem", display: "flex", gap: "1rem" }}>
        <button
          onClick={handleSave}
          style={{
            padding: "0.75rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Save
        </button>

        <button
          onClick={onBack}
          style={{
            padding: "0.75rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
