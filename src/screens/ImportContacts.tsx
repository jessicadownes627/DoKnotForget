import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "../router";
import { useAppState } from "../appState";
import type { Person } from "../models/Person";
import { normalizePhone as normalizePhoneE164 } from "../utils/phone";

type PickedContact = {
  name: string;
  phone: string;
  birthday?: string;
  anniversary?: string;
  hasBirthday: boolean;
  hasAnniversary: boolean;
  hasEmail: boolean;
  hasNotesOrOrganization: boolean;
  score: number;
};

type CapacitorContactsResult =
  | { contacts?: any[] }
  | any;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizePhone(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function contactKey(c: PickedContact) {
  return `${c.name}::${c.phone}`;
}

function getCapacitorContactsPlugin(): any | null {
  const cap = (window as any)?.Capacitor;
  const plugins = cap?.Plugins;
  if (!plugins) return null;
  return plugins.Contacts || plugins.CapacitorContacts || plugins.Contact || null;
}

function extractName(c: any) {
  const displayName = typeof c?.displayName === "string" ? c.displayName : "";
  if (displayName.trim()) return displayName.trim();
  const name = c?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  if (Array.isArray(name) && String(name[0] ?? "").trim()) return String(name[0] ?? "").trim();
  const given = typeof c?.givenName === "string" ? c.givenName.trim() : "";
  const family = typeof c?.familyName === "string" ? c.familyName.trim() : "";
  const combined = `${given} ${family}`.trim();
  return combined;
}

function extractPhone(c: any) {
  const candidates: any[] = [];
  if (Array.isArray(c?.phoneNumbers)) candidates.push(...c.phoneNumbers);
  if (Array.isArray(c?.phones)) candidates.push(...c.phones);
  if (Array.isArray(c?.tel)) candidates.push(...c.tel);
  if (typeof c?.phoneNumber === "string") candidates.push({ number: c.phoneNumber });
  if (typeof c?.phone === "string") candidates.push({ number: c.phone });

  for (const cand of candidates) {
    const v =
      typeof cand === "string"
        ? cand
        : typeof cand?.number === "string"
          ? cand.number
          : typeof cand?.value === "string"
            ? cand.value
            : "";
    const trimmed = normalizePhone(v);
    if (trimmed) return trimmed;
  }
  return "";
}

function hasAnyTextValue(values: any[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return true;
  }
  return false;
}

function hasAnyStructuredValue(values: any[], keys: string[]) {
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    for (const key of keys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === "string" && candidate.trim()) return true;
    }
  }
  return false;
}

function extractHasEmail(c: any) {
  const candidates: any[] = [];
  if (Array.isArray(c?.emails)) candidates.push(...c.emails);
  if (Array.isArray(c?.emailAddresses)) candidates.push(...c.emailAddresses);
  if (Array.isArray(c?.email)) candidates.push(...c.email);
  if (typeof c?.email === "string") candidates.push(c.email);
  if (typeof c?.emailAddress === "string") candidates.push(c.emailAddress);
  return hasAnyTextValue(candidates) || hasAnyStructuredValue(candidates, ["address", "value", "email"]);
}

function extractHasBirthday(c: any) {
  if (typeof c?.birthday === "string" && c.birthday.trim()) return true;
  if (typeof c?.birthdate === "string" && c.birthdate.trim()) return true;
  if (typeof c?.bday === "string" && c.bday.trim()) return true;
  return Boolean(c?.birthday || c?.birthdate || c?.bday);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toBirthdayIso(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

    const md = trimmed.match(/^(\d{2})-(\d{2})$/);
    if (md) return `0000-${md[1]}-${md[2]}`;

    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (slash) {
      const month = Number(slash[1]);
      const day = Number(slash[2]);
      const year = slash[3] ? Number(slash[3]) : 0;
      if (!month || !day) return null;
      if (year > 0) return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
      return `0000-${pad2(month)}-${pad2(day)}`;
    }
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const month = Number(record.month ?? record.monthValue ?? record.m);
    const day = Number(record.day ?? record.dayValue ?? record.d);
    const year = Number(record.year ?? record.yearValue ?? record.y ?? 0);
    if (!Number.isNaN(month) && !Number.isNaN(day) && month > 0 && day > 0) {
      if (!Number.isNaN(year) && year > 0) return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
      return `0000-${pad2(month)}-${pad2(day)}`;
    }
  }

  return null;
}

