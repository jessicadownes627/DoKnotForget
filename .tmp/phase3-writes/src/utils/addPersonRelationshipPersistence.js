import { buildCanonicalRelationship } from "./relationshipModel.js";
import { buildPersistedRelationshipV2Link } from "./relationshipV2.js";
function directRoleFromRelationshipType(value) {
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
export function buildAddPersonRelationshipPersistence(args) {
    const selectedConnectionId = args.selectedConnectionId.trim();
    const createdRelationships = [];
    const createdRelationshipLinksV2 = [];
    const legacyPersonPatch = {
        partnerId: null,
        parentRole: undefined,
        isMother: null,
        isFather: null,
    };
    if (selectedConnectionId) {
        if (args.connectionRelationship === "child") {
            createdRelationships.push(buildCanonicalRelationship({
                id: args.makeId(),
                fromId: selectedConnectionId,
                toId: args.personId,
                type: "child",
            }));
            createdRelationshipLinksV2.push(buildPersistedRelationshipV2Link({
                id: args.makeId(),
                subject: { kind: "person", personId: args.personId },
                anchor: { kind: "person", personId: selectedConnectionId },
                relationshipToAnchor: "child",
            }));
        }
        else if (args.connectionRelationship === "parent") {
            createdRelationships.push(buildCanonicalRelationship({
                id: args.makeId(),
                fromId: args.personId,
                toId: selectedConnectionId,
                type: "child",
            }));
            createdRelationshipLinksV2.push(buildPersistedRelationshipV2Link({
                id: args.makeId(),
                subject: { kind: "person", personId: args.personId },
                anchor: { kind: "person", personId: selectedConnectionId },
                relationshipToAnchor: "parent",
            }));
        }
        else {
            createdRelationships.push(buildCanonicalRelationship({
                id: args.makeId(),
                fromId: args.personId,
                toId: selectedConnectionId,
                type: args.connectionRelationship,
            }));
            createdRelationshipLinksV2.push(buildPersistedRelationshipV2Link({
                id: args.makeId(),
                subject: { kind: "person", personId: args.personId },
                anchor: { kind: "person", personId: selectedConnectionId },
                relationshipToAnchor: directRoleFromRelationshipType(args.connectionRelationship),
            }));
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
    createdRelationshipLinksV2.push(buildPersistedRelationshipV2Link({
        id: args.makeId(),
        subject: { kind: "person", personId: args.personId },
        anchor: { kind: "user" },
        relationshipToAnchor: directRole,
    }));
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
