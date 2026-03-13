import { useEffect, useRef, useState } from "react";
import type { Child, Moment, Person } from "../models/Person";
import type { Relationship, RelationshipType } from "../models/Relationship";
import MomentDatePicker from "../components/MomentDatePicker";
import { useAppState } from "../appState";
import { useLocation, useNavigate } from "../router";
import { normalizePhone } from "../utils/phone";
import { parseLocalDate } from "../utils/date";

export default function AddPerson() {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, savePerson } = useAppState();

  const editPersonId =
    (location.state as any)?.personId ?? (location.state as any)?.editPersonId ?? null;
  const editingPerson =
    (editPersonId ? people.find((p) => p.id === editPersonId) : null) ??
    ((location.state as any)?.person as Person | undefined) ??
    null;
  const [name, setName] = useState("");
  const [birthdayMonthDay, setBirthdayMonthDay] = useState("");
  const [birthdayYear, setBirthdayYear] = useState("");
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerBirthdayMonthDay, setPartnerBirthdayMonthDay] = useState("");
  const [partnerBirthdayYear, setPartnerBirthdayYear] = useState("");
  const [partnerDraftMonthDay, setPartnerDraftMonthDay] = useState("");
  const [partnerDraftYear, setPartnerDraftYear] = useState("");
  const [isPartnerDatePickerOpen, setIsPartnerDatePickerOpen] = useState(false);
  const [anniversary, setAnniversary] = useState(""); // MM-DD
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");
  const [phone, setPhone] = useState(editingPerson?.phone || "");
  const [phoneError, setPhoneError] = useState(false);
  const [hasKids, setHasKids] = useState(false);
  const [parentRole, setParentRole] = useState<Person["parentRole"]>("parent");
  const [religionCulture, setReligionCulture] = useState<NonNullable<Person["religionCulture"]>>([]);
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
  const [relatedPhone, setRelatedPhone] = useState("");
  const [relatedBirthdayMonthDay, setRelatedBirthdayMonthDay] = useState("");
  const [relatedBirthdayYear, setRelatedBirthdayYear] = useState("");
  const [relatedDraftMonthDay, setRelatedDraftMonthDay] = useState("");
  const [relatedDraftYear, setRelatedDraftYear] = useState("");
  const [isRelatedDatePickerOpen, setIsRelatedDatePickerOpen] = useState(false);
  const [relatedType, setRelatedType] = useState<RelationshipType>("child");
  const [openRow, setOpenRow] = useState<
    "name" | "phone" | "partner" | "family" | "birthday" | "anniversary" | "custom" | "related" | null
  >(null);

  const lastPrefilledPersonIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only prefill when entering edit mode (or switching which person is being edited).
    if (!editingPerson?.id) {
      lastPrefilledPersonIdRef.current = null;
      return;
    }
    if (lastPrefilledPersonIdRef.current === editingPerson.id) return;
    lastPrefilledPersonIdRef.current = editingPerson.id;
    setName(editingPerson.name || "");
    setPhone(editingPerson.phone || "");
    const birthdayMoment = (editingPerson.moments ?? []).find((m) => m.type === "birthday") ?? null;
    const birthdayDraft = birthdayMoment?.date ? toDraftFromIso(birthdayMoment.date) : { monthDay: "", year: "" };
    setBirthdayMonthDay(birthdayDraft.monthDay);
    setBirthdayYear(birthdayDraft.year);

    const anniversaryValue = (editingPerson.anniversary ?? "").trim();
    setAnniversary(anniversaryValue);
    const anniversaryDraft = anniversaryValue ? toDraftFromIso(`0000-${anniversaryValue}`) : { monthDay: "", year: "" };
    setAnniversaryDraftMonthDay(anniversaryDraft.monthDay);
    setAnniversaryDraftYear("");

    setPartnerId(editingPerson.partnerId ?? null);
    setPartnerSearch(editingPerson.partnerId ? people.find((p) => p.id === editingPerson.partnerId)?.name ?? "" : "");
    setPartnerBirthdayMonthDay("");
    setPartnerBirthdayYear("");

    setHasKids(Boolean(editingPerson.hasKids || (editingPerson.children?.length ?? 0) > 0));
    setParentRole(editingPerson.parentRole ?? "parent");
    setReligionCulture(Array.isArray(editingPerson.religionCulture) ? editingPerson.religionCulture : []);
    setChildren(editingPerson.children ?? []);
    setCustomMoments(
      (editingPerson.moments ?? [])
        .filter((moment) => moment.type === "custom")
        .map((moment) => ({ title: moment.label, date: moment.date }))
    );
    setCreatedRelatedPeople([]);
    setRelatedDrafts([]);
  }, [editingPerson?.id]);

  const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
  const dateWithYearFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  function formatDate(value: string) {
    if (!value) return "";
    const parsed = parseLocalDate(value);
    if (!parsed) return value;
    return dateFormatter.format(parsed);
  }

  function formatMonthDay(value: string) {
    const trimmed = value.trim();
    const parts = trimmed.split("-");
    if (parts.length !== 2) return value;
    const m = Number(parts[0]);
    const d = Number(parts[1]);
    if (!m || !d || Number.isNaN(m) || Number.isNaN(d)) return value;
    const parsed = new Date(2000, m - 1, d);
    if (Number.isNaN(parsed.getTime())) return value;
    if (parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return value;
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

  const firstName = (name.trim().split(" ")[0] || "this person").trim();

  function toggleReligionCulture(value: NonNullable<Person["religionCulture"]>[number]) {
    setReligionCulture((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);

      if (value === "none") {
        return next.has("none") ? ["none"] : [];
      }

      // Selecting anything else clears "none".
      next.delete("none");
      return Array.from(next);
    });
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

  function monthDayFromDraft(value: string) {
    const parts = parseYmd(value);
    if (!parts) return "";
    const mm = String(parts.m).padStart(2, "0");
    const dd = String(parts.d).padStart(2, "0");
    return `${mm}-${dd}`;
  }

  function handleSave() {
    if (!name.trim()) return;

    const normalizedPhone = phone.trim() ? normalizePhone(phone) : null;
    if (phone.trim() && !normalizedPhone) {
      setPhoneError(true);
      setOpenRow("phone");
      return;
    }

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
        date: `0000-${anniversary}`,
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

    const personId = editingPerson?.id ?? makeId();
    let resolvedPartnerId = partnerId || null;
    const createdPeople: Person[] = [...createdRelatedPeople];
    const createdRelationships: Relationship[] = [...relatedDrafts.map((draft) => ({
      id: makeId(),
      fromId: personId,
      toId: draft.toId,
      type: draft.type,
    }))];

    if (!resolvedPartnerId && partnerSearch.trim()) {
      const partnerBirthdayIso = buildBirthdayIso(partnerBirthdayMonthDay, partnerBirthdayYear);
      const createdPartner: Person = {
        id: makeId(),
        name: partnerSearch.trim(),
        moments: partnerBirthdayIso
          ? [
              {
                id: makeId(),
                type: "birthday",
                label: "Birthday",
                date: partnerBirthdayIso,
                recurring: true,
              },
            ]
          : [],
        partnerId: personId,
      };
      createdPeople.push(createdPartner);
      createdRelationships.push({
        id: makeId(),
        fromId: personId,
        toId: createdPartner.id,
        type: "partner",
      });
      resolvedPartnerId = createdPartner.id;
    } else if (resolvedPartnerId) {
      createdRelationships.push({
        id: makeId(),
        fromId: personId,
        toId: resolvedPartnerId,
        type: "partner",
      });
    }

    const person: Person = {
      ...(editingPerson ?? {}),
      id: personId,
      name: name.trim(),
      phone: normalizedPhone || undefined,
      moments,
      partnerId: resolvedPartnerId || undefined,
      anniversary: anniversary || undefined,
      hasKids: hasKids || (children.length ? true : undefined),
      parentRole: hasKids ? parentRole : undefined,
      religionCulture: religionCulture.length ? religionCulture : undefined,
      children: hasKids ? children : undefined,
      importantDates: moments.filter((m) => m.type === "custom"),
    };

    savePerson({
      person,
      createdPeople,
      createdRelationships,
    });
    navigate("/home", {
      state: {
        defaultTab: "home",
        ...(resolvedPartnerId ? { showPartnerLinkCheck: person.id } : null),
      },
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

    const normalizedRelatedPhone = relatedPhone.trim() ? normalizePhone(relatedPhone) : null;
    const relatedBirthdayIso = buildBirthdayIso(relatedBirthdayMonthDay, relatedBirthdayYear);
    const normalized = typedName.toLowerCase();
    const canReuseExisting = !normalizedRelatedPhone && !relatedBirthdayIso;
    const existing = canReuseExisting
      ? people.find((p) => p.name.trim().toLowerCase() === normalized) ??
        createdRelatedPeople.find((p) => p.name.trim().toLowerCase() === normalized) ??
        null
      : null;

    let relatedPerson = existing;
    if (!relatedPerson) {
      relatedPerson = {
        id: makeId(),
        name: typedName,
        phone: normalizedRelatedPhone || undefined,
        moments: relatedBirthdayIso
          ? [
              {
                id: makeId(),
                type: "birthday",
                label: "Birthday",
                date: relatedBirthdayIso,
                recurring: true,
              },
            ]
          : [],
      };
      setCreatedRelatedPeople((prev) => [...prev, relatedPerson!]);
    }

    setRelatedDrafts((prev) => [
      ...prev,
      { id: makeId(), toId: relatedPerson!.id, name: relatedPerson!.name, type: relatedType },
    ]);
    setRelatedName("");
    setRelatedPhone("");
    setRelatedBirthdayMonthDay("");
    setRelatedBirthdayYear("");
    setRelatedType("child");
    setOpenRow(null);
  }

  function deleteRelatedDraftById(id: string) {
    setRelatedDrafts((prev) => prev.filter((draft) => draft.id !== id));
  }

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", height: "100vh" }}>
      <div
        style={{
          height: "100%",
          overflowY: "auto",
          padding: "calc(env(safe-area-inset-top) + 32px) 16px 16px 16px",
          boxSizing: "border-box",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      <h2 style={{ marginTop: 0, fontSize: "30px", fontWeight: 600, fontFamily: "var(--font-serif)", letterSpacing: "-0.02em" }}>Add someone important.</h2>

      <p style={{ marginTop: "1.25rem", color: "var(--muted)", fontSize: "16px" }}>
        Add what you know. You can always edit later.
      </p>

      <div style={{ marginTop: "1.5rem", maxWidth: "520px" }}>
        <div style={{ color: "var(--ink)", fontSize: "20px", fontWeight: 500, marginBottom: "12px" }}>
          Basic Info
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
	            {phone.trim() ? phone.trim() : "Optional"}
	          </div>
	        </div>

        {openRow === "phone" ? (
          <div style={{ marginTop: "0.75rem" }}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const next = e.target.value;
                setPhone(next);
                if (!next.trim()) setPhoneError(false);
                else if (normalizePhone(next)) setPhoneError(false);
              }}
              autoFocus
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
              onBlur={() => setOpenRow(null)}
            />
            {phoneError ? (
              <div style={{ marginTop: "0.35rem", color: "#b42318", fontSize: "0.85rem" }}>
                Enter a valid phone number.
              </div>
            ) : null}
            <div style={{ marginTop: "0.35rem", color: "var(--muted)", fontSize: "0.85rem" }}>
              Used for reminder texts
            </div>
          </div>
        ) : null}

      </div>

      <div style={{ marginTop: "1.5rem", maxWidth: "520px" }}>
        <div style={{ color: "var(--ink)", fontSize: "20px", fontWeight: 500, marginBottom: "12px" }}>
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
            const draft = anniversary ? toDraftFromIso(`0000-${anniversary}`) : { monthDay: "", year: "" };
            setAnniversaryDraftMonthDay(draft.monthDay);
            setAnniversaryDraftYear("");
            setOpenRow("anniversary");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              if (openRow === "anniversary") {
                setOpenRow(null);
              } else {
                const draft = anniversary ? toDraftFromIso(`0000-${anniversary}`) : { monthDay: "", year: "" };
                setAnniversaryDraftMonthDay(draft.monthDay);
                setAnniversaryDraftYear("");
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
            {anniversary ? formatMonthDay(anniversary) : "Select date"}
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
            yearHelperText=""
            requireYear={false}
            onSave={() => {
              const mmdd = monthDayFromDraft(anniversaryDraftMonthDay);
              if (!mmdd) return;
              setAnniversary(mmdd);
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
          <div style={{ color: "var(--muted)", fontSize: "16px", fontWeight: 500 }}>
            Anything else you want to remember? (optional)
          </div>
          <div
            aria-hidden="true"
            style={{
              color: "var(--muted)",
              textAlign: "right",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transform: openRow === "custom" ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 160ms ease",
                fontSize: "0.95rem",
                lineHeight: 1,
              }}
            >
              ▾
            </span>
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

      <div style={{ marginTop: "1.5rem", maxWidth: "520px" }}>
        <div style={{ color: "var(--ink)", fontSize: "20px", fontWeight: 500, marginBottom: "12px" }}>
          Connections
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5, marginBottom: "12px" }}>
          Add people connected to this person (partner, child, or family member).
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpenRow(openRow === "partner" ? null : "partner")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setOpenRow(openRow === "partner" ? null : "partner");
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
          <div style={{ color: "var(--ink)" }}>Partner</div>
          <div style={{ color: "var(--muted)", textAlign: "right" }}>
            {partnerId ? (people.find((p) => p.id === partnerId)?.name ?? "Selected") : "Optional"}
          </div>
        </div>

        {openRow === "partner" ? (
          <div style={{ marginTop: "0.85rem", display: "grid", gap: "0.85rem" }}>
            <input
              value={partnerSearch}
              onChange={(e) => setPartnerSearch(e.target.value)}
              placeholder="Find or enter a partner name…"
              autoFocus
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
            />

            <div style={{ display: "grid", gap: "0.5rem" }}>
              {people
                .filter((p) => p.name.toLowerCase().includes(partnerSearch.trim().toLowerCase()))
                .slice(0, 8)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPartnerId(p.id);
                      setPartnerBirthdayMonthDay("");
                      setPartnerBirthdayYear("");
                      setOpenRow(null);
                      setPartnerSearch("");
                    }}
                    style={{
                      border: "1px solid rgba(27, 42, 65, 0.18)",
                      borderRadius: "12px",
                      background: "rgba(249,246,241,0.45)",
                      padding: "0.7rem 0.9rem",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "var(--ink)",
                      fontWeight: 500,
                    }}
                  >
                    {p.name}
                  </button>
                ))}
            </div>

            {!partnerId && partnerSearch.trim() ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  const draft = partnerBirthdayMonthDay
                    ? { monthDay: partnerBirthdayMonthDay, year: partnerBirthdayYear }
                    : { monthDay: "", year: "" };
                  setPartnerDraftMonthDay(draft.monthDay);
                  setPartnerDraftYear(draft.year);
                  setIsPartnerDatePickerOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    const draft = partnerBirthdayMonthDay
                      ? { monthDay: partnerBirthdayMonthDay, year: partnerBirthdayYear }
                      : { monthDay: "", year: "" };
                    setPartnerDraftMonthDay(draft.monthDay);
                    setPartnerDraftYear(draft.year);
                    setIsPartnerDatePickerOpen(true);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  padding: "0.65rem 0",
                  cursor: "pointer",
                  borderBottom: "1px solid rgba(27, 42, 65, 0.22)",
                  gap: "1rem",
                }}
              >
                <div style={{ color: "var(--ink)" }}>Birthday</div>
                <div style={{ color: "var(--muted)", textAlign: "right" }}>
                  {partnerBirthdayMonthDay ? formatMomentDate(buildBirthdayIso(partnerBirthdayMonthDay, partnerBirthdayYear)) : "Optional"}
                </div>
              </div>
            ) : null}

            {partnerId ? (
              <button
                type="button"
                onClick={() => {
                  setPartnerId(null);
                  setPartnerSearch("");
                  setPartnerBirthdayMonthDay("");
                  setPartnerBirthdayYear("");
                }}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                  justifySelf: "start",
                }}
              >
                Clear partner
              </button>
            ) : null}

            <MomentDatePicker
              isOpen={isPartnerDatePickerOpen}
              title="Partner birthday"
              mode="birthday"
              monthDay={partnerDraftMonthDay}
              setMonthDay={setPartnerDraftMonthDay}
              year={partnerDraftYear}
              setYear={setPartnerDraftYear}
              yearHelperText="Optional."
              onSave={() => {
                setPartnerBirthdayMonthDay(partnerDraftMonthDay);
                setPartnerBirthdayYear(partnerDraftYear);
                setIsPartnerDatePickerOpen(false);
              }}
              onCancel={() => setIsPartnerDatePickerOpen(false)}
              onClear={() => {
                setPartnerDraftMonthDay("");
                setPartnerDraftYear("");
                setPartnerBirthdayMonthDay("");
                setPartnerBirthdayYear("");
              }}
            />
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
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                Holidays to remember for {firstName}
              </div>
              <div style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Choose any that apply.</div>

              <div style={{ display: "grid", gap: "0.6rem", marginTop: "4px" }}>
                {(
                  [
                    { id: "christian", label: "Christian" },
                    { id: "orthodox", label: "Orthodox" },
                    { id: "jewish", label: "Jewish" },
                    { id: "muslim", label: "Muslim" },
                    { id: "none", label: "None" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.id}
                    style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "var(--ink)" }}
                  >
                    <input
                      type="checkbox"
                      checked={religionCulture.includes(opt.id)}
                      onChange={() => toggleReligionCulture(opt.id)}
                    />
                    {opt.label}
                  </label>
                ))}
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
                    borderRadius: "12px",
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

        <button
          type="button"
          onClick={() => setOpenRow(openRow === "related" ? null : "related")}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.85rem 1rem",
            cursor: "pointer",
            border: "1px solid rgba(27, 42, 65, 0.22)",
            borderRadius: "12px",
            background: "transparent",
            gap: "1rem",
            color: "var(--ink)",
            textAlign: "left",
            fontSize: "1rem",
          }}
        >
          <span>Add connection</span>
          <span style={{ color: "var(--muted)" }}>{openRow === "related" ? "Hide" : "Open"}</span>
        </button>

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
            <input
              type="tel"
              value={relatedPhone}
              onChange={(e) => setRelatedPhone(e.target.value)}
              placeholder="Phone (optional)"
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
                setRelatedDraftMonthDay(relatedBirthdayMonthDay);
                setRelatedDraftYear(relatedBirthdayYear);
                setIsRelatedDatePickerOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setRelatedDraftMonthDay(relatedBirthdayMonthDay);
                  setRelatedDraftYear(relatedBirthdayYear);
                  setIsRelatedDatePickerOpen(true);
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
                {relatedBirthdayMonthDay ? formatMomentDate(buildBirthdayIso(relatedBirthdayMonthDay, relatedBirthdayYear)) : "Optional"}
              </div>
            </div>
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
                  setRelatedPhone("");
                  setRelatedBirthdayMonthDay("");
                  setRelatedBirthdayYear("");
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
            <MomentDatePicker
              isOpen={isRelatedDatePickerOpen}
              title="Connection birthday"
              mode="birthday"
              monthDay={relatedDraftMonthDay}
              setMonthDay={setRelatedDraftMonthDay}
              year={relatedDraftYear}
              setYear={setRelatedDraftYear}
              yearHelperText="Optional."
              onSave={() => {
                setRelatedBirthdayMonthDay(relatedDraftMonthDay);
                setRelatedBirthdayYear(relatedDraftYear);
                setIsRelatedDatePickerOpen(false);
              }}
              onCancel={() => setIsRelatedDatePickerOpen(false)}
              onClear={() => {
                setRelatedDraftMonthDay("");
                setRelatedDraftYear("");
                setRelatedBirthdayMonthDay("");
                setRelatedBirthdayYear("");
              }}
            />
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
          onClick={() => navigate("/home")}
          style={{
            padding: "0.75rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
        </div>
      </div>
    </div>
  );
}