function extractBirthdayIso(c: any) {
  return toBirthdayIso(c?.birthday) ?? toBirthdayIso(c?.birthdate) ?? toBirthdayIso(c?.bday);
}

function extractAnniversaryIso(c: any) {
  const direct =
    toBirthdayIso(c?.anniversary) ??
    toBirthdayIso(c?.anniversaryDate) ??
    toBirthdayIso(c?.weddingDate);
  if (direct) return direct;

  const datedEntries = Array.isArray(c?.dates) ? c.dates : [];
  for (const entry of datedEntries) {
    if (!entry || typeof entry !== "object") continue;
    const label = String(
      (entry as Record<string, unknown>).label ??
        (entry as Record<string, unknown>).type ??
        (entry as Record<string, unknown>).name ??
        ""
    )
      .trim()
      .toLowerCase();
    if (label !== "anniversary") continue;

    const value =
      (entry as Record<string, unknown>).date ??
      (entry as Record<string, unknown>).value ??
      (entry as Record<string, unknown>).when;
    const iso = toBirthdayIso(value);
    if (iso) return iso;
  }

  return null;
}

function extractHasAnniversary(c: any) {
  if (typeof c?.anniversary === "string" && c.anniversary.trim()) return true;
  if (typeof c?.anniversaryDate === "string" && c.anniversaryDate.trim()) return true;
  if (typeof c?.weddingDate === "string" && c.weddingDate.trim()) return true;
  if (Array.isArray(c?.dates)) {
    for (const entry of c.dates) {
      if (!entry || typeof entry !== "object") continue;
      const label = String(
        (entry as Record<string, unknown>).label ??
          (entry as Record<string, unknown>).type ??
          (entry as Record<string, unknown>).name ??
          ""
      )
        .trim()
        .toLowerCase();
      if (label === "anniversary") return true;
    }
  }
  return Boolean(c?.anniversary || c?.anniversaryDate || c?.weddingDate);
}

function extractHasNotesOrOrganization(c: any) {
  const noteCandidates: any[] = [];
  if (Array.isArray(c?.notes)) noteCandidates.push(...c.notes);
  if (typeof c?.note === "string") noteCandidates.push(c.note);
  if (typeof c?.notes === "string") noteCandidates.push(c.notes);

  const orgCandidates: any[] = [];
  if (Array.isArray(c?.organizations)) orgCandidates.push(...c.organizations);
  if (Array.isArray(c?.organization)) orgCandidates.push(...c.organization);
  if (typeof c?.organizationName === "string") orgCandidates.push(c.organizationName);
  if (typeof c?.company === "string") orgCandidates.push(c.company);
  if (typeof c?.jobTitle === "string") orgCandidates.push(c.jobTitle);

  return (
    hasAnyTextValue(noteCandidates) ||
    hasAnyStructuredValue(noteCandidates, ["note", "value", "text"]) ||
    hasAnyTextValue(orgCandidates) ||
    hasAnyStructuredValue(orgCandidates, ["name", "company", "title", "department"])
  );
}

function calculateContactScore(contact: {
  hasBirthday: boolean;
  hasAnniversary: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  hasNotesOrOrganization: boolean;
}) {
  let score = 0;
  if (contact.hasBirthday) score += 3;
  if (contact.hasAnniversary) score += 2;
  if (contact.hasPhone && contact.hasEmail) score += 2;
  if (contact.hasNotesOrOrganization) score += 1;
  return score;
}

