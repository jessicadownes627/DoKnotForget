import { useMemo, useState } from "react";
import { useAppState } from "../appState";
import { useNavigate } from "../router";
import {
  ensureContactPermission,
  importableContactToPerson,
  isContactImportSupported,
  loadImportableContacts,
  type ImportableContact,
} from "../utils/contactImport";
import { wouldExceedFreePeopleLimit } from "../utils/freeLimit";

const INITIAL_VISIBLE_CONTACTS = 80;
const VISIBLE_CONTACTS_STEP = 80;

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
  const [primaryImportedName, setPrimaryImportedName] = useState("");

  const filteredContacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((contact) => {
      const haystacks = [contact.name, contact.phone ?? "", contact.birthday ?? ""];
      return haystacks.some((value) => value.toLowerCase().includes(term));
    });
  }, [contacts, query]);

  const visibleContacts = useMemo(
    () => filteredContacts.slice(0, visibleCount),
    [filteredContacts, visibleCount]
  );

  const selectedContacts = useMemo(
    () => contacts.filter((contact) => selectedIds.includes(contact.contactId)),
    [contacts, selectedIds]
  );

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
    const importedPeople = items.map(importableContactToPerson);
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
              {visibleContacts.length > 0 ? (
                visibleContacts.map((contact) => {
                  const checked = selectedIds.includes(contact.contactId);
                  return (
                    <label
                      key={contact.contactId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "24px 1fr",
                        gap: "12px",
                        alignItems: "start",
                        padding: "10px 8px",
                        borderRadius: "12px",
                        background: checked ? "rgba(27,42,65,0.06)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelection(contact.contactId)}
                        style={{ marginTop: "3px" }}
                      />
                      <div style={{ display: "grid", gap: "4px" }}>
                        <div style={{ color: "var(--ink)", fontSize: "1rem", fontWeight: 600 }}>
                          {contact.name}
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
                })
              ) : (
                <div style={{ padding: "12px 8px", color: "var(--muted)", lineHeight: 1.5 }}>
                  {contacts.length === 0 ? "No contacts found." : "No matches yet. Try a different search."}
                </div>
              )}
            </div>

            {visibleCount < filteredContacts.length ? (
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
