import { Contacts, type ContactPayload, type PermissionStatus, PhoneType } from "@capacitor-community/contacts";
import { Capacitor } from "@capacitor/core";
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "../appState";
import { useNavigate } from "../router";
import {
  compareImportableContacts,
  compareImportableContactsAlphabetically,
  hasEmojiInName,
  hasUpcomingBirthday,
  importableContactToPerson,
  isPriorityContactName,
  type ImportableContact,
} from "../utils/contactImport";
import {
  wouldExceedFreePeopleLimit,
} from "../utils/freeLimit";
import { displayNameOrFallback } from "../utils/displayName";
import type { Person } from "../models/Person";
import { normalizePhone } from "../utils/phone";

const INITIAL_VISIBLE_CONTACTS = 80;
const VISIBLE_CONTACTS_STEP = 80;
const STARTER_CONTACT_LIMIT = 8;
const STARTER_GROUP_CAP = 2;
const FREE_LIMIT = 3;

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

function looksLikePhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length === value.replace(/[^\d()+\-\s.]/g, "").replace(/\D/g, "").length;
}

function contactPrimaryLabel(contact: ImportableContact) {
  const name = displayNameOrFallback(contact.name, "").trim();
  if (!name) return "No name saved";
  if (contact.phone && name === contact.phone) return "No name saved";
  if (looksLikePhoneNumber(name)) return "No name saved";
  return name;
}

function mapImportableContactsToPeople(items: ImportableContact[]) {
  return items.map(importableContactToPerson);
}

function isContactImportSupported() {
  return typeof window !== "undefined" && Capacitor.getPlatform() !== "web" && Boolean(Contacts);
}

function getContactDisplayName(contact: ContactPayload) {
  const display = (contact.name?.display ?? "").trim();
  if (display) return display;

  const parts = [
    (contact.name?.given ?? "").trim(),
    (contact.name?.middle ?? "").trim(),
    (contact.name?.family ?? "").trim(),
  ].filter(Boolean);
  return parts.join(" ").trim();
}

function getPrimaryPhone(contact: ContactPayload) {
  const phones = contact.phones ?? [];
  const normalized = phones
    .map((phone) => ({
      type: phone.type,
      isPrimary: phone.isPrimary === true,
      number: normalizePhone((phone.number ?? "").trim()) ?? (phone.number ?? "").trim(),
    }))
    .filter((phone) => phone.number);

  if (!normalized.length) return undefined;

  const primary =
    normalized.find((phone) => phone.isPrimary) ??
    normalized.find((phone) => phone.type === PhoneType.Mobile) ??
    normalized[0];

  return primary?.number || undefined;
}

function getBirthdayIso(contact: ContactPayload) {
  const birthday = contact.birthday;
  if (!birthday?.month || !birthday?.day) return undefined;

  const month = String(birthday.month).padStart(2, "0");
  const day = String(birthday.day).padStart(2, "0");
  const year = birthday.year && birthday.year > 0 ? String(birthday.year).padStart(4, "0") : "0000";
  return `${year}-${month}-${day}`;
}

async function requestContactsPermission(reason: "select" | "import-all") {
  const permission = (await Contacts.checkPermissions()) as PermissionStatus;
  console.log("[ImportContacts] Permission result", { reason, permission });
  if (permission.contacts === "granted" || permission.contacts === "limited") return true;

  const requested = (await Contacts.requestPermissions()) as PermissionStatus;
  console.log("[ImportContacts] Permission result", { reason, requested });
  return requested.contacts === "granted" || requested.contacts === "limited";
}

