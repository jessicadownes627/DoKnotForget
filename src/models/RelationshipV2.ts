export type RelationshipV2Role =
  | "parent"
  | "child"
  | "partner"
  | "sibling"
  | "friend"
  | "other"
  | "unknown";

export type RelationshipV2Source =
  | "graphRelationship"
  | "personPartnerId"
  | "personParentRole"
  | "embeddedChild"
  | "standalonePerson";

export type RelationshipV2Confidence = "explicit" | "derived" | "ambiguous";

export type RelationshipV2SubjectRef =
  | { kind: "person"; personId: string }
  | { kind: "child"; parentId: string; childId: string };

export type RelationshipV2AnchorRef =
  | { kind: "user" }
  | { kind: "person"; personId: string };

export type RelationshipV2RecipientRef =
  | { kind: "person"; personId: string }
  | { kind: "unknown" };

export interface RelationshipV2Link {
  id: string;
  subject: RelationshipV2SubjectRef;
  anchor: RelationshipV2AnchorRef;
  relationshipToAnchor: RelationshipV2Role;
  source: RelationshipV2Source;
  confidence: RelationshipV2Confidence;
  sourceRelationshipId?: string;
}

export interface RelationshipV2ResolvedEntity {
  ref: RelationshipV2SubjectRef;
  name: string;
  personId?: string;
  parentId?: string;
  childId?: string;
}

export interface RelationshipV2ResolvedRecipient {
  ref: RelationshipV2RecipientRef;
  name: string | null;
  personId?: string;
}

export interface RelationshipV2ResolvedContext {
  subject: RelationshipV2ResolvedEntity;
  directLinkToUser: RelationshipV2Link | null;
  anchoredLink: RelationshipV2Link | null;
  primaryLink: RelationshipV2Link | null;
  allLinks: RelationshipV2Link[];
  suggestedRecipient: RelationshipV2ResolvedRecipient | null;
}
