import type { Person } from "../models/Person.js";
import type { Relationship, RelationshipType } from "../models/Relationship.js";
import type { RelationshipV2Link, RelationshipV2Role } from "../models/RelationshipV2.js";
import { buildCanonicalRelationship } from "./relationshipModel.js";
import { buildPersistedRelationshipV2Link } from "./relationshipV2.js";

type BuildAddPersonRelationshipPersistenceArgs = {
  personId: string;
  makeId: () => string;
  selectedRelationshipType: RelationshipType | null;
  selectedConnectionId: string;
  connectionRelationship: RelationshipType;
};

type BuildAddPersonRelationshipPersistenceResult = {
  createdRelationships: Relationship[];
  createdRelationshipLinksV2: RelationshipV2Link[];
  replaceRelationshipLinksV2ForPersonId: string | null;
  legacyPersonPatch: Pick<Person, "partnerId" | "parentRole" | "isMother" | "isFather">;
};

function directRoleFromRelationshipType(value: RelationshipType): RelationshipV2Role {
  switch (value) {
    case "partner":
      return "partner";
    case "friend":
      return "friend";
    case "child":
      return "child";
    case "parent":
      return "parent";
    case "sibling":
      return "sibling";
    case "other":
      return "other";
  }
}

export function buildAddPersonRelationshipPersistence(
  args: BuildAddPersonRelationshipPersistenceArgs
): BuildAddPersonRelationshipPersistenceResult {
  const selectedConnectionId = args.selectedConnectionId.trim();
  const createdRelationships: Relationship[] = [];
  const createdRelationshipLinksV2: RelationshipV2Link[] = [];
  const legacyPersonPatch: BuildAddPersonRelationshipPersistenceResult["legacyPersonPatch"] = {
    partnerId: null,
    parentRole: undefined,
    isMother: null,
    isFather: null,
  };

  if (selectedConnectionId) {
    if (args.connectionRelationship === "child") {
      createdRelationships.push(
        buildCanonicalRelationship({
          id: args.makeId(),
          fromId: selectedConnectionId,
          toId: args.personId,
          type: "child",
        })
      );
      createdRelationshipLinksV2.push(
        buildPersistedRelationshipV2Link({
          id: args.makeId(),
          subject: { kind: "person", personId: args.personId },
          anchor: { kind: "person", personId: selectedConnectionId },
          relationshipToAnchor: "child",
        })
      );
    } else if (args.connectionRelationship === "parent") {
      createdRelationships.push(
        buildCanonicalRelationship({
          id: args.makeId(),
          fromId: args.personId,
          toId: selectedConnectionId,
          type: "child",
        })
      );
      createdRelationshipLinksV2.push(
        buildPersistedRelationshipV2Link({
          id: args.makeId(),
          subject: { kind: "person", personId: args.personId },
          anchor: { kind: "person", personId: selectedConnectionId },
          relationshipToAnchor: "parent",
        })
      );
    } else {
      createdRelationships.push(
        buildCanonicalRelationship({
          id: args.makeId(),
          fromId: args.personId,
          toId: selectedConnectionId,
          type: args.connectionRelationship,
        })
      );
      createdRelationshipLinksV2.push(
        buildPersistedRelationshipV2Link({
          id: args.makeId(),
          subject: { kind: "person", personId: args.personId },
          anchor: { kind: "person", personId: selectedConnectionId },
          relationshipToAnchor: directRoleFromRelationshipType(args.connectionRelationship),
        })
      );
      if (args.connectionRelationship === "partner") {
        legacyPersonPatch.partnerId = selectedConnectionId;
      }
    }

    return {
      createdRelationships,
      createdRelationshipLinksV2,
      replaceRelationshipLinksV2ForPersonId: args.personId,
      legacyPersonPatch,
    };
  }

  if (!args.selectedRelationshipType) {
    return {
      createdRelationships,
      createdRelationshipLinksV2,
      replaceRelationshipLinksV2ForPersonId: null,
      legacyPersonPatch,
    };
  }

  const directRole = directRoleFromRelationshipType(args.selectedRelationshipType);
  createdRelationshipLinksV2.push(
    buildPersistedRelationshipV2Link({
      id: args.makeId(),
      subject: { kind: "person", personId: args.personId },
      anchor: { kind: "user" },
      relationshipToAnchor: directRole,
    })
  );

  if (directRole === "parent") {
    legacyPersonPatch.parentRole = "parent";
  }

  return {
    createdRelationships,
    createdRelationshipLinksV2,
    replaceRelationshipLinksV2ForPersonId: args.personId,
    legacyPersonPatch,
  };
}
