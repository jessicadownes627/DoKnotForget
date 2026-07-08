import { buildAddPersonRelationshipPersistence } from "./addPersonRelationshipPersistence.js";
function assertEqual(label, actual, expected) {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
    }
}
function makeIdFactory() {
    let count = 0;
    return () => `id-${++count}`;
}
export function runPhase3WriteValidation() {
    const lines = [];
    {
        const result = buildAddPersonRelationshipPersistence({
            personId: "mom",
            makeId: makeIdFactory(),
            selectedRelationshipType: "parent",
            selectedConnectionId: "",
            connectionRelationship: "friend",
        });
        assertEqual("direct parent link count", result.createdRelationshipLinksV2.length, 1);
        assertEqual("direct parent anchor", result.createdRelationshipLinksV2[0]?.anchor.kind, "user");
        assertEqual("direct parent role", result.createdRelationshipLinksV2[0]?.relationshipToAnchor, "parent");
        assertEqual("direct parent legacy field", result.legacyPersonPatch.parentRole, "parent");
        assertEqual("direct parent graph count", result.createdRelationships.length, 0);
        lines.push("PASS direct parent writes V2 direct link plus parentRole compatibility");
    }
    {
        const result = buildAddPersonRelationshipPersistence({
            personId: "ryan",
            makeId: makeIdFactory(),
            selectedRelationshipType: "friend",
            selectedConnectionId: "",
            connectionRelationship: "friend",
        });
        assertEqual("direct friend link count", result.createdRelationshipLinksV2.length, 1);
        assertEqual("direct friend role", result.createdRelationshipLinksV2[0]?.relationshipToAnchor, "friend");
        assertEqual("direct friend parentRole", result.legacyPersonPatch.parentRole, undefined);
        assertEqual("direct friend partnerId", result.legacyPersonPatch.partnerId, null);
        lines.push("PASS direct friend writes V2 only and no contradictory legacy mirror");
    }
    {
        const result = buildAddPersonRelationshipPersistence({
            personId: "jane",
            makeId: makeIdFactory(),
            selectedRelationshipType: "child",
            selectedConnectionId: "ashley",
            connectionRelationship: "child",
        });
        assertEqual("anchored child V2 count", result.createdRelationshipLinksV2.length, 1);
        assertEqual("anchored child role", result.createdRelationshipLinksV2[0]?.relationshipToAnchor, "child");
        assertEqual("anchored child anchor", result.createdRelationshipLinksV2[0]?.anchor.kind, "person");
        assertEqual("anchored child graph count", result.createdRelationships.length, 1);
        assertEqual("anchored child graph type", result.createdRelationships[0]?.type, "child");
        assertEqual("anchored child graph from", result.createdRelationships[0]?.fromId, "ashley");
        assertEqual("anchored child graph to", result.createdRelationships[0]?.toId, "jane");
        lines.push("PASS anchored child writes matching V2 and legacy graph data");
    }
    {
        const result = buildAddPersonRelationshipPersistence({
            personId: "ben",
            makeId: makeIdFactory(),
            selectedRelationshipType: "partner",
            selectedConnectionId: "j",
            connectionRelationship: "partner",
        });
        assertEqual("anchored partner V2 role", result.createdRelationshipLinksV2[0]?.relationshipToAnchor, "partner");
        assertEqual("anchored partner legacy partnerId", result.legacyPersonPatch.partnerId, "j");
        assertEqual("anchored partner graph type", result.createdRelationships[0]?.type, "partner");
        lines.push("PASS anchored partner writes V2 link plus partnerId compatibility");
    }
    {
        const result = buildAddPersonRelationshipPersistence({
            personId: "morgan",
            makeId: makeIdFactory(),
            selectedRelationshipType: "partner",
            selectedConnectionId: "",
            connectionRelationship: "partner",
        });
        assertEqual("direct partner V2 role", result.createdRelationshipLinksV2[0]?.relationshipToAnchor, "partner");
        assertEqual("direct partner legacy partnerId", result.legacyPersonPatch.partnerId, null);
        assertEqual("direct partner graph count", result.createdRelationships.length, 0);
        lines.push("PASS direct partner writes V2 only because no safe legacy mirror exists");
    }
    return lines.join("\n");
}
if (typeof process !== "undefined" && import.meta.url === `file://${process.argv?.[1] ?? ""}`) {
    try {
        console.log(runPhase3WriteValidation());
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
