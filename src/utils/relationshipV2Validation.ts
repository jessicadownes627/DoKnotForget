import type { RelationshipV2FixtureExpectation } from "./relationshipV2Fixtures.js";
import { relationshipV2Fixtures } from "./relationshipV2Fixtures.js";
import { buildRelationshipV2Links, describeRelationshipV2Ref, resolveRelationshipV2Context } from "./relationshipV2.js";

declare const process:
  | {
      argv?: string[];
      exitCode?: number;
    }
  | undefined;

function assertEqual<T>(label: string, actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function validateExpectation(
  fixtureName: string,
  caseLabel: string,
  actual: ReturnType<typeof resolveRelationshipV2Context>,
  expected: RelationshipV2FixtureExpectation
) {
  assertEqual(`${fixtureName} / ${caseLabel} / primaryRole`, actual.primaryLink?.relationshipToAnchor ?? null, expected.primaryRole);
  if (expected.directRoleToUser !== undefined) {
    assertEqual(
      `${fixtureName} / ${caseLabel} / directRoleToUser`,
      actual.directLinkToUser?.relationshipToAnchor ?? null,
      expected.directRoleToUser
    );
  }
  if (expected.anchorKind !== undefined) {
    assertEqual(`${fixtureName} / ${caseLabel} / anchorKind`, actual.primaryLink?.anchor.kind ?? null, expected.anchorKind);
  }
  if (expected.anchorPersonId !== undefined) {
    assertEqual(
      `${fixtureName} / ${caseLabel} / anchorPersonId`,
      actual.primaryLink?.anchor.kind === "person" ? actual.primaryLink.anchor.personId : null,
      expected.anchorPersonId
    );
  }
  if (expected.recipientPersonId !== undefined) {
    assertEqual(
      `${fixtureName} / ${caseLabel} / recipientPersonId`,
      actual.suggestedRecipient?.ref.kind === "person" ? actual.suggestedRecipient.ref.personId : null,
      expected.recipientPersonId
    );
  }
  if (expected.linkCount !== undefined) {
    assertEqual(`${fixtureName} / ${caseLabel} / linkCount`, actual.allLinks.length, expected.linkCount);
  }
}

export function runRelationshipV2Validation() {
  const lines: string[] = [];

  for (const fixture of relationshipV2Fixtures) {
    const links = buildRelationshipV2Links({
      people: fixture.people,
      relationships: fixture.relationships,
    });
    lines.push(`Fixture: ${fixture.name}`);
    lines.push(`  Built links: ${links.length}`);

    for (const testCase of fixture.cases) {
      const resolved = resolveRelationshipV2Context({
        subject: testCase.subject,
        people: fixture.people,
        relationships: fixture.relationships,
        links,
      });

      validateExpectation(fixture.name, testCase.label, resolved, testCase.expect);

      lines.push(
        `  PASS ${testCase.label} -> primary=${resolved.primaryLink?.relationshipToAnchor ?? "none"} recipient=${describeRelationshipV2Ref(
          resolved.suggestedRecipient?.ref ?? { kind: "unknown" }
        )}`
      );
    }
  }

  return lines.join("\n");
}

if (typeof process !== "undefined" && import.meta.url === `file://${process.argv?.[1] ?? ""}`) {
  try {
    const output = runRelationshipV2Validation();
    // eslint-disable-next-line no-console
    console.log(output);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
