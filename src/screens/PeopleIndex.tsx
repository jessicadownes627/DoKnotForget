import { useMemo } from "react";
import type { Person } from "../models/Person";
import PersonArchiveCard from "../components/PersonArchiveCard";

type Props = {
  people: Person[];
  today: Date;
  onSelectPerson: (person: Person) => void;
};

function groupKey(person: Person) {
  const firstName = person.name.trim().split(/\s+/)[0] ?? "";
  const ch = firstName.trim().charAt(0).toUpperCase();
  if (ch >= "A" && ch <= "Z") return ch;
  return "#";
}

export default function PeopleIndex({ people, today, onSelectPerson }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const p of people) {
      const key = groupKey(p);
      const bucket = map.get(key);
      if (bucket) bucket.push(p);
      else map.set(key, [p]);
    }

    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });

    return keys
      .map((key) => ({
        key,
        people: (map.get(key) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
        ),
      }))
      .filter((g) => g.people.length > 0);
  }, [people]);

  if (!grouped.length) {
    return (
      <div style={{ marginTop: "1.5rem" }}>
        <div style={{ color: "var(--ink)", fontSize: "1.05rem", fontWeight: 600 }}>No matches found.</div>
        <div style={{ marginTop: "0.4rem", color: "var(--muted)", fontSize: "0.92rem" }}>Try a different name.</div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "2rem", display: "grid", gap: "2.75rem" }}>
      {grouped.map((group, idx) => (
        <section
          key={group.key}
          aria-label={`People ${group.key}`}
          style={{ marginTop: idx === 0 ? 0 : "0.75rem" }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--ink)",
              letterSpacing: "0.02em",
            }}
          >
            {group.key}
          </div>
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: "var(--border)",
              marginTop: "0.6rem",
              marginBottom: "1rem",
            }}
          />
          <div style={{ display: "grid", gap: "1rem" }}>
            {group.people.map((p) => (
              <PersonArchiveCard key={p.id} person={p} today={today} onClick={() => onSelectPerson(p)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