export default function ImportContacts() {
  const navigate = useNavigate();
  const location = useLocation();
  const { people, createPerson } = useAppState();
  const [picked, setPicked] = useState<PickedContact[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<"idle" | "select">("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reviewImportedIds = useMemo<string[]>(() => {
    const raw = location.state?.reviewImportedIds;
    return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string" && value.trim().length > 0) : [];
  }, [location.state]);

  const supported = typeof window !== "undefined" && Boolean(getCapacitorContactsPlugin());

  async function loadContacts() {
    setError(null);
    if (!supported) return [];

    setIsLoading(true);
    try {
      const plugin = getCapacitorContactsPlugin();
      if (!plugin) return [];
      if (plugin.requestPermissions) await plugin.requestPermissions();
      else if (plugin.getPermissions) await plugin.getPermissions();

      const result: CapacitorContactsResult = plugin.getContacts ? await plugin.getContacts() : { contacts: [] };
      const contacts = Array.isArray((result as any)?.contacts) ? (result as any).contacts : Array.isArray(result) ? result : [];
      const next: PickedContact[] = [];
      for (const c of contacts ?? []) {
        const trimmedName = extractName(c);
        const trimmedPhone = extractPhone(c);
        if (!trimmedName || !trimmedPhone) continue;
        const birthday = extractBirthdayIso(c) ?? undefined;
        const anniversary = extractAnniversaryIso(c) ?? undefined;
        const hasBirthday = Boolean(birthday) || extractHasBirthday(c);
        const hasAnniversary = Boolean(anniversary) || extractHasAnniversary(c);
        const hasEmail = extractHasEmail(c);
        const hasNotesOrOrganization = extractHasNotesOrOrganization(c);
        next.push({
          name: trimmedName,
          phone: trimmedPhone,
          birthday,
          anniversary,
          hasBirthday,
          hasAnniversary,
          hasEmail,
          hasNotesOrOrganization,
          score: calculateContactScore({
            hasBirthday,
            hasAnniversary,
            hasPhone: true,
            hasEmail,
            hasNotesOrOrganization,
          }),
        });
      }
      return next;
    } catch (e: any) {
      // User cancelled or permission denied.
      setError(e?.message ? String(e.message) : "Couldn’t access contacts.");
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  const sortedPicked = useMemo(() => {
    return [...picked].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [picked]);

  const reviewImportedPeople = useMemo(() => {
    const byId = new Map(people.map((person) => [person.id, person] as const));
    return reviewImportedIds
      .map((id) => byId.get(id) ?? null)
      .filter((person): person is Person => Boolean(person));
  }, [people, reviewImportedIds]);

  function personBirthday(person: Person) {
    return (person.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
  }

  function formatBirthdayLabel(person: Person) {
    const birthday = personBirthday(person);
    if (!birthday?.date) return "No birthday detected";
    const parts = birthday.date.split("-");
    if (parts.length !== 3) return birthday.date;
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    if (!month || !day || Number.isNaN(month) || Number.isNaN(day)) return birthday.date;
    const parsed = new Date(2000, month - 1, day);
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" }).format(parsed);
  }

  function importContacts(contacts: PickedContact[]) {
    const createdIds: string[] = [];
    for (const c of contacts) {
      const normalizedPhone = normalizePhoneE164(c.phone) ?? null;
      const moments: Person["moments"] = [];
      if (c.birthday && !moments.some((moment) => moment.type === "birthday" && moment.date === c.birthday)) {
        moments.push({
          id: makeId(),
          type: "birthday",
          label: "Birthday",
          date: c.birthday,
          recurring: true,
        });
      }
      if (c.anniversary && !moments.some((moment) => moment.type === "anniversary" && moment.date === c.anniversary)) {
        moments.push({
          id: makeId(),
          type: "anniversary",
          label: "Anniversary",
          date: c.anniversary,
          recurring: true,
        });
      }
      const person: Person = {
        id: makeId(),
        name: c.name,
        phone: normalizedPhone || undefined,
        moments,
      };
      createPerson(person);
      createdIds.push(person.id);
    }
    return createdIds;
  }

  async function handleImportAll() {
    const contacts = await loadContacts();
    if (!contacts.length) return;
    const createdIds = importContacts(contacts);
    navigate("/import", { replace: true, state: { reviewImportedIds: createdIds } });
  }

  async function handleSelectContacts() {
    const contacts = await loadContacts();
    if (!contacts.length) return;
    setPicked(contacts);
    setSelectedKeys(new Set());
    setMode("select");
  }

  function toggleSelected(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleImportSelected() {
    const selectedContacts = sortedPicked.filter((contact) => selectedKeys.has(contactKey(contact)));
    if (!selectedContacts.length) return;
    const createdIds = importContacts(selectedContacts);
    navigate("/import", { replace: true, state: { reviewImportedIds: createdIds } });
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
        <div style={{ maxWidth: "560px", margin: "0 auto", paddingTop: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "baseline" }}>
            <button
              type="button"
              onClick={() => navigate("/home")}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: "0.95rem",
                fontWeight: 500,
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => navigate("/add")}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: "0.95rem",
                fontWeight: 500,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
              }}
            >
              Add manually
            </button>
          </div>

          <div style={{ marginTop: "18px", fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600 }}>
            {reviewImportedIds.length ? "Review Imported Contacts" : "Import from Contacts"}
          </div>

          {reviewImportedIds.length ? (
            <>
              <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                Review the people you just imported. You can edit birthdays, anniversaries, children, and custom moments before heading back home.
              </div>

              {reviewImportedPeople.length ? (
                <div style={{ marginTop: "18px" }}>
                  <div
                    style={{
                      border: "1px solid var(--border)",
                      borderRadius: "14px",
                      background: "rgba(255,255,255,0.65)",
                      overflow: "hidden",
                    }}
                  >
                    {reviewImportedPeople.map((person, index) => (
                      <div
                        key={person.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "12px 14px",
                          borderTop: index === 0 ? "none" : "1px solid var(--border)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>{person.name}</div>
                          <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginTop: "2px" }}>
                            {formatBirthdayLabel(person)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/person/${person.id}`, {
                              state: {
                                returnToImportReview: true,
                                reviewImportedIds,
                              },
                            })
                          }
                          style={{ padding: "0.6rem 0.9rem" }}
                        >
                          Edit
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    <button type="button" onClick={() => navigate("/home")}>
                      Finish Setup
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                  Those imported contacts are no longer available to review.
                </div>
              )}
            </>
          ) : !supported ? (
            <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
              Contacts import is available in the iOS app. You can still add people manually.
            </div>
          ) : (
            <>
              <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                Choose contacts to import. We’ll only save name and phone for now.
              </div>

              {mode === "idle" ? (
                <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                  <button type="button" onClick={handleImportAll} disabled={isLoading}>
                    {isLoading ? "Loading contacts..." : "Import All Contacts"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectContacts}
                    disabled={isLoading}
                    style={{
                      border: "1px solid var(--border-strong)",
                      background: "transparent",
                      color: "var(--ink)",
                    }}
                  >
                    {isLoading ? "Loading contacts..." : "Select Contacts"}
                  </button>
                </div>
              ) : null}
            </>
          )}

          {error && !reviewImportedIds.length ? (
            <div style={{ marginTop: "12px", color: "var(--muted)", fontSize: "0.95rem" }}>
              {error}
            </div>
          ) : null}

          {!reviewImportedIds.length && mode === "select" && sortedPicked.length ? (
            <div style={{ marginTop: "18px" }}>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  background: "rgba(255,255,255,0.65)",
                  overflow: "hidden",
                }}
              >
                <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
                  {sortedPicked.map((c) => {
                    const key = contactKey(c);
                    const isSelected = selectedKeys.has(key);
                    return (
                      <div
                        key={key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "12px 14px",
                          borderTop: "1px solid var(--border)",
                        }}
                      >
                        <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", width: "100%", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(key)}
                            style={{ marginTop: "2px" }}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>{c.name}</div>
                            <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginTop: "2px" }}>{c.phone}</div>
                            {c.hasBirthday ? (
                              <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                                🎂 Birthday saved
                              </div>
                            ) : null}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={handleImportSelected}
                  disabled={selectedKeys.size === 0}
                >
                  Import Selected Contacts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("idle");
                    setPicked([]);
                    setSelectedKeys(new Set());
                  }}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                  }}
                >
                  Back to choices
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
