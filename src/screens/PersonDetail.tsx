import { useState } from "react";
import type { Moment, Person } from "../models/Person";
import type { Relationship } from "../models/Relationship";
import MomentDatePicker from "../components/MomentDatePicker";
import PersonArchiveCard from "../components/PersonArchiveCard";
import PersonEditDrawer from "../components/PersonEditDrawer";

type Props = {
  person: Person;
  onUpdatePerson: (person: Person) => void;
  people?: Person[];
  relationships?: Relationship[];
  onSelectPerson?: (person: Person) => void;
  onEdit?: () => void;
  onBack: () => void;
};

export default function PersonDetail({
  person,
  onUpdatePerson,
  people,
  relationships,
  onSelectPerson,
  onBack,
}: Props) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddingBirthday, setIsAddingBirthday] = useState(false);
  const [birthdayMonthDay, setBirthdayMonthDay] = useState("");
  const [birthdayYear, setBirthdayYear] = useState("");
  const [birthdayDraftMonthDay, setBirthdayDraftMonthDay] = useState("");
  const [birthdayDraftYear, setBirthdayDraftYear] = useState("");
  const [isBirthdayPickerOpen, setIsBirthdayPickerOpen] = useState(false);
  const [isCircleOpen, setIsCircleOpen] = useState(false);

  const birthdays = person.moments.filter((moment) => moment.type === "birthday");
  const anniversaries = person.moments.filter((moment) => moment.type === "anniversary");
  const customMoments = person.moments
    .filter((moment) => moment.type === "custom")
    .sort((a, b) => a.date.localeCompare(b.date));
  const birthdayFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
  });
  const birthdayWithYearFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const birthdayShortFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  });

  function parseYmd(value: string) {
    const [yStr, mStr, dStr] = value.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    if (!yStr || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return null;
    return { y, m, d };
  }

  function formatBirthday(date: string) {
    const parts = parseYmd(date);
    if (!parts) return date;

    const year = parts.y;
    const displayYear = year > 0 ? year : 2000;
    const parsed = new Date(displayYear, parts.m - 1, parts.d);
    if (Number.isNaN(parsed.getTime())) return date;

    return year > 0 ? birthdayWithYearFormatter.format(parsed) : birthdayFormatter.format(parsed);
  }

  function formatFullDate(value: string) {
    const parts = parseYmd(value);
    if (!parts) return value;
    const displayYear = parts.y > 0 ? parts.y : 2000;
    const parsed = new Date(displayYear, parts.m - 1, parts.d);
    if (Number.isNaN(parsed.getTime())) return value;
    if (parts.y > 0) return fullDateFormatter.format(parsed);
    return birthdayFormatter.format(parsed);
  }

  function getAgeFromBirthday(value: string) {
    const parts = parseYmd(value);
    if (!parts || parts.y <= 0) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let age = today.getFullYear() - parts.y;

    const month = today.getMonth() + 1;
    const hasHadBirthdayThisYear =
      month > parts.m || (month === parts.m && today.getDate() >= parts.d);
    if (!hasHadBirthdayThisYear) age -= 1;
    if (age < 0) return null;
    return age;
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

  function getNextBirthdayInfo(date: string) {
    const [yearStr, monthStr, dayStr] = date.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let target = new Date(today.getFullYear(), month - 1, day);

    if (
      Number.isNaN(target.getTime()) ||
      target.getMonth() !== month - 1 ||
      target.getDate() !== day
    ) {
      return null;
    }

    if (target < today) {
      target = new Date(today.getFullYear() + 1, month - 1, day);
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const daysUntil = Math.round((target.getTime() - today.getTime()) / msPerDay);
    const relativeLabel =
      daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;

    // "Turns X" uses the full birth year and the year of the next occurrence.
    const turns = year > 0 ? target.getFullYear() - year : null;

    return {
      daysUntil,
      relativeLabel,
      formatted: birthdayShortFormatter.format(target),
      turns,
    };
  }

  function handleSaveBirthday() {
    const birthdayIso = buildBirthdayIso(birthdayMonthDay, birthdayYear);
    if (!birthdayIso) return;
    const moment: Moment = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "birthday",
      label: "Birthday",
      date: birthdayIso,
      recurring: true,
    };
    onUpdatePerson({ ...person, moments: [...person.moments, moment] });
    setBirthdayMonthDay("");
    setBirthdayYear("");
    setIsAddingBirthday(false);
  }

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

  const relationshipOrder: Array<Relationship["type"]> = [
    "partner",
    "child",
    "parent",
    "sibling",
    "friend",
    "other",
  ];

  const groupedRelatedPeople = relationshipOrder
    .map((type) => ({
      type,
      items: relatedPeople
        .filter((item) => item.type === type)
        .sort((a, b) => a.person.name.localeCompare(b.person.name)),
    }))
    .filter((group) => group.items.length > 0);

  function formatRelationshipType(type: Relationship["type"]) {
    return type.charAt(0).toUpperCase() + type.slice(1);
  }

  function GroupLabel({ children }: { children: string }) {
    return (
      <div
        style={{
          marginTop: "12px",
          fontFamily: "var(--font-sans)",
          fontSize: "0.85rem",
          letterSpacing: "0.02em",
          color: "var(--muted)",
          textTransform: "uppercase",
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div style={{ padding: "3.5rem", maxWidth: "700px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.75rem", display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={onBack}
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
        <PersonArchiveCard person={person} />
      </div>

      <PersonEditDrawer
        isOpen={isEditOpen}
        person={person}
        onClose={() => setIsEditOpen(false)}
        onSave={(updated) => {
          onUpdatePerson(updated);
        }}
      />

      <div style={{ marginTop: "2.5rem", display: "grid", gap: "2.75rem", maxWidth: "560px", marginLeft: "auto", marginRight: "auto" }}>
        <section aria-label="Personal">
          <GroupLabel>Personal</GroupLabel>
          <div style={{ marginTop: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
            {person.phone ? `Phone: ${person.phone}` : "Phone: Phone not added"}
          </div>
        </section>

        <section aria-label="Family">
          <GroupLabel>Family</GroupLabel>
          <div style={{ marginTop: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
            {(() => {
              const kidsCount = (person.children ?? []).length;
              if (!person.hasKids && kidsCount === 0) return "No family details yet.";
              if (kidsCount === 0) return "Has kids.";
              return kidsCount === 1 ? "1 child saved." : `${kidsCount} children saved.`;
            })()}
          </div>
        </section>

        <section aria-label="Culture">
          <GroupLabel>Culture</GroupLabel>
          <div style={{ marginTop: "0.85rem", color: "var(--muted)", lineHeight: 1.6 }}>
            {person.religionCulture ? `Religion/culture: ${person.religionCulture}` : "Religion/culture: Not set"}
          </div>
        </section>

        <section aria-label="Dates">
          <GroupLabel>Dates</GroupLabel>

          <div style={{ marginTop: "1.15rem" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", fontWeight: 600, color: "var(--ink)" }}>
              Birthdays
            </div>

            {birthdays.length === 0 ? (
              <p style={{ marginTop: "0.6rem", color: "var(--muted)", lineHeight: 1.6 }}>No birthdays saved yet.</p>
            ) : (
              <ul
                style={{
                  marginTop: "0.65rem",
                  listStyle: "none",
                  paddingLeft: 0,
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                {birthdays.map((moment) => (
                  <li key={moment.id} style={{ marginBottom: "0.35rem" }}>
                    {"•"} Birthday · {formatBirthday(moment.date)}
                    {(() => {
                      const age = getAgeFromBirthday(moment.date);
                      return age !== null ? ` · Age ${age}` : "";
                    })()}
                  </li>
                ))}
              </ul>
            )}

            {!isAddingBirthday ? (
              <div style={{ marginTop: "1.5rem" }}>
                <button
                  onClick={() => setIsAddingBirthday(true)}
                  style={{
                    padding: "0.75rem 1.25rem",
                    cursor: "pointer",
                  }}
                >
                  Add a birthday
                </button>
              </div>
            ) : (
              <div style={{ marginTop: "1.5rem", display: "grid", gap: "0.75rem", maxWidth: "520px" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setBirthdayDraftMonthDay(birthdayMonthDay);
                    setBirthdayDraftYear(birthdayYear);
                    setIsBirthdayPickerOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setBirthdayDraftMonthDay(birthdayMonthDay);
                      setBirthdayDraftYear(birthdayYear);
                      setIsBirthdayPickerOpen(true);
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
                    {birthdayMonthDay
                      ? formatBirthday(buildBirthdayIso(birthdayMonthDay, birthdayYear))
                      : "Select date"}
                  </div>
                </div>

                <MomentDatePicker
                  isOpen={isBirthdayPickerOpen}
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
                    setIsBirthdayPickerOpen(false);
                  }}
                  onCancel={() => setIsBirthdayPickerOpen(false)}
                  onClear={() => {
                    setBirthdayDraftMonthDay("");
                    setBirthdayDraftYear("");
                  }}
                />

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    onClick={handleSaveBirthday}
                    style={{
                      padding: "0.6rem 1rem",
                      cursor: "pointer",
                    }}
                  >
                    Save birthday
                  </button>
                  <button
                    onClick={() => {
                      setIsBirthdayPickerOpen(false);
                      setIsAddingBirthday(false);
                      setBirthdayMonthDay("");
                      setBirthdayYear("");
                      setBirthdayDraftMonthDay("");
                      setBirthdayDraftYear("");
                    }}
                    style={{
                      padding: "0.6rem 1rem",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "2.25rem" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", fontWeight: 600, color: "var(--ink)" }}>
              Anniversary
            </div>

            {anniversaries.length === 0 ? (
              <p style={{ marginTop: "0.6rem", color: "var(--muted)", lineHeight: 1.6 }}>No anniversary saved yet.</p>
            ) : (
              <ul
                style={{
                  marginTop: "0.65rem",
                  listStyle: "none",
                  paddingLeft: 0,
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                {anniversaries.map((moment) => (
                  <li key={moment.id} style={{ marginBottom: "0.35rem" }}>
                    {"•"} Anniversary · {formatFullDate(moment.date)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ marginTop: "2.25rem" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: "1rem", fontWeight: 600, color: "var(--ink)" }}>
              Custom moments
            </div>

            {customMoments.length === 0 ? (
              <p style={{ marginTop: "0.6rem", color: "var(--muted)", lineHeight: 1.6 }}>No custom moments saved yet.</p>
            ) : (
              <ul
                style={{
                  marginTop: "0.65rem",
                  listStyle: "none",
                  paddingLeft: 0,
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                {customMoments.map((moment) => (
                  <li key={moment.id} style={{ marginBottom: "0.35rem" }}>
                    {"•"} {moment.label} · {formatFullDate(moment.date)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-label="Circle">
          <GroupLabel>Circle</GroupLabel>
          <button
            onClick={() => setIsCircleOpen((prev) => !prev)}
            style={{
              marginTop: "0.85rem",
              padding: 0,
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--ink)",
              fontSize: "1rem",
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            Related people <span style={{ color: "var(--muted)" }}>{isCircleOpen ? "—" : "+"}</span>
          </button>

          {isCircleOpen ? (
            <div style={{ marginTop: "1.25rem" }}>
              {groupedRelatedPeople.length === 0 ? (
                <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>No related people yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "1.75rem" }}>
                  {groupedRelatedPeople.map((group) => (
                    <div key={group.type}>
                      <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "0.6rem" }}>
                        {formatRelationshipType(group.type)}
                      </div>
                      <div style={{ display: "grid", gap: "1.25rem" }}>
                        {group.items.map(({ person: related }) => {
                          const birthdayMoment =
                            related.moments.find((m) => m.type === "birthday") ?? null;
                          const info = birthdayMoment ? getNextBirthdayInfo(birthdayMoment.date) : null;

                          return (
                            <PersonArchiveCard
                              key={related.id}
                              person={related}
                              onClick={onSelectPerson ? () => onSelectPerson(related) : undefined}
                            >
                              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                                {formatRelationshipType(group.type)}
                              </div>
                              {birthdayMoment && info ? (
                                <div style={{ marginTop: "0.35rem", color: "var(--muted)", fontSize: "0.9rem" }}>
                                  <div>
                                    {info.turns !== null
                                      ? `Turns ${info.turns} · ${info.formatted}`
                                      : `Birthday · ${info.formatted}`}
                                  </div>
                                  <div style={{ marginTop: "0.15rem" }}>{info.relativeLabel}</div>
                                </div>
                              ) : null}
                            </PersonArchiveCard>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
