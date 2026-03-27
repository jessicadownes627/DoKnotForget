import { useMemo, useState } from "react";
import { useAppState } from "../appState";
import { useNavigate } from "../router";
import {
  compareImportableContacts,
  compareImportableContactsAlphabetically,
  ensureContactPermission,
  hasEmojiInName,
  hasUpcomingBirthday,
  importableContactToPerson,
  isPriorityContactName,
  isContactImportSupported,
  loadImportableContacts,
  type ImportableContact,
} from "../utils/contactImport";
import {
  FREE_PEOPLE_LIMIT,
  countNetNewPeople,
  wouldExceedFreePeopleLimit,
} from "../utils/freeLimit";
import { getNextBirthdayFromIso } from "../utils/birthdayUtils";
import type { Person } from "../models/Person";

const INITIAL_VISIBLE_CONTACTS = 80;
const VISIBLE_CONTACTS_STEP = 80;
const STARTER_CONTACT_LIMIT = 8;

function formatBirthday(value: string | undefined) {
  if (!value) return "";
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!monthStr || !dayStr || Number.isNaN(month) || Number.isNaN(day)) return "";
  const parsed = new Date(year > 0 ? year : 2000, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", year > 0 ? { month: "long", day: "numeric", year: "numeric" } : { month: "long", day: "numeric" }).format(parsed);
}

function firstName(value: string) {
  const trimmed = value.trim();
  return trimmed.split(" ")[0] || trimmed;
}

function looksLikePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length === value.replace(/[^\d()+\-\s.]/g, "").replace(/\D/g, "").length;
}

function contactPrimaryLabel(contact: ImportableContact) {
  const name = contact.name.trim();
  if (!name) return "No name saved";
  if (contact.phone && name === contact.phone) return "No name saved";
  if (looksLikePhoneNumber(name)) return "No name saved";
  return name;
}

function formatUpcomingTiming(daysUntilBirthday: number) {
  if (daysUntilBirthday <= 0) return "today";
  if (daysUntilBirthday === 1) return "tomorrow";
  return `in ${daysUntilBirthday} days`;
}

function mapImportableContactsToPeople(items: ImportableContact[]) {
  return items.map(importableContactToPerson);
}

function shouldSuggestStarterContact(contact: ImportableContact, today: Date) {
  return isPriorityContactName(contact.name) || hasEmojiInName(contact.name) || hasUpcomingBirthday(contact, today);
}

