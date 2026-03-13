import { useEffect, useMemo, useState } from "react";
import type { Person } from "../models/Person";
import type { Relationship } from "../models/Relationship";
import PersonEditDrawer from "../components/PersonEditDrawer";
import MomentDatePicker from "../components/MomentDatePicker";
import { useAppState } from "../appState";
import { useLocation, useNavigate, useParams } from "../router";
import { daysUntilDate, getNextBirthdayFromIso } from "../utils/birthdayUtils";
import { getNextAnniversary } from "../utils/anniversaryUtils";
import { getFathersDay, getMothersDay } from "../utils/holidayUtils";
import { RaisedGoldBullet, SoftGoldDot } from "../components/common/GoldBullets";
import SmartSuggestionCard from "../components/SmartSuggestionCard";
import { openSmsComposer } from "../components/SoonReminderCard";
import { generateCareSuggestions, type CareSuggestion } from "../utils/careSuggestions";
import { parseLocalDate } from "../utils/date";
import { normalizePhone } from "../utils/phone";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDate(value: string) {
  return parseLocalDate(value);
}

function timePhrase(daysUntil: number) {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
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

export default function PersonDetail({}: {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { people, relationships, savePerson, updatePerson, deletePerson } = useAppState();
  const person = people.find((p) => p.id === id) ?? null;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [suggestionsTick, setSuggestionsTick] = useState(0);
  const [isAddConnectionOpen, setIsAddConnectionOpen] = useState(false);
  const [connectionType, setConnectionType] = useState<"partner" | "child" | "grandchild" | "familyMember">("child");
  const [connectionName, setConnectionName] = useState("");
  const [connectionPhone, setConnectionPhone] = useState("");
  const [connectionPhoneError, setConnectionPhoneError] = useState(false);
  const [connectionBirthdayMonthDay, setConnectionBirthdayMonthDay] = useState("");
  const [connectionBirthdayYear, setConnectionBirthdayYear] = useState("");
  const [isConnectionBirthdayOpen, setIsConnectionBirthdayOpen] = useState(false);
  const today = useMemo(() => startOfDay(new Date()), []);

  useEffect(() => {
    if (!person) navigate("/home", { replace: true });
  }, [navigate, person]);

  if (!person) return null;

  const resolvedPerson = person;
  const partner = person.partnerId ? people.find((p) => p.id === person.partnerId) ?? null : null;
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

  function startOfTodayTimestamp() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function snoozeSuggestion(idToSnooze: string, days: number) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const nextAllowed = startOfTodayTimestamp() + days * msPerDay;
    try {
      window.localStorage.setItem(`doknotforget_snooze_${idToSnooze}`, String(nextAllowed));
    } catch {
      // ignore
    }
    setSuggestionsTick((v) => v + 1);
  }

  const personSuggestions = useMemo(() => {
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

    const suggestions = generateCareSuggestions([resolvedPerson], today);
    return suggestions
      .filter((s) => s.type !== "question")
      .filter((s) => !isSnoozed(s.id))
      .sort((a, b) => (a.sortDaysUntil - b.sortDaysUntil) || a.title.localeCompare(b.title));
  }, [resolvedPerson, today, suggestionsTick]);

  function handlePersonSuggestionAction(suggestion: CareSuggestion) {
    if (suggestion.action.kind === "text") {
      if (resolvedPerson.phone) openSmsComposer(resolvedPerson.phone, suggestion.action.body);
      else setIsEditOpen(true);
      return;
    }

    if (suggestion.action.kind === "giftIdeas") {
      setIsEditOpen(true);
      return;
    }

    if (suggestion.action.kind === "view") {
      setIsEditOpen(true);
    }
  }

  const monthDayFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }),
    []
  );
  const shortDateFormatter = useMemo(
    () => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }),
    []
  );

  const initials = useMemo(() => {
    const n = person.name?.trim() ?? "";
    if (!n) return "?";
    return n
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [person.name]);

  const kidsNamesOnly = useMemo(() => {
    const kids = (person.children ?? []).map((c) => (c.name ?? "").trim()).filter(Boolean);
    if (!kids.length) return null;
    return kids.slice(0, 3).join(", ") + (kids.length > 3 ? "…" : "");
  }, [person.children]);

  const kidsBirthdayLines = useMemo(() => {
    const lines: Array<{ key: string; text: string }> = [];
    for (const child of person.children ?? []) {
      const name = (child.name ?? "").trim();
      const raw = (child.birthday ?? child.birthdate ?? "").trim();
      if (!name || !raw) continue;
      const next = getNextBirthdayFromIso(raw, today);
      if (!next) continue;

      const yearNum = Number(raw.split("-")[0]);
      const age = !Number.isNaN(yearNum) && yearNum > 0 ? next.target.getFullYear() - yearNum : null;
      const dateText = monthDayFormatter.format(next.target);

      lines.push({
        key: `${child.id}_${next.year}`,
        text: age !== null && age > 0 ? `${name} — turns ${age} on ${dateText}` : `${name} — birthday on ${dateText}`,
      });
    }
    return lines;
  }, [monthDayFormatter, person.children, today]);

  const birthdayDisplay = useMemo(() => {
    const b = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
    if (!b?.date) return null;
    const next = getNextBirthdayFromIso(b.date, today);
    if (!next) return null;
    return monthDayFormatter.format(next.target);
  }, [monthDayFormatter, person.moments, today]);

  const anniversaryDisplay = useMemo(() => {
    const mmdd = getAnniversaryMonthDay(person);
    if (!mmdd) return null;
    return formatMonthDay(mmdd, monthDayFormatter);
  }, [monthDayFormatter, person]);

  type UpcomingItem = { key: string; label: string; date: Date; daysUntil: number; emoji?: string };

  const upcomingItems = useMemo(() => {
    const base = today;
    const items: UpcomingItem[] = [];

    const birthdayMoment = (person.moments ?? []).find((m) => m.type === "birthday") ?? null;
    if (birthdayMoment?.date) {
      const next = getNextBirthdayFromIso(birthdayMoment.date, base);
      if (next && next.daysUntilBirthday >= 0) {
        items.push({
          key: `bday_${person.id}_${next.year}`,
          label: `${person.name}’s birthday`,
          date: next.target,
          daysUntil: next.daysUntilBirthday,
          emoji: "🎂",
        });
      }
    }

    if (partner) {
      const partnerBirthday = (partner.moments ?? []).find((m) => m.type === "birthday") ?? null;
      if (partnerBirthday?.date) {
        const next = getNextBirthdayFromIso(partnerBirthday.date, base);
        if (next && next.daysUntilBirthday >= 0) {
          items.push({
            key: `partner_bday_${partner.id}_${next.year}`,
            label: `${partner.name}’s birthday`,
            date: next.target,
            daysUntil: next.daysUntilBirthday,
            emoji: "🎂",
          });
        }
      }
    }

    const monthDay = getAnniversaryMonthDay(person);
    if (partner && monthDay) {
      const next = getNextAnniversary(monthDay);
      if (next) {
        const until = daysUntilDate(next, base);
        if (until >= 0) {
          items.push({
            key: `anniv_${person.id}_${partner.id}_${next.getFullYear()}`,
            label: `Anniversary with ${partner.name}`,
            date: next,
            daysUntil: until,
            emoji: "💕",
          });
        }
      }
    }

    for (const child of person.children ?? []) {
      const childName = (child.name ?? "").trim();
      const raw = (child.birthday ?? child.birthdate ?? "").trim();
      if (!childName || !raw) continue;
      const next = getNextBirthdayFromIso(raw, base);
      if (!next || next.daysUntilBirthday < 0) continue;
      items.push({
        key: `child_bday_${child.id}_${next.year}`,
        label: `${childName}’s birthday`,
        date: next.target,
        daysUntil: next.daysUntilBirthday,
        emoji: "🎉",
      });
    }

    const nowYear = base.getFullYear();
    if (person.isMother === true || person.holidayPrefs?.mothersDay === true) {
      let md = getMothersDay(nowYear);
      if (md < base) md = getMothersDay(nowYear + 1);
      const until = daysUntilDate(md, base);
      if (until >= 0) {
        items.push({
          key: `md_${md.getFullYear()}`,
          label: "Mother’s Day",
          date: md,
          daysUntil: until,
          emoji: "💐",
        });
      }
    }
    if (person.isFather === true || person.holidayPrefs?.fathersDay === true) {
      let fd = getFathersDay(nowYear);
      if (fd < base) fd = getFathersDay(nowYear + 1);
      const until = daysUntilDate(fd, base);
      if (until >= 0) {
        items.push({
          key: `fd_${fd.getFullYear()}`,
          label: "Father’s Day",
          date: fd,
          daysUntil: until,
          emoji: "🧢",
        });
      }
    }

    for (const m of person.moments ?? []) {
      if (m.type !== "custom") continue;
      if (!m.date) continue;

      let target: Date | null = null;
      let until: number | null = null;

      if (m.recurring) {
        const next = getNextBirthdayFromIso(m.date, base);
        if (next) {
          target = next.target;
          until = next.daysUntilBirthday;
        }
      } else {
        const parsed = parseIsoDate(m.date);
        if (parsed) {
          target = startOfDay(parsed);
          until = daysUntilDate(target, base);
        }
      }

      if (!target || until === null || until < 0) continue;

      const lower = m.label.toLowerCase();
      const emoji = lower.includes("birthday") ? "🎂" : lower.includes("anniversary") ? "💕" : "🗓️";

      items.push({
        key: `custom_${m.id}_${target.toISOString()}`,
        label: m.label,
        date: target,
        daysUntil: until,
        emoji,
      });
    }

    return items
      .filter((i) => i.daysUntil >= 0 && i.daysUntil <= 365)
      .sort((a, b) => (a.daysUntil - b.daysUntil) || a.label.localeCompare(b.label));
  }, [partner, person, today]);

  const nextUp = useMemo(() => {
    const within60 = upcomingItems.filter((i) => i.daysUntil <= 60);
    return within60.length ? within60[0] : null;
  }, [upcomingItems]);

  const nextUpDescription = useMemo(() => {
    if (!nextUp) return null;
    const phr = timePhrase(nextUp.daysUntil);

    if (nextUp.label === `${person.name}’s birthday`) {
      return `• Birthday ${phr}`;
    }

    if (nextUp.label.startsWith("Anniversary with ")) {
      return `• ${nextUp.label} ${phr}`;
    }

    return `• ${nextUp.label} ${phr}`;
  }, [nextUp, person]);

  const thingsToRemember = useMemo(() => {
    const lines: Array<{ label: string; value: string }> = [];

    const storedCulture = (person as any).religionCulture;
    const cultures: NonNullable<Person["religionCulture"]> = Array.isArray(storedCulture)
      ? (storedCulture as NonNullable<Person["religionCulture"]>)
      : typeof storedCulture === "string" && storedCulture.trim()
        ? ([storedCulture.trim()] as NonNullable<Person["religionCulture"]>)
        : [];
    const normalizedCultures = cultures.filter((c) => c !== "none");
    if (normalizedCultures.length) {
      const labelMap: Record<NonNullable<Person["religionCulture"]>[number], string> = {
        christian: "Christian",
        orthodox: "Orthodox",
        jewish: "Jewish",
        muslim: "Muslim",
        none: "None",
      };
      lines.push({
        label: "Holidays to remember",
        value: normalizedCultures.map((c) => labelMap[c] ?? c).join(" · "),
      });
    }

    const kids = (person.children ?? [])
      .map((c) => {
        const name = (c.name ?? "").trim();
        const raw = (c.birthday ?? c.birthdate ?? "").trim();
        if (!name) return null;
        if (!raw) return name;
        const parsed = parseIsoDate(raw);
        if (!parsed) return name;
        return `${name} · ${monthDayFormatter.format(parsed)}`;
      })
      .filter((v): v is string => Boolean(v));
    if (kids.length) lines.push({ label: "Kids", value: kids.join(" • ") });

    const prefs: string[] = [];
    if (person.holidayPrefs?.mothersDay !== undefined) {
      prefs.push(`Mother’s Day: ${person.holidayPrefs.mothersDay ? "Include" : "Exclude"}`);
    }
    if (person.holidayPrefs?.fathersDay !== undefined) {
      prefs.push(`Father’s Day: ${person.holidayPrefs.fathersDay ? "Include" : "Exclude"}`);
    }
    if (prefs.length) lines.push({ label: "Holidays", value: prefs.join(" · ") });

    const notes = (person.moments ?? []).filter((m) => m.type === "custom" && m.category === "sensitive");
    if (notes.length) {
      lines.push({
        label: "Notes",
        value: notes.map((m) => (m.date ? `${m.label} · ${m.date}` : m.label)).join(" • "),
      });
    }

    return lines;
  }, [monthDayFormatter, person]);

  const relationshipsForPerson = (relationships ?? []).filter(
    (rel) => rel.fromId === person.id || rel.toId === person.id
  );

  const relatedPeople = relationshipsForPerson
    .map((rel) => {
      const otherId = rel.fromId === person.id ? rel.toId : rel.fromId;
      const otherPerson = (people ?? []).find((p) => p.id === otherId) ?? null;
      if (!otherPerson) return null;
      return { person: otherPerson, type: rel.type };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const relationshipOrder: Array<Relationship["type"]> = ["partner", "child", "parent", "sibling", "friend", "other"];

  const groupedRelatedPeople = relationshipOrder
    .map((type) => ({
      type,
      items: relatedPeople
        .filter((item) => item.type === type)
        .sort((a, b) => a.person.name.localeCompare(b.person.name)),
    }))
    .filter((group) => group.items.length > 0);

  function formatRelationshipType(type: Relationship["type"]) {
    if (type === "other") return "Family member";
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function resetConnectionDraft() {
    setConnectionType(resolvedPerson.partnerId ? "child" : "partner");
    setConnectionName("");
    setConnectionPhone("");
    setConnectionPhoneError(false);
    setConnectionBirthdayMonthDay("");
    setConnectionBirthdayYear("");
    setIsConnectionBirthdayOpen(false);
  }

  function openAddConnection() {
    resetConnectionDraft();
    setIsAddConnectionOpen(true);
  }

  function saveConnection() {
    const trimmedName = connectionName.trim();
    if (!trimmedName) return;

    const normalizedPhone = connectionPhone.trim() ? normalizePhone(connectionPhone) : null;
    if (connectionPhone.trim() && !normalizedPhone) {
      setConnectionPhoneError(true);
      return;
    }

    const birthdayIso = buildMomentIso(connectionBirthdayMonthDay, connectionBirthdayYear, false);
    const createdPerson: Person = {
      id: makeId(),
      name: trimmedName,
      phone: normalizedPhone || undefined,
      moments: birthdayIso
        ? [{ id: makeId(), type: "birthday", label: "Birthday", date: birthdayIso, recurring: true }]
        : [],
      partnerId: connectionType === "partner" ? resolvedPerson.id : undefined,
    };

    const relationshipType: Relationship["type"] =
      connectionType === "partner" ? "partner" : connectionType === "child" ? "child" : "other";

    const nextPerson: Person =
      connectionType === "partner"
        ? { ...resolvedPerson, partnerId: createdPerson.id }
        : resolvedPerson;

    savePerson({
      person: nextPerson,
      createdPeople: [createdPerson],
      createdRelationships: [
        {
          id: makeId(),
          fromId: resolvedPerson.id,
          toId: createdPerson.id,
          type: relationshipType,
        },
      ],
    });

    setIsAddConnectionOpen(false);
    resetConnectionDraft();
  }

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
              onClick={() => setIsEditOpen(true)}
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
            <section aria-label="Relationship snapshot">
              <div
                style={{
                  width: "100%",
                  background: "var(--paper)",
                  borderRadius: "16px",
                  padding: "22px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "999px",
                      background: "rgba(27, 42, 65, 0.08)",
                      color: "var(--ink)",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 600,
                      letterSpacing: "0.02em",
                      flex: "0 0 auto",
                    }}
                  >
                    {initials}
                  </div>

                  <div style={{ minWidth: "220px", flex: "1 1 260px" }}>
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

	                    <div style={{ marginTop: "10px", display: "grid", gap: "5px", color: "var(--muted)", lineHeight: 1.5, fontSize: "16px" }}>
	                      {partner ? <div>Partner — {partner.name}</div> : null}
	                      {person.phone ? <div>Phone — {person.phone}</div> : null}
	                      {kidsNamesOnly ? <div>Kids: {kidsNamesOnly}</div> : null}
	                      {kidsBirthdayLines.length ? (
                        <div style={{ display: "grid", gap: "6px" }}>
                          {kidsBirthdayLines.map((line) => (
                            <div key={line.key} style={{ display: "flex", alignItems: "center" }}>
                              <SoftGoldDot />
                              <div style={{ minWidth: 0 }}>{line.text}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {birthdayDisplay ? (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <SoftGoldDot />
                          <div style={{ minWidth: 0 }}>Birthday on {birthdayDisplay}</div>
                        </div>
                      ) : null}
                      {anniversaryDisplay ? (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <SoftGoldDot />
                          <div style={{ minWidth: 0 }}>Anniversary on {anniversaryDisplay}</div>
                        </div>
                      ) : null}
	                      {nextUp && nextUpDescription ? (
	                        <div style={{ marginTop: "10px", display: "flex", alignItems: "center" }}>
	                          <RaisedGoldBullet />
	                          <div style={{ minWidth: 0 }}>
	                            <div>Next up for {person.name.trim()}</div>
	                            <div>{nextUpDescription}</div>
	                          </div>
	                        </div>
	                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section aria-label="Upcoming moments" style={{ marginTop: "28px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>
                What’s coming up for {person.name.trim()}
              </div>
              {upcomingItems.length ? (
                <div style={{ marginTop: "14px", display: "grid", gap: "10px" }}>
                  {upcomingItems.slice(0, 8).map((item) => (
                    <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ color: "var(--ink)", display: "flex", alignItems: "center", minWidth: 0 }}>
                        <SoftGoldDot />
                        <div style={{ minWidth: 0 }}>
                          {item.label}
                          {item.emoji ? ` ${item.emoji}` : ""}
                        </div>
                      </div>
                      <div style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {item.daysUntil <= 7 ? timePhrase(item.daysUntil) : shortDateFormatter.format(item.date)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: "12px", color: "var(--muted)", lineHeight: 1.6 }}>
                  Nothing on the horizon yet.
                </div>
              )}
            </section>

            {thingsToRemember.length ? (
              <section aria-label="Things to remember" style={{ marginTop: "28px" }}>
                <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>
                  Things to remember
                </div>

                <div style={{ marginTop: "12px", display: "grid", gap: "10px", color: "var(--muted)", lineHeight: 1.6 }}>
                  {thingsToRemember.map((line) => (
                    <div key={line.label}>
                      <span style={{ color: "var(--ink)" }}>{line.label}:</span> {line.value}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-label="Connections" style={{ marginTop: "28px" }}>
              <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>
                Connections
              </div>
              <div style={{ marginTop: "6px", color: "var(--muted)", lineHeight: 1.6 }}>
                Add people connected to this person. Name is required, phone is optional.
              </div>

              {groupedRelatedPeople.length ? (
                <div style={{ marginTop: "14px", display: "grid", gap: "14px" }}>
                  {groupedRelatedPeople.map((group) => (
                    <div key={group.type}>
                      <div style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {formatRelationshipType(group.type)}
                      </div>
                      <div style={{ display: "grid", gap: "10px" }}>
                        {group.items.map(({ person: related }) => (
                          <button
                            key={related.id}
                            onClick={() => navigate(`/person/${related.id}`)}
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
                            <div style={{ fontWeight: 500 }}>{related.name}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>No connections yet.</div>
              )}

              <button
                onClick={openAddConnection}
                style={{
                  marginTop: "14px",
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
                Add connection
              </button>
            </section>

            {personSuggestions.length ? (
              <section aria-label="Helpful additions" style={{ marginTop: "28px" }}>
                <div style={{ fontSize: "20px", fontWeight: 500, color: "var(--ink)" }}>
                  Helpful additions
                </div>

                <div style={{ marginTop: "12px", display: "grid", gap: "12px" }}>
	                  {personSuggestions.map((suggestion) => (
	                    (() => {
	                      const text =
	                        suggestion.type === "birthday" &&
	                        suggestion.title.toLowerCase().includes("turns") &&
	                        suggestion.title.toLowerCase().includes("tomorrow")
	                          ? `${suggestion.title.trim().replace(/\.*$/, "")}.`
	                          : `${suggestion.title}\n${suggestion.message}`;
	                      return (
	                    <SmartSuggestionCard
	                      key={suggestion.id}
	                      variant="nudge"
	                      message={text}
	                      actions={[
	                        { label: suggestion.actionLabel, onClick: () => handlePersonSuggestionAction(suggestion) },
	                        { label: "Hide for now", onClick: () => snoozeSuggestion(suggestion.id, 90) },
	                      ]}
	                      onMaybe={undefined}
	                    />
	                      );
	                    })()
	                  ))}
	                </div>
	              </section>
	            ) : null}

            <div style={{ marginTop: "34px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
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
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
              overflow: "hidden",
            }}
          >
            <div className="modalContent" style={{ fontFamily: "var(--font-sans)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", fontWeight: 600, color: "var(--ink)" }}>
                  Add connection
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
                    <option value="partner" disabled={Boolean(person.partnerId)}>
                      Partner{person.partnerId ? " (already linked)" : ""}
                    </option>
                    <option value="child">Child</option>
                    <option value="grandchild">Grandchild</option>
                    <option value="familyMember">Family member</option>
                  </select>
                </div>

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

                <button
                  onClick={saveConnection}
                  disabled={!connectionName.trim()}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: connectionName.trim() ? "var(--ink)" : "var(--muted)",
                    cursor: connectionName.trim() ? "pointer" : "default",
                    textAlign: "center",
                    fontWeight: 500,
                    letterSpacing: "0.01em",
                    borderRadius: "12px",
                    padding: "0.85rem 1.1rem",
                    fontSize: "0.98rem",
                    boxShadow: "none",
                  }}
                >
                  Save connection
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
        onClose={() => setIsEditOpen(false)}
        onSave={(updated) => {
          updatePerson(updated);
        }}
      />
    </div>
  );
}
