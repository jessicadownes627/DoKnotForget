import type { Relationship, RelationshipType } from "../models/Relationship";

function sortIds(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" }) <= 0 ? [a, b] : [b, a];
}

export function canonicalizeRelationship(relationship: Relationship): Relationship {
  if (relationship.type === "parent") {
    return {
      ...relationship,
      fromId: relationship.toId,
      toId: relationship.fromId,
      type: "child",
    };
  }

  if (
    relationship.type === "partner" ||
    relationship.type === "sibling" ||
    relationship.type === "friend" ||
    relationship.type === "other"
  ) {
    const [fromId, toId] = sortIds(relationship.fromId, relationship.toId);
    return {
      ...relationship,
      fromId,
      toId,
    };
  }

  return relationship;
}

export function normalizeRelationships(relationships: Relationship[]) {
  const seen = new Set<string>();
  const normalized: Relationship[] = [];

  for (const relationship of relationships) {
    const canonical = canonicalizeRelationship(relationship);
    const key = `${canonical.type}:${canonical.fromId}:${canonical.toId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(canonical);
  }

  return normalized;
}

export function buildCanonicalRelationship(args: {
  id: string;
  fromId: string;
  toId: string;
  type: RelationshipType;
}): Relationship {
  return canonicalizeRelationship({
    id: args.id,
    fromId: args.fromId,
    toId: args.toId,
    type: args.type,
  });
}
