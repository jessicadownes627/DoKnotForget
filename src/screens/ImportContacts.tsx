import { useMemo, useState } from "react";
import { useNavigate } from "../router";
import { useAppState } from "../appState";
import type { Person } from "../models/Person";
import { normalizePhone as normalizePhoneE164 } from "../utils/phone";

type PickedContact = {
  name: string;
  phone: string;
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

export default function ImportContacts() {
  const navigate = useNavigate();
  const { createPerson } = useAppState();
  const [picked, setPicked] = useState<PickedContact[]>([]);
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const supported = typeof window !== "undefined" && Boolean(getCapacitorContactsPlugin());

  async function pickContacts() {
    setError(null);
    if (!supported) return;
    try {
      const plugin = getCapacitorContactsPlugin();
      if (!plugin) return;
      if (plugin.requestPermissions) await plugin.requestPermissions();
      else if (plugin.getPermissions) await plugin.getPermissions();

      const result: CapacitorContactsResult = plugin.getContacts ? await plugin.getContacts() : { contacts: [] };
      const contacts = Array.isArray((result as any)?.contacts) ? (result as any).contacts : Array.isArray(result) ? result : [];
      const next: PickedContact[] = [];
      for (const c of contacts ?? []) {
        const trimmedName = extractName(c);
        const trimmedPhone = extractPhone(c);
        if (!trimmedName || !trimmedPhone) continue;
        next.push({ name: trimmedName, phone: trimmedPhone });
      }
      setPicked(next);
    } catch (e: any) {
      // User cancelled or permission denied.
      setError(e?.message ? String(e.message) : "Couldn’t access contacts.");
    }
  }

  const sortedPicked = useMemo(() => {
    return [...picked].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [picked]);

  function addContact(c: PickedContact) {
    const key = contactKey(c);
    if (addedKeys.has(key)) return;

    const normalizedPhone = normalizePhoneE164(c.phone) ?? null;
    const person: Person = {
      id: makeId(),
      name: c.name,
      phone: normalizedPhone || undefined,
      moments: [],
    };
    createPerson(person);
    setAddedKeys((prev) => new Set(prev).add(key));
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
            Import from Contacts
          </div>

          {!supported ? (
            <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
              Contacts import is available in the iOS app. You can still add people manually.
            </div>
          ) : (
            <>
              <div style={{ marginTop: "14px", color: "var(--muted)", lineHeight: 1.6 }}>
                Choose contacts to import. We’ll only save name and phone for now.
              </div>

              <div style={{ marginTop: "16px" }}>
                <button type="button" onClick={pickContacts}>
                  Choose contacts
                </button>
              </div>
            </>
          )}

          {error ? (
            <div style={{ marginTop: "12px", color: "var(--muted)", fontSize: "0.95rem" }}>
              {error}
            </div>
          ) : null}

          {sortedPicked.length ? (
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
                    const isAdded = addedKeys.has(key);
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
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: "var(--ink)", lineHeight: 1.25 }}>{c.name}</div>
                          <div style={{ color: "var(--muted)", fontSize: "0.95rem", marginTop: "2px" }}>{c.phone}</div>
                        </div>

                        {isAdded ? (
                          <div style={{ color: "var(--muted)", fontSize: "0.95rem" }}>Added ✓</div>
                        ) : (
                          <button type="button" onClick={() => addContact(c)} style={{ padding: "0.6rem 0.9rem" }}>
                            Add
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => navigate("/home")}
                  style={{
                    border: "1px solid var(--border-strong)",
                    background: "transparent",
                    color: "var(--ink)",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