async function loadImportableContactsFromPlugin(reason: "select" | "import-all") {
  const result = await Contacts.getContacts({
    projection: {
      name: true,
      phones: true,
      birthday: true,
    },
  });
  console.log("[ImportContacts] Raw contact results", {
    reason,
    count: (result?.contacts ?? []).length,
  });
  console.log("CONTACTS COUNT:", (result?.contacts ?? []).length);

  const today = new Date();
  const mapped = ((result?.contacts ?? []) as ContactPayload[])
    .map((contact) => {
      const name = getContactDisplayName(contact);
      if (!name) return null;

      const nextContact: ImportableContact = {
        contactId: contact.contactId,
        name,
      };
      const phone = getPrimaryPhone(contact);
      const birthday = getBirthdayIso(contact);
      if (phone) nextContact.phone = phone;
      if (birthday) nextContact.birthday = birthday;
      return nextContact;
    })
    .filter((contact): contact is ImportableContact => Boolean(contact))
    .sort((a, b) => compareImportableContacts(a, b, today));

  console.log("[ImportContacts] Importable contacts mapped", {
    reason,
    count: mapped.length,
  });
  return mapped;
}

function shouldSuggestStarterContact(contact: ImportableContact, today: Date) {
  return isPriorityContactName(contact.name) || hasEmojiInName(contact.name) || hasUpcomingBirthday(contact, today);
}

function normalizeStarterName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesAnyTerm(name: string, terms: string[]) {
  return terms.some((term) => name.includes(term));
}

function starterBucketKey(contact: ImportableContact) {
  const normalized = normalizeStarterName(contact.name);

  if (matchesAnyTerm(normalized, ["mom", "mother"])) return "mom";
  if (matchesAnyTerm(normalized, ["dad", "father"])) return "dad";
  if (
    matchesAnyTerm(normalized, [
      "boyfriend",
      "girlfriend",
      "fiance",
      "fiancee",
      "husband",
      "wife",
      "bae",
      "bf",
      "gf",
    ])
  ) {
    return "partner";
  }
  if (matchesAnyTerm(normalized, ["aunt"])) return "aunt";
  if (matchesAnyTerm(normalized, ["uncle"])) return "uncle";
  if (matchesAnyTerm(normalized, ["cousin", "cous", "cuz"])) return "cousin";
  if (matchesAnyTerm(normalized, ["grandma", "grandpa", "nana", "papa", "mimi", "oma", "opa"])) return "grand";
  if (matchesAnyTerm(normalized, ["ice"])) return "ice";
  if (matchesAnyTerm(normalized, ["work", "office", "boss"])) return "work";
  if (hasEmojiInName(contact.name)) return "emoji";
  if (hasUpcomingBirthday(contact)) return "birthday";
  return "other";
}

