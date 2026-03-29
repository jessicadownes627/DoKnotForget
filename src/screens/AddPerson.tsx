import { useEffect, useRef, useState } from "react";
import type { Moment, Person } from "../models/Person";
import type { Relationship, RelationshipType } from "../models/Relationship";
import MomentDatePicker from "../components/MomentDatePicker";
import ContactsSearchResults from "../components/ContactsSearchResults";
import { useAppState } from "../appState";
import { useLocation, useNavigate } from "../router";
import { normalizePhone } from "../utils/phone";
import { parseLocalDate } from "../utils/date";
import { getSelectedHolidays } from "../utils/personHolidays";
import { wouldExceedFreePeopleLimit } from "../utils/freeLimit";

const FREE_LIMIT = 3;

function CircleOrbitGraphic() {
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

export default function AddPerson() {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, isPremium, savePerson } = useAppState();
  const saveFeedbackHideTimeoutRef = useRef<number | null>(null);
  const saveFeedbackNavigateTimeoutRef = useRef<number | null>(null);

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
  const [anniversary, setAnniversary] = useState(""); // MM-DD
  const [anniversaryDraftMonthDay, setAnniversaryDraftMonthDay] = useState("");
  const [anniversaryDraftYear, setAnniversaryDraftYear] = useState("");
  const [phone, setPhone] = useState(editingPerson?.phone || "");
  const [phoneError, setPhoneError] = useState(false);
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
  const [relatedDrafts, setRelatedDrafts] = useState<
    Array<{ id: string; toId: string; name: string; type: RelationshipType }>
  >([]);
  const [relatedSearch, setRelatedSearch] = useState("");
  const [selectedRelatedPersonId, setSelectedRelatedPersonId] = useState("");
  const [relatedType, setRelatedType] = useState<RelationshipType>("child");
  const [openRow, setOpenRow] = useState<
    "name" | "phone" | "birthday" | "anniversary" | "custom" | "related" | null
  >(null);
  const [saveFeedbackName, setSaveFeedbackName] = useState("");
  const [isSaveFeedbackVisible, setIsSaveFeedbackVisible] = useState(false);

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

    setCustomMoments(
      (editingPerson.moments ?? [])
        .filter((moment) => moment.type === "custom")
        .map((moment) => ({ title: moment.label, date: moment.date }))
    );
    setRelatedDrafts([]);
  }, [editingPerson?.id]);

  useEffect(() => {
    return () => {
      if (saveFeedbackHideTimeoutRef.current !== null) window.clearTimeout(saveFeedbackHideTimeoutRef.current);
      if (saveFeedbackNavigateTimeoutRef.current !== null) window.clearTimeout(saveFeedbackNavigateTimeoutRef.current);
    };
  }, []);

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
    const linkedPartner = relatedDrafts.find((draft) => draft.type === "partner") ?? null;
    const resolvedPartnerId = linkedPartner?.toId ?? editingPerson?.partnerId ?? null;
    const createdPeople: Person[] = [];
    const createdRelationships: Relationship[] = [...relatedDrafts.map((draft) => ({
      id: makeId(),
      fromId: personId,
      toId: draft.toId,
      type: draft.type,
    }))];

    const person: Person = {
      ...(editingPerson ?? {}),
      id: personId,
      name: name.trim(),
      phone: normalizedPhone || undefined,
      moments,
      partnerId: resolvedPartnerId || undefined,
      anniversary: anniversary || undefined,
      hasKids: editingPerson?.hasKids,
      parentRole: editingPerson?.parentRole,
      selectedHolidays: editingPerson ? getSelectedHolidays(editingPerson) : undefined,
      children: editingPerson?.children,
      importantDates: moments.filter((m) => m.type === "custom"),
    };

    if (!editingPerson && !isPremium && (people.length >= FREE_LIMIT || wouldExceedFreePeopleLimit(people, [person]))) {
      console.log("PAYWALL TRIGGERED");
      navigate("/paywall", {
        state: {
          fallbackPath: "/home",
          source: "people-limit",
        },
      });
      return;
    }

    savePerson({
      person,
      createdPeople,
      createdRelationships,
    });
    if (editingPerson) {
      navigate("/home", {
        state: {
          defaultTab: "home",
          ...(linkedPartner ? { showPartnerLinkCheck: person.id } : null),
        },
      });
      return;
    }

    setSaveFeedbackName(person.name);
    setIsSaveFeedbackVisible(false);
    window.requestAnimationFrame(() => setIsSaveFeedbackVisible(true));
    if (saveFeedbackHideTimeoutRef.current !== null) window.clearTimeout(saveFeedbackHideTimeoutRef.current);
    if (saveFeedbackNavigateTimeoutRef.current !== null) window.clearTimeout(saveFeedbackNavigateTimeoutRef.current);
    saveFeedbackHideTimeoutRef.current = window.setTimeout(() => {
      setIsSaveFeedbackVisible(false);
    }, 1700);
    saveFeedbackNavigateTimeoutRef.current = window.setTimeout(() => {
      navigate("/home", {
        state: {
          defaultTab: "home",
          ...(linkedPartner ? { showPartnerLinkCheck: person.id } : null),
        },
      });
    }, 2200);
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
    const selectedPerson = people.find((person) => person.id === selectedRelatedPersonId) ?? null;
    if (!selectedPerson) return;

    if (relatedDrafts.some((draft) => draft.toId === selectedPerson.id && draft.type === relatedType)) return;

    setRelatedDrafts((prev) => [
      ...prev,
      { id: makeId(), toId: selectedPerson.id, name: selectedPerson.name, type: relatedType },
    ]);
    setSelectedRelatedPersonId("");
    setRelatedSearch("");
    setRelatedType("child");
    setOpenRow(null);
  }

  function deleteRelatedDraftById(id: string) {
    setRelatedDrafts((prev) => prev.filter((draft) => draft.id !== id));
  }

  const visibleConnectionPeople = people.filter((person) => {
    if (person.id === editingPerson?.id) return false;
    if (relatedDrafts.some((draft) => draft.toId === person.id)) return false;
    if (!relatedSearch.trim()) return true;
    return person.name.toLowerCase().includes(relatedSearch.trim().toLowerCase());
  });

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
          Connections (optional)
        </div>

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
          <span>+ Link to someone</span>
          <span style={{ color: "var(--muted)" }}>{openRow === "related" ? "Hide" : "Open"}</span>
        </button>

        {openRow === "related" ? (
          <div style={{ marginTop: "0.75rem", display: "grid", gap: "1rem" }}>
            <input
              value={relatedSearch}
              onChange={(e) => setRelatedSearch(e.target.value)}
              placeholder="Find someone..."
              autoFocus
              style={{
                padding: "0.75rem 0",
                fontSize: "1rem",
                width: "100%",
                color: "var(--ink)",
              }}
            />
            <ContactsSearchResults
              results={visibleConnectionPeople.slice(0, 8)}
              onSelect={(person) => {
                setSelectedRelatedPersonId(person.id);
                setRelatedSearch(person.name);
              }}
            />
            {selectedRelatedPersonId ? (
              <div style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
                Linking to {people.find((person) => person.id === selectedRelatedPersonId)?.name ?? "selected contact"}
              </div>
            ) : null}
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
                disabled={!selectedRelatedPersonId}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  color: "var(--ink)",
                  fontSize: "0.9rem",
                  cursor: "pointer",
                  textAlign: "left",
                  opacity: selectedRelatedPersonId ? 1 : 0.5,
                }}
              >
                Save connection
              </button>
              <button
                onClick={() => {
                  setSelectedRelatedPersonId("");
                  setRelatedSearch("");
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
          onClick={() => navigate("/home")}
          style={{
            padding: "0.75rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
      {saveFeedbackName ? (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: isSaveFeedbackVisible ? "scale(1)" : "scale(0.95)",
            opacity: isSaveFeedbackVisible ? 1 : 0,
            transition: "opacity 220ms ease, transform 220ms ease",
            pointerEvents: "none",
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: "grid",
              justifyItems: "center",
              gap: "16px",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <CircleOrbitGraphic />
            <div style={{ color: "var(--muted)", fontSize: "0.95rem", lineHeight: 1.4 }}>
              {`${saveFeedbackName.trim() || "Someone"} is now in your circle.`}
            </div>
          </div>
        </div>
      ) : null}
        </div>
      </div>
    </div>
  );
}
