import type { Child, Person } from "../models/Person.js";
import type { Relationship } from "../models/Relationship.js";
import type {
  RelationshipV2AnchorRef,
  RelationshipV2Confidence,
  RelationshipV2Link,
  RelationshipV2RecipientRef,
  RelationshipV2ResolvedContext,
  RelationshipV2ResolvedEntity,
  RelationshipV2ResolvedRecipient,
  RelationshipV2Role,
  RelationshipV2Source,
  RelationshipV2SubjectRef,
} from "../models/RelationshipV2.js";
import { normalizeRelationships } from "./relationshipModel.js";

type RelationshipV2BuildInput = {
  people: Person[];
  relationships: Relationship[];
};

const USER_ANCHOR: RelationshipV2AnchorRef = { kind: "user" };

function personRef(personId: string): RelationshipV2SubjectRef {
  return { kind: "person", personId };
}

function childRef(parentId: string, childId: string): RelationshipV2SubjectRef {
  return { kind: "child", parentId, childId };
}

function personAnchor(personId: string): RelationshipV2AnchorRef {
  return { kind: "person", personId };
}

function subjectKey(subject: RelationshipV2SubjectRef) {
  return subject.kind === "person"
    ? `person:${subject.personId}`
    : `child:${subject.parentId}:${subject.childId}`;
}

function anchorKey(anchor: RelationshipV2AnchorRef) {
  return anchor.kind === "user" ? "user" : `person:${anchor.personId}`;
}

function confidenceRank(confidence: RelationshipV2Confidence) {
  switch (confidence) {
    case "explicit":
      return 3;
    case "derived":
      return 2;
    case "ambiguous":
      return 1;
  }
}

function roleRank(role: RelationshipV2Role) {
  switch (role) {
    case "unknown":
      return 0;
    case "other":
      return 1;
    case "friend":
      return 2;
    case "sibling":
      return 3;
    case "partner":
      return 4;
    case "parent":
    case "child":
      return 5;
  }
}

function relationshipSourceRank(source: RelationshipV2Source) {
  switch (source) {
    case "graphRelationship":
      return 5;
    case "embeddedChild":
      return 4;
    case "personPartnerId":
      return 3;
    case "personParentRole":
      return 2;
    case "standalonePerson":
      return 1;
  }
}

function linkSortValue(link: RelationshipV2Link) {
  return (
    confidenceRank(link.confidence) * 100 +
    roleRank(link.relationshipToAnchor) * 10 +
    relationshipSourceRank(link.source)
  );
}

function reverseRelationship(role: RelationshipV2Role): RelationshipV2Role {
  switch (role) {
    case "child":
      return "parent";
    case "parent":
      return "child";
    default:
      return role;
  }
}

function buildLink(args: {
  subject: RelationshipV2SubjectRef;
  anchor: RelationshipV2AnchorRef;
  relationshipToAnchor: RelationshipV2Role;
  source: RelationshipV2Source;
  confidence: RelationshipV2Confidence;
  sourceRelationshipId?: string;
}) {
  const idParts = [
    args.source,
    subjectKey(args.subject),
    anchorKey(args.anchor),
    args.relationshipToAnchor,
    args.sourceRelationshipId ?? "local",
  ];

  return {
    id: idParts.join("|"),
    subject: args.subject,
    anchor: args.anchor,
    relationshipToAnchor: args.relationshipToAnchor,
    source: args.source,
    confidence: args.confidence,
    sourceRelationshipId: args.sourceRelationshipId,
  } satisfies RelationshipV2Link;
}