function buildStarterContacts(contacts: ImportableContact[], today: Date) {
  const sortedCandidates = contacts
    .filter((contact) => shouldSuggestStarterContact(contact, today))
    .sort((a, b) => compareImportableContacts(a, b, today));

  const selected: ImportableContact[] = [];
  const selectedIds = new Set<string>();
  const bucketCounts = new Map<string, number>();

  function tryAdd(contact: ImportableContact, force = false) {
    if (selected.length >= STARTER_CONTACT_LIMIT) return false;
    if (selectedIds.has(contact.contactId)) return false;

    const bucket = starterBucketKey(contact);
    const nextCount = bucketCounts.get(bucket) ?? 0;
    if (!force && nextCount >= STARTER_GROUP_CAP) return false;

    selected.push(contact);
    selectedIds.add(contact.contactId);
    bucketCounts.set(bucket, nextCount + 1);
    return true;
  }

  for (const mustIncludeBucket of ["mom", "dad", "partner"]) {
    const contact = sortedCandidates.find((candidate) => starterBucketKey(candidate) === mustIncludeBucket);
    if (contact) tryAdd(contact, true);
  }

  for (const contact of sortedCandidates) {
    tryAdd(contact);
  }

  return selected;
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
          appearance: "none",
          WebkitAppearance: "none",
          position: "absolute",
          opacity: 0,
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          padding: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          boxShadow: "none",
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
  const { people, isPremium, createPeople, markOnboardingComplete } = useAppState();

  const [step, setStep] = useState<"entry" | "select" | "done">("entry");
  const [mode, setMode] = useState<"import-all" | "select" | null>(null);
  const [contacts, setContacts] = useState<ImportableContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CONTACTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [importedIds, setImportedIds] = useState<string[]>([]);
  const [recentlyImportedPeople, setRecentlyImportedPeople] = useState<Person[]>([]);

  function resetFlowState() {
    setStep("entry");
    setMode(null);
    setContacts([]);
    setSelectedIds([]);
    setQuery("");
    setVisibleCount(INITIAL_VISIBLE_CONTACTS);
    setIsLoading(false);
    setError("");
    setImportedIds([]);
    setRecentlyImportedPeople([]);
  }

  useEffect(() => {
    resetFlowState();
  }, []);

  const availableContacts = useMemo(
    () =>
      contacts.filter(
        (contact) => !people.some((person) => person.phone && contact.phone && person.phone === contact.phone)
      ),
    [contacts, people]
  );

  const filteredContacts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return availableContacts;
    return availableContacts.filter((contact) => {
      const haystacks = [contact.name, contact.phone ?? "", contact.birthday ?? ""];
      return haystacks.some((value) => value.toLowerCase().includes(term));
    });
  }, [availableContacts, query]);

  const starterContacts = useMemo(() => {
    if (mode !== "import-all") return [];
    if (filteredContacts.length <= 1) return [];
    const today = new Date();
    return buildStarterContacts(filteredContacts, today);
  }, [filteredContacts, mode]);

  const allContacts = useMemo(() => {
    if (mode !== "import-all") {
      return [...filteredContacts].sort(compareImportableContactsAlphabetically);
    }
    const starterIds = new Set(starterContacts.map((contact) => contact.contactId));
    return filteredContacts
      .filter((contact) => !starterIds.has(contact.contactId))
      .sort(compareImportableContactsAlphabetically);
  }, [filteredContacts, mode, starterContacts]);

  const visibleAllContacts = useMemo(
    () => allContacts.slice(0, Math.max(0, visibleCount - starterContacts.length)),
    [allContacts, starterContacts.length, visibleCount]
  );

  const prioritizedSelectedContacts = useMemo(() => {
    const today = new Date();
    return availableContacts
      .filter((contact) => selectedIds.includes(contact.contactId))
      .sort((a, b) => compareImportableContacts(a, b, today));
  }, [availableContacts, selectedIds]);
  const effectiveSelectedContacts = prioritizedSelectedContacts;
  const effectiveSelectedIdSet = useMemo(
    () => new Set(effectiveSelectedContacts.map((contact) => contact.contactId)),
    [effectiveSelectedContacts]
  );
  const selectedImportWouldExceedLimit = !isPremium && people.length + effectiveSelectedContacts.length > FREE_LIMIT;
  const selectedCountLabel =
    effectiveSelectedContacts.length === 1
      ? "Add 1 person to your circle"
      : `Add ${effectiveSelectedContacts.length} people to your circle`;

  async function prepareContacts(reason: "select" | "import-all"): Promise<ImportableContact[] | null> {
    if (!isContactImportSupported()) {
      setError("Contact import works on the iPhone app. You can still add people manually.");
      console.log("[ImportContacts] Contact import unsupported", { reason, platform: Capacitor.getPlatform() });
      return null;
    }

    setIsLoading(true);
    setError("");
    try {
      const allowed = await requestContactsPermission(reason);
      if (!allowed) {
        window.alert("Contacts access was denied.");
        setError("We need contact access before we can help you choose people.");
        console.log("[ImportContacts] Permission denied", { reason });
        return null;
      }

      const loaded = await loadImportableContactsFromPlugin(reason);
      console.log("[ImportContacts] number of contacts loaded", loaded.length);
      setContacts(loaded);
      setVisibleCount(INITIAL_VISIBLE_CONTACTS);
      return loaded;
    } catch (error) {
      console.log("[ImportContacts] Failed to load contacts", { reason, error });
      setError("We couldn't load your contacts right now.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    if (step === "select") {
      resetFlowState();
      return;
    }

    if (step === "done") {
      navigate("/home", { state: { defaultTab: "contacts" } });
      return;
    }

    navigate("/home", { state: { defaultTab: "contacts" } });
  }

  async function handleSelectContacts() {
    console.log("SELECT CLICKED");
    try {
      if (!isPremium && people.length >= FREE_LIMIT) {
        console.log("PAYWALL TRIGGERED");
        navigate("/paywall");
        return;
      }

      setMode("select");
      setSelectedIds([]);
      setQuery("");
      setImportedIds([]);
      setRecentlyImportedPeople([]);
      const loaded = await prepareContacts("select");
      console.log("[ImportContacts] handleSelectContacts stop check", {
        loaded: loaded?.length ?? null,
      });
      if (!loaded) return;
      console.log("[ImportContacts] handleSelectContacts proceeding to select screen");
      setStep("select");
    } catch (error) {
      console.error("[ImportContacts] handleSelectContacts failed", error);
    }
  }

  function finishImport(items: ImportableContact[]) {
    const importedPeople = mapImportableContactsToPeople(items);
    if (!isPremium && (people.length >= FREE_LIMIT || wouldExceedFreePeopleLimit(people, importedPeople))) {
      console.log("PAYWALL TRIGGERED");
      navigate("/paywall", {
        state: {
          fallbackPath: "/import",
          source: "people-limit",
        },
      });
      return;
    }

    createPeople(importedPeople);
    console.log("[ImportContacts] number saved", importedPeople.length);
    markOnboardingComplete();
    setImportedIds(importedPeople.map((person) => person.id));
    setRecentlyImportedPeople(importedPeople);
    setSelectedIds([]);
    setQuery("");
    setStep("done");
  }

  async function handleImportAll() {
    console.log("IMPORT CLICKED");
    try {
      if (!isPremium && people.length >= FREE_LIMIT) {
        console.log("PAYWALL TRIGGERED");
        navigate("/paywall");
        return;
      }

      setMode("import-all");
      setSelectedIds([]);
      setQuery("");
      setImportedIds([]);
      setRecentlyImportedPeople([]);
      const loaded = await prepareContacts("import-all");
      if (!loaded) return;
      const freeSlotsRemaining = isPremium ? Number.MAX_SAFE_INTEGER : Math.max(0, FREE_LIMIT - people.length);
      const availableLoadedContacts = loaded.filter(
        (contact) => !people.some((person) => person.phone && contact.phone && person.phone === contact.phone)
      );
      const contactsToImport = availableLoadedContacts.slice(0, freeSlotsRemaining);
      if (!contactsToImport.length) {
        console.log("PAYWALL TRIGGERED");
        navigate("/paywall");
        return;
      }
      finishImport(contactsToImport);
    } catch (error) {
      console.error("[ImportContacts] handleImportAll failed", error);
    }
  }

  function importSelectedContacts() {
    console.log("[ImportContacts] Import selected contacts pressed", {
      selectedCount: effectiveSelectedContacts.length,
      selectedContactIds: effectiveSelectedContacts.map((contact) => contact.contactId),
    });
    console.log("[ImportContacts] number selected", effectiveSelectedContacts.length);
    if (!isPremium && people.length >= FREE_LIMIT) {
      console.log("PAYWALL TRIGGERED");
      navigate("/paywall");
      return;
    }
    if (!isPremium && people.length + effectiveSelectedContacts.length > FREE_LIMIT) {
      console.log("PAYWALL TRIGGERED");
      navigate("/paywall");
      return;
    }
    if (!effectiveSelectedContacts.length) {
      console.log("PAYWALL TRIGGERED");
      navigate("/paywall", {
        state: {
          fallbackPath: "/import",
          source: "people-limit",
        },
      });
      return;
    }

    finishImport(effectiveSelectedContacts);
  }

  function toggleSelection(contactId: string) {
    setSelectedIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  }

  function openPersonSetup(personId: string) {
    navigate(`/person/${personId}`);
  }

  function goToHomeAfterImport() {
    navigate("/home");
  }

  return (
    <div
      style={{
        background: "var(--paper)",
        color: "var(--ink)",
        minHeight: "100vh",
        paddingBottom: step === "select" ? "120px" : undefined,
      }}
    >
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
              Who’s in your circle?
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
              <button type="button" onClick={() => void handleSelectContacts()} disabled={isLoading}>
                {isLoading ? "Loading contacts..." : "Select people"}
              </button>
              <button
                type="button"
                onClick={() => void handleImportAll()}
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
              {effectiveSelectedContacts.length > 0
                ? `${effectiveSelectedContacts.length} selected`
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
                        renderContactRow(contact, effectiveSelectedIdSet.has(contact.contactId), toggleSelection)
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
                        renderContactRow(contact, effectiveSelectedIdSet.has(contact.contactId), toggleSelection)
                      )}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ padding: "12px 8px", color: "var(--muted)", lineHeight: 1.5 }}>
                  {contacts.length === 0 || availableContacts.length === 0
                    ? "No contacts found. Try reloading or check permissions."
                    : "No matches yet. Try a different search."}
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
              {effectiveSelectedContacts.length > 0 && selectedImportWouldExceedLimit ? (
                <div style={{ color: "var(--muted)", fontSize: "0.92rem", lineHeight: 1.5 }}>
                  Add up to 3 people for free.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {step === "done" ? (
          <div style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ fontFamily: "var(--font-serif)", fontSize: "28px", fontWeight: 600 }}>
                {`You added ${importedIds.length} ${importedIds.length === 1 ? "person" : "people"} to your circle`}
              </div>
              <div style={{ color: "var(--muted)", lineHeight: 1.6 }}>
                Review each person and finish setting them up.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: "10px",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "14px",
                background: "rgba(255,255,255,0.7)",
              }}
            >
              {recentlyImportedPeople.map((person) => {
                const displayName = displayNameOrFallback(person.name);
                return (
                  <div
                    key={person.id}
                    style={{
                      display: "grid",
                      gap: "10px",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      padding: "14px",
                      background: "var(--card)",
                    }}
                  >
                    <div style={{ color: "var(--ink)", fontSize: "1rem", fontWeight: 600 }}>{displayName}</div>
                    <button
                      type="button"
                      onClick={() => openPersonSetup(person.id)}
                      style={{
                        borderRadius: "12px",
                        padding: "0.85rem 1rem",
                        fontSize: "0.98rem",
                        background: "transparent",
                        textAlign: "left",
                      }}
                    >
                      {`Finish setting up ${displayName}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={goToHomeAfterImport}
              style={{
                borderRadius: "12px",
                padding: "0.85rem 1rem",
                fontSize: "1rem",
                background: "transparent",
              }}
            >
              Done
            </button>
          </div>
        ) : null}
      </div>
      {step === "select" ? (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(env(safe-area-inset-bottom) + 12px)",
            transform: "translateX(-50%)",
            width: "min(560px, calc(100vw - 32px))",
            zIndex: 20,
          }}
        >
          <button
            type="button"
            onClick={importSelectedContacts}
            disabled={effectiveSelectedContacts.length === 0}
            style={{
              width: "100%",
              borderRadius: "14px",
              padding: "0.95rem 1rem",
              fontSize: "1rem",
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(10px)",
              boxSizing: "border-box",
            }}
          >
            {effectiveSelectedContacts.length > 0 ? selectedCountLabel : "Add 1 person to your circle"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