function renderContactRow(
  contact: ImportableContact,
  checked: boolean,
  toggleSelection: (contactId: string) => void
) {
  return (
    <label
      key={contact.contactId}
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1fr",
        gap: "12px",
        alignItems: "center",
        padding: "10px 8px",
        borderRadius: "12px",
        background: checked ? "rgba(27,42,65,0.06)" : "transparent",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggleSelection(contact.contactId)}
        style={{
          position: "absolute",
          opacity: 0,
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          cursor: "pointer",
        }}
      />
      <span
        aria-hidden="true"
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "999px",
          border: checked ? "1px solid var(--dkf-gold)" : "1px solid rgba(216, 180, 106, 0.72)",
          background: checked ? "var(--dkf-gold)" : "transparent",
          color: checked ? "#fff" : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
          transition: "background-color 160ms ease, border-color 160ms ease, color 160ms ease",
        }}
      >
        <span
          style={{
            fontSize: "0.78rem",
            fontWeight: 700,
            lineHeight: 1,
            transform: checked ? "scale(1)" : "scale(0.75)",
            transition: "transform 160ms ease",
          }}
        >
          ✓
        </span>
      </span>
      <div style={{ display: "grid", gap: "4px" }}>
        <div style={{ color: "var(--ink)", fontSize: "1rem", fontWeight: 600 }}>
          {contactPrimaryLabel(contact)}
        </div>
        {contact.phone ? (
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.4 }}>
            {contact.phone}
          </div>
        ) : null}
        {contact.birthday ? (
          <div style={{ color: "var(--muted)", fontSize: "0.88rem", lineHeight: 1.4 }}>
            Birthday: {formatBirthday(contact.birthday)}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export default function ImportContacts() {
  const navigate = useNavigate();
  const { people, createPeople, markOnboardingComplete } = useAppState();

  const [step, setStep] = useState<"entry" | "select" | "done">("entry");
  const [contacts, setContacts] = useState<ImportableContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CONTACTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [recentlyImportedPeople, setRecentlyImportedPeople] = useState<Person[]>([]);
  const [primaryImportedName, setPrimaryImportedName] = useState("");

  const filteredContacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((contact) => {
      const haystacks = [contact.name, contact.phone ?? "", contact.birthday ?? ""];
      return haystacks.some((value) => value.toLowerCase().includes(term));
    });
  }, [contacts, query]);

  const starterContacts = useMemo(() => {
    const today = new Date();
    return [...filteredContacts]
      .filter((contact) => shouldSuggestStarterContact(contact, today))
      .sort((a, b) => compareImportableContacts(a, b, today))
      .slice(0, STARTER_CONTACT_LIMIT);
  }, [filteredContacts]);

  const allContacts = useMemo(() => {
    const starterIds = new Set(starterContacts.map((contact) => contact.contactId));
    return filteredContacts
      .filter((contact) => !starterIds.has(contact.contactId))
      .sort(compareImportableContactsAlphabetically);
  }, [filteredContacts, starterContacts]);

  const visibleAllContacts = useMemo(
    () => allContacts.slice(0, Math.max(0, visibleCount - starterContacts.length)),
    [allContacts, starterContacts.length, visibleCount]
  );

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.includes(contact.contactId)),
    [contacts, selectedIds]
  );
  const contactPeople = useMemo(() => mapImportableContactsToPeople(contacts), [contacts]);
  const selectedContactPeople = useMemo(() => mapImportableContactsToPeople(selectedContacts), [selectedContacts]);
  const remainingFreeSlots = Math.max(0, FREE_PEOPLE_LIMIT - people.length);
  const importAllWouldExceedLimit = countNetNewPeople(people, contactPeople) > remainingFreeSlots;
  const selectedImportWouldExceedLimit = countNetNewPeople(people, selectedContactPeople) > remainingFreeSlots;
  const upcomingBirthdayPeople = useMemo(() => {
    const today = new Date();

    return recentlyImportedPeople
      .map((person) => {
        const birthdayMoment = (person.moments ?? []).find((moment) => moment.type === "birthday") ?? null;
        if (!birthdayMoment?.date) return null;

        const nextBirthday = getNextBirthdayFromIso(birthdayMoment.date, today);
        if (!nextBirthday || nextBirthday.daysUntilBirthday > 30) return null;

        return {
          id: person.id,
          name: person.name,
          timingLabel: formatUpcomingTiming(nextBirthday.daysUntilBirthday),
          daysUntilBirthday: nextBirthday.daysUntilBirthday,
        };
      })
      .filter((person): person is { id: string; name: string; timingLabel: string; daysUntilBirthday: number } => Boolean(person))
      .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday)
      .slice(0, 5);
  }, [recentlyImportedPeople]);

  const firstImportedId = importedIds[0] ?? null;

  async function prepareContacts() {
    if (!isContactImportSupported()) {
      setError("Contact import works on the iPhone app. You can still add people manually.");
      return [];
    }

    setIsLoading(true);
    setError("");
    try {
      const allowed = await ensureContactPermission();
      if (!allowed) {
        setError("We need contact access before we can help you choose people.");
        return [];
      }

      const loaded = await loadImportableContacts();
      setContacts(loaded);
      setVisibleCount(INITIAL_VISIBLE_CONTACTS);
      return loaded;
    } catch {
      setError("We couldn't load your contacts right now.");
      return [];
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    if (step === "select") {
      setStep("entry");
      setQuery("");
      return;
    }

    if (step === "done") {
      navigate("/home", { state: { defaultTab: "contacts" } });
      return;
    }

    navigate("/home", { state: { defaultTab: "contacts" } });
  }

  async function openSelectFlow() {
    const loaded = contacts.length ? contacts : await prepareContacts();
    if (!loaded.length && !contacts.length) return;
    setStep("select");
  }

  function finishImport(items: ImportableContact[]) {
    const importedPeople = mapImportableContactsToPeople(items);
    if (wouldExceedFreePeopleLimit(people, importedPeople)) {
      navigate("/paywall", {
        state: {
          fallbackPath: "/import",
          source: "people-limit",
        },
      });
      return;
    }

    createPeople(importedPeople);
    markOnboardingComplete();
    setImportedIds(importedPeople.map((person) => person.id));
    setRecentlyImportedPeople(importedPeople);
    setPrimaryImportedName(importedPeople[0]?.name ?? "");
    setSelectedIds([]);
    setQuery("");
    setStep("done");
  }

  async function importAllContacts() {
    const loaded = contacts.length ? contacts : await prepareContacts();
    if (!loaded.length) return;
    finishImport(loaded);
  }

  function importSelectedContacts() {
    if (!selectedContacts.length) return;
    finishImport(selectedContacts);
  }

  function toggleSelection(contactId: string) {
    setSelectedIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  }

  function openDetailWithConnection(type: "child" | "partner") {
    if (!firstImportedId) {
      navigate("/home", { state: { defaultTab: "contacts" } });
      return;
    }

    navigate(`/person/${firstImportedId}`, { state: { startConnectionType: type } });
  }

  function openPersonSetup(personId: string) {
    navigate(`/person/${personId}`);
  }

  return (
    <div style={{ background: "var(--paper)", color: "var(--ink)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          padding: "64px 16px 24px",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{
            padding: 0,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "var(--muted)",
            fontSize: "0.95rem",
            fontWeight: 500,
            fontFamily: "var(--font-sans)",
          }}
        >
          ← Back
        </button>

        {step === "entry" ? (
            <div style={{ marginTop: "24px", textAlign: "center", display: "grid", gap: "14px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600 }}>
              Who should we keep track of?
              </div>
              <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              Start with a few people you don’t want to forget.
              </div>

            {error ? (
              <div
                style={{
                  marginTop: "6px",
                  border: "1px solid var(--border)",
                  borderRadius: "14px",
                  padding: "12px 14px",
                  color: "var(--muted)",
                  lineHeight: 1.55,
                  textAlign: "left",
                }}
              >
                {error}
              </div>
            ) : null}

            <div style={{ marginTop: "8px", display: "grid", gap: "10px" }}>
              <button type="button" onClick={() => void openSelectFlow()} disabled={isLoading}>
                {isLoading ? "Loading contacts..." : "Select people"}
              </button>
              <button
                type="button"
                onClick={() => void importAllContacts()}
                disabled={isLoading}
                style={{
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                  fontSize: "1rem",
                  background: "transparent",
                }}
              >
                Import all contacts
              </button>
              {contacts.length > 0 && importAllWouldExceedLimit ? (
                <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Add up to 3 people for free.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "select" ? (
          <div style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600 }}>
                Select people
              </div>
              <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                Choose the people you want close at hand. We’ll just bring in the basics.
              </div>
            </div>

            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(INITIAL_VISIBLE_CONTACTS);
              }}
              placeholder="Search contacts"
              style={{
                width: "100%",
                padding: "0.85rem 1rem",
                borderRadius: "14px",
                border: "1px solid var(--border-strong)",
                background: "var(--card)",
                color: "var(--ink)",
                fontSize: "1rem",
                fontFamily: "var(--font-sans)",
              }}
            />

            <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>
              {selectedIds.length > 0
                ? `${selectedIds.length} selected`
                : `${filteredContacts.length} contacts available`}
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "12px",
                background: "rgba(255,255,255,0.7)",
              }}
            >
              {starterContacts.length > 0 || visibleAllContacts.length > 0 ? (
                <>
                  {starterContacts.length > 0 ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div
                        style={{
                          padding: "4px 8px 0",
                          color: "var(--muted)",
                          fontSize: "0.82rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        Try starting with these
                      </div>
                      {starterContacts.map((contact) =>
                        renderContactRow(contact, selectedIds.includes(contact.contactId), toggleSelection)
                      )}
                    </div>
                  ) : null}

                  {starterContacts.length > 0 && visibleAllContacts.length > 0 ? (
                    <div
                      style={{
                        margin: "2px 8px",
                        borderTop: "1px solid rgba(27,42,65,0.1)",
                        paddingTop: "12px",
                      }}
                    />
                  ) : null}

                  {visibleAllContacts.length > 0 ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div
                        style={{
                          padding: "0 8px",
                          color: "var(--muted)",
                          fontSize: "0.82rem",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          fontWeight: 600,
                        }}
                      >
                        All contacts
                      </div>
                      {visibleAllContacts.map((contact) =>
                        renderContactRow(contact, selectedIds.includes(contact.contactId), toggleSelection)
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ padding: "12px 8px", color: "var(--muted)", lineHeight: 1.5 }}>
                  {contacts.length === 0 ? "No contacts found." : "No matches yet. Try a different search."}
                </div>
              )}
            </div>

            {starterContacts.length + visibleAllContacts.length < filteredContacts.length ? (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + VISIBLE_CONTACTS_STEP)}
                style={{
                  borderRadius: "12px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.95rem",
                  background: "transparent",
                }}
              >
                Show more
              </button>
            ) : null}

            <div style={{ display: "grid", gap: "10px", marginTop: "8px" }}>
              <button type="button" onClick={importSelectedContacts} disabled={selectedIds.length === 0}>
                {selectedIds.length > 0 ? `Add ${selectedIds.length} people to your list` : "Import selected"}
              </button>
              {selectedIds.length > 0 && selectedImportWouldExceedLimit ? (
                <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Add up to 3 people for free.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setStep("entry")}
                style={{
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                  fontSize: "1rem",
                  background: "transparent",
                }}
              >
                Back to choices
              </button>
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div style={{ marginTop: "24px", display: "grid", gap: "14px" }}>
            <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600 }}>
              {importedIds.length > 1 ? `Added ${importedIds.length} people` : "Added someone important"}
            </div>
            <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
              {firstImportedId ? `Start with ${firstName(primaryImportedName || "them")}` : "Start with them"}
            </div>

            {upcomingBirthdayPeople.length > 0 ? (
              <div
                style={{
                  marginTop: "6px",
                  display: "grid",
                  gap: "10px",
                  border: "1px solid var(--border)",
                  borderRadius: "16px",
                  padding: "14px",
                  background: "rgba(255,255,255,0.7)",
                }}
              >
                <div style={{ display: "grid", gap: "4px" }}>
                  <div style={{ color: "var(--ink)", fontSize: "1rem", fontWeight: 600 }}>
                    What’s coming up
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>
                    We’ll remind you before these dates.
                  </div>
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  {upcomingBirthdayPeople.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => openPersonSetup(person.id)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "1rem",
                        alignItems: "center",
                        width: "100%",
                        padding: "0.85rem 0.95rem",
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        background: "var(--card)",
                        color: "var(--ink)",
                        textAlign: "left",
                        fontSize: "0.98rem",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{person.name}</span>
                      <span style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>{person.timingLabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ display: "grid", gap: "10px", marginTop: "8px" }}>
              <button type="button" onClick={() => openDetailWithConnection("child")}>
                Add child
              </button>
              <button
                type="button"
                onClick={() => openDetailWithConnection("partner")}
                style={{
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                  fontSize: "1rem",
                  background: "transparent",
                }}
              >
                Add partner
              </button>
              <button
                type="button"
                onClick={() => navigate("/home", { state: { defaultTab: "contacts" } })}
                style={{
                  borderRadius: "12px",
                  padding: "0.85rem 1rem",
                  fontSize: "1rem",
                  background: "transparent",
                }}
              >
                Skip
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
