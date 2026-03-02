import type { Person } from "../models/Person";

export function filterContacts(people: Person[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter((p) => p.name.toLowerCase().includes(q));
}

export function initialsFromName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