function pushUniqueLink(target: RelationshipV2Link[], seen: Set<string>, link: RelationshipV2Link) {
  const key = `${subjectKey(link.subject)}|${anchorKey(link.anchor)}|${link.relationshipToAnchor}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(link);
}

function findLegacyDirectParentRole(person: Person): RelationshipV2Role | null {
  if (person.parentRole === "mother" || person.parentRole === "father" || person.parentRole === "parent") {
    return "parent";
  }
  if (person.isMother || person.isFather) return "parent";
  return null;
}

function findPerson(people: Person[], personId: string) {
  return people.find((person) => person.id === personId) ?? null;
}

function findChild(people: Person[], parentId: string, childId: string): Child | null {
  const parent = findPerson(people, parentId);
  if (!parent) return null;
  return (parent.children ?? []).find((child) => child.id === childId) ?? null;
}

function firstAvailableName(value: string | undefined | null, fallback: string) {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
}

export function buildRelationshipV2Links({ people, relationships }: RelationshipV2BuildInput): RelationshipV2Link[] {
  const links: RelationshipV2Link[] = [];
  const seen = new Set<string>();
  const normalized = normalizeRelationships(relationships);

  for (const relationship of normalized) {
    if (relationship.type === "child") {
      pushUniqueLink(
        links,
        seen,
        buildLink({
          subject: personRef(relationship.toId),
          anchor: personAnchor(relationship.fromId),
          relationshipToAnchor: "child",
          source: "graphRelationship",
          confidence: "explicit",
          sourceRelationshipId: relationship.id,
        })
      );
      pushUniqueLink(
        links,
        seen,
        buildLink({
          subject: personRef(relationship.fromId),
          anchor: personAnchor(relationship.toId),
          relationshipToAnchor: "parent",
          source: "graphRelationship",
          confidence: "derived",
          sourceRelationshipId: relationship.id,
        })
      );
      continue;
    }

    pushUniqueLink(
      links,
      seen,
      buildLink({
        subject: personRef(relationship.fromId),
        anchor: personAnchor(relationship.toId),
        relationshipToAnchor: relationship.type,
        source: "graphRelationship",
        confidence: "explicit",
        sourceRelationshipId: relationship.id,
      })
    );
    pushUniqueLink(
      links,
      seen,
      buildLink({
        subject: personRef(relationship.toId),
        anchor: personAnchor(relationship.fromId),
        relationshipToAnchor: reverseRelationship(relationship.type),
        source: "graphRelationship",
        confidence: "explicit",
        sourceRelationshipId: relationship.id,
      })
    );
  }

  for (const person of people) {
    const directRole = findLegacyDirectParentRole(person);
    if (directRole) {
      pushUniqueLink(
        links,
        seen,
        buildLink({
          subject: personRef(person.id),
          anchor: USER_ANCHOR,
          relationshipToAnchor: directRole,
          source: "personParentRole",
          confidence: "explicit",
        })
      );
    }

    const partnerId = (person.partnerId ?? "").trim();
    if (partnerId) {
      pushUniqueLink(
        links,
        seen,
        buildLink({
          subject: personRef(person.id),
          anchor: personAnchor(partnerId),
          relationshipToAnchor: "partner",
          source: "personPartnerId",
          confidence: "explicit",
        })
      );
    }

    for (const child of person.children ?? []) {
      pushUniqueLink(
        links,
        seen,
        buildLink({
          subject: childRef(person.id, child.id),
          anchor: personAnchor(person.id),
          relationshipToAnchor: "child",
          source: "embeddedChild",
          confidence: "explicit",
        })
      );
    }
  }

  const subjectsWithAnyLink = new Set(links.map((link) => subjectKey(link.subject)));

  for (const person of people) {
    const key = subjectKey(personRef(person.id));
    if (subjectsWithAnyLink.has(key)) continue;
    pushUniqueLink(
      links,
      seen,
      buildLink({
        subject: personRef(person.id),
        anchor: USER_ANCHOR,
        relationshipToAnchor: "unknown",
        source: "standalonePerson",
        confidence: "ambiguous",
      })
    );
  }

  return links.sort((a, b) => linkSortValue(b) - linkSortValue(a));
}

export function resolveRelationshipV2Entity(
  subject: RelationshipV2SubjectRef,
  people: Person[]
): RelationshipV2ResolvedEntity {
  if (subject.kind === "person") {
    const person = findPerson(people, subject.personId);
    return {
      ref: subject,
      name: firstAvailableName(person?.name, "Unknown person"),
      personId: subject.personId,
    };
  }

  const child = findChild(people, subject.parentId, subject.childId);
  return {
    ref: subject,
    name: firstAvailableName(child?.name, "Child"),
    parentId: subject.parentId,
    childId: subject.childId,
  };
}

function resolveRecipientFromLink(
  subject: RelationshipV2ResolvedEntity,
  primaryLink: RelationshipV2Link | null,
  people: Person[]
): RelationshipV2ResolvedRecipient | null {
  if (!primaryLink) {
    if (subject.ref.kind === "person") {
      const person = findPerson(people, subject.ref.personId);
      return {
        ref: { kind: "person", personId: subject.ref.personId },
        name: firstAvailableName(person?.name, subject.name),
        personId: subject.ref.personId,
      };
    }
    return null;
  }

  if (primaryLink.anchor.kind === "person" && primaryLink.relationshipToAnchor === "child") {
    const person = findPerson(people, primaryLink.anchor.personId);
    return {
      ref: { kind: "person", personId: primaryLink.anchor.personId },
      name: firstAvailableName(person?.name, "Unknown person"),
      personId: primaryLink.anchor.personId,
    };
  }

  if (subject.ref.kind === "person") {
    const person = findPerson(people, subject.ref.personId);
    return {
      ref: { kind: "person", personId: subject.ref.personId },
      name: firstAvailableName(person?.name, subject.name),
      personId: subject.ref.personId,
    };
  }

  if (primaryLink.anchor.kind === "person") {
    const person = findPerson(people, primaryLink.anchor.personId);
    return {
      ref: { kind: "person", personId: primaryLink.anchor.personId },
      name: firstAvailableName(person?.name, "Unknown person"),
      personId: primaryLink.anchor.personId,
    };
  }

  return { ref: { kind: "unknown" }, name: null };
}

function sortLinksForResolution(a: RelationshipV2Link, b: RelationshipV2Link) {
  return linkSortValue(b) - linkSortValue(a);
}

export function resolveRelationshipV2Context(args: {
  subject: RelationshipV2SubjectRef;
  people: Person[];
  relationships: Relationship[];
  links?: RelationshipV2Link[];
}): RelationshipV2ResolvedContext {
  const links = args.links ?? buildRelationshipV2Links({ people: args.people, relationships: args.relationships });
  const allLinks = links
    .filter((link) => subjectKey(link.subject) === subjectKey(args.subject))
    .sort(sortLinksForResolution);
  const directLinkToUser =
    allLinks.find((link) => link.anchor.kind === "user" && link.relationshipToAnchor !== "unknown") ??
    allLinks.find((link) => link.anchor.kind === "user") ??
    null;
  const anchoredLink = allLinks.find((link) => link.anchor.kind === "person") ?? null;
  const primaryLink =
    directLinkToUser && directLinkToUser.relationshipToAnchor !== "unknown"
      ? directLinkToUser
      : (anchoredLink ?? directLinkToUser ?? null);
  const subject = resolveRelationshipV2Entity(args.subject, args.people);

  return {
    subject,
    directLinkToUser,
    anchoredLink,
    primaryLink,
    allLinks,
    suggestedRecipient: resolveRecipientFromLink(subject, primaryLink, args.people),
  };
}

export function describeRelationshipV2Ref(ref: RelationshipV2SubjectRef | RelationshipV2RecipientRef) {
  if (ref.kind === "unknown") return "unknown";
  if (ref.kind === "person") return `person:${ref.personId}`;
  return `child:${ref.parentId}:${ref.childId}`;
}
