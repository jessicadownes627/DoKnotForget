import { useMemo, useState } from "react";
import type { Person } from "../models/Person";
import Brand from "../components/Brand";

type Props = {
  people: Person[];
  onSelectPerson: (person: Person) => void;
  onGoSoon: () => void;
};

function groupKeyFromName(name: string) {
  const trimmed = name.trim();
  const first = trimmed.charAt(0).toUpperCase();
  if (first >= "A" && first <= "Z") return first;
  return "#";
}

export default function People({ people, onSelectPerson, onGoSoon }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? people.filter((p) => p.name.trim().toLowerCase().includes(q))
      : people;

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
      <div style={{ maxWidth: "920px", margin: "0 auto", padding: "48px 1.5rem 64px" }}>
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
              onClick={onGoSoon}
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
              Soon
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
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              style={{
                width: "100%",
                maxWidth: "520px",
                padding: "0.8rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid var(--border-strong)",
                background: "var(--card)",
                color: "var(--ink)",
                fontSize: "1rem",
              }}
            />
          </div>

          {grouped.length === 0 ? (
            <div style={{ marginTop: "1.5rem" }}>
              <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No matches found.</div>
              <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.92rem" }}>
                Try a different name.
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "2rem", display: "grid", gap: "1.75rem" }}>
              {grouped.map((group) => (
                <section key={group.key} aria-label={`People ${group.key}`}>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: "1.05rem",
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginBottom: "0.65rem",
                    }}
                  >
                    {group.key}
                  </div>
                  <div
                    style={{
                      background: "var(--card)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      overflow: "hidden",
                    }}
                  >
                    {group.people.map((p, idx) => (
                      <button
                        key={p.id}
                        onClick={() => onSelectPerson(p)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "0.95rem 1rem",
                          border: "none",
                          background: "transparent",
                          cursor: "pointer",
                          color: "var(--ink)",
                          fontSize: "1rem",
                          borderTop:
                            idx === 0 ? "none" : "1px solid var(--border)",
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
