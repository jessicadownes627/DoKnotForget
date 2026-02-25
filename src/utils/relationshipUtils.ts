import type { Person } from "../models/Person";
import type { Relationship, RelationshipType } from "../models/Relationship";

const PEOPLE_STORAGE_KEY = "doknotforget_people";
const RELATIONSHIPS_STORAGE_KEY = "doknotforget_relationships";

function loadPeople(): Person[] {
  try {
    const raw = window.localStorage.getItem(PEOPLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Person[]) : [];
  } catch {
    return [];
  }
}

function loadRelationships(): Relationship[] {
  try {
    const raw = window.localStorage.getItem(RELATIONSHIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Relationship[]) : [];
  } catch {
    return [];
  }
}

function saveRelationships(relationships: Relationship[]) {
  window.localStorage.setItem(RELATIONSHIPS_STORAGE_KEY, JSON.stringify(relationships));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getRelationshipsForPerson(personId: string): Relationship[] {
  return loadRelationships().filter((rel) => rel.fromId === personId || rel.toId === personId);
}

export function getRelatedPeople(personId: string): Person[] {
  const relationships = loadRelationships().filter((rel) => rel.fromId === personId);
  const people = loadPeople();
  const relatedIds = new Set(relationships.map((rel) => rel.toId));
  return people.filter((p) => relatedIds.has(p.id));
}

export function addRelationship(fromId: string, toId: string, type: RelationshipType): Relationship {
  const relationships = loadRelationships();
  const relationship: Relationship = { id: makeId(), fromId, toId, type };
  relationships.push(relationship);
  saveRelationships(relationships);
  return relationship;
}

export function removeRelationship(id: string): void {
  const relationships = loadRelationships().filter((rel) => rel.id !== id);
  saveRelationships(relationships);
}

