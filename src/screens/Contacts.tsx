import { useMemo, useRef, useState } from "react";
import type { Person } from "../models/Person";
import Brand from "../components/Brand";
import ContactsSearchResults from "../components/ContactsSearchResults";
import { SoftGoldDot } from "../components/common/GoldBullets";
import { useAppState } from "../appState";
import { useNavigate } from "../router";
import { filterContacts, initialsFromName } from "../utils/contactSearch";

function groupKeyFromName(name: string) {
  const trimmed = name.trim();
  const first = trimmed.charAt(0).toUpperCase();
  if (first >= "A" && first <= "Z") return first;
  return "#";
}

export default function Contacts() {
  const navigate = useNavigate();
  const { people } = useAppState();
  const [query, setQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function exportMyData() {
    try {
      const rawPeople = window.localStorage.getItem("doknotforget_people");
      const rawRelationships = window.localStorage.getItem("doknotforget_relationships");
      const parsedPeople = rawPeople ? JSON.parse(rawPeople) : [];
      const parsedRelationships = rawRelationships ? JSON.parse(rawRelationships) : [];

      const payload = {
        people: Array.isArray(parsedPeople) ? parsedPeople : [],
        relationships: Array.isArray(parsedRelationships) ? parsedRelationships : [],
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "doknotforget-backup.json";
      a.click();

      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      window.alert("Couldn’t export your data. Please try again.");
    }
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as any;

      const ok = window.confirm("Importing will replace your current contacts and relationships. Continue?");
      if (!ok) return;

      const nextPeople = Array.isArray(parsed?.people) ? parsed.people : [];
      const nextRelationships = Array.isArray(parsed?.relationships) ? parsed.relationships : [];

      window.localStorage.setItem("doknotforget_people", JSON.stringify(nextPeople));
      window.localStorage.setItem("doknotforget_relationships", JSON.stringify(nextRelationships));
      window.location.reload();
    } catch {
      window.alert("That backup file couldn’t be imported. Please select a valid JSON backup.");
    }
  }

  const filtered = useMemo(() => {
    const matched = filterContacts(people, query);
    return [...matched].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [people, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const p of filtered) {
      const key = groupKeyFromName(p.name);
      const bucket = map.get(key);
      if (bucket) bucket.push(p);
      else map.set(key, [p]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({ key: k, people: map.get(k) ?? [] }));
  }, [filtered]);

  return (
    <div
      style={{
        background: "var(--paper)",
        color: "var(--ink)",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: "920px",
          margin: "0 auto",
          padding: "env(safe-area-inset-top) 16px 16px 16px",
          boxSizing: "border-box",
          minHeight: "100vh",
        }}
      >
        <style>{`
          .accent-link { text-decoration: none; }
          .accent-link:hover { text-decoration: underline; text-underline-offset: 3px; }
        `}</style>

        <header>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-serif)",
                fontSize: "2.15rem",
                fontWeight: 600,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
              }}
            >
              <Brand />
            </h1>
            <button
              onClick={() => navigate("/home")}
              style={{
                padding: 0,
                border: "none",
                background: "none",
                color: "var(--muted)",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
              className="accent-link"
            >
              Home
            </button>
          </div>
          <div
            aria-hidden="true"
            style={{
              height: 0,
              borderBottom: "1px solid var(--border)",
              marginTop: "18px",
            }}
          />
        </header>

        <main style={{ marginTop: "28px" }}>
          <div>
            <div className="search-label">Search your contacts</div>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQuery(e.currentTarget.value);
              }}
              placeholder="Find someone…"
              style={{
                width: "100%",
                maxWidth: "520px",
                padding: "0.8rem 0.9rem",
                borderRadius: "12px",
                border: "1px solid var(--border-strong)",
                background: "var(--card)",
                color: "var(--ink)",
                fontSize: "1rem",
              }}
            />
          </div>

          {query.trim() ? (
            <ContactsSearchResults results={filtered} onSelect={(person) => navigate(`/person/${person.id}`)} />
          ) : grouped.length === 0 ? (
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No matches found.</div>
              <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                Try a different name.
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "2rem" }}>
              <div className="contacts-section-header">Your contacts</div>
              {grouped.map((group) => (
                <section key={group.key} aria-label={`Contacts ${group.key}`}>
                  <div className="contacts-alpha-header">
                    {group.key}
                  </div>
                  <div className="contacts-card-list">
                    {group.people.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="contact-row"
                        onClick={() => navigate(`/person/${p.id}`)}
                      >
                        <div className="contact-left">
                          <SoftGoldDot className="contact-dot" />
                          <div className="contact-avatar" aria-hidden="true">
                            {initialsFromName(p.name)}
                          </div>
                        </div>
                        <div className="contact-name">{p.name}</div>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <div style={{ marginTop: "34px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={exportMyData}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                Backup My Contacts
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: 0,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  fontSize: "14px",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 500,
                  textDecoration: "underline",
                  textUnderlineOffset: "3px",
                }}
              >
                Restore From Backup
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0] ?? null;
                  e.currentTarget.value = "";
                  if (!file) return;
                  void importBackup(file);
                }}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
