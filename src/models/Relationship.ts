export type RelationshipType =
  | "partner"
  | "child"
  | "parent"
  | "sibling"
  | "friend"
  | "other";

export interface Relationship {
  id: string;
  fromId: string; // personId
  toId: string; // related person’s id
  type: RelationshipType;
}

