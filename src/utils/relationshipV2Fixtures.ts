import type { Person } from "../models/Person.js";
import type { Relationship } from "../models/Relationship.js";
import type { RelationshipV2Role, RelationshipV2SubjectRef } from "../models/RelationshipV2.js";

export type RelationshipV2FixtureExpectation = {
  primaryRole: RelationshipV2Role | null;
  directRoleToUser?: RelationshipV2Role | null;
  anchorKind?: "user" | "person" | null;
  anchorPersonId?: string | null;
  recipientPersonId?: string | null;
  linkCount?: number;
};

export type RelationshipV2FixtureSubjectCase = {
  label: string;
  subject: RelationshipV2SubjectRef;
  expect: RelationshipV2FixtureExpectation;
};

export type RelationshipV2Fixture = {
  name: string;
  people: Person[];
  relationships: Relationship[];
  cases: RelationshipV2FixtureSubjectCase[];
};

function person(id: string, name: string, patch: Partial<Person> = {}): Person {
  return {
    id,
    name,
    moments: [],
    ...patch,
  };
}

export const relationshipV2Fixtures: RelationshipV2Fixture[] = [
  {
    name: "direct parent via legacy parentRole",
    people: [person("mom", "Mom", { parentRole: "mother" })],
    relationships: [],
    cases: [
      {
        label: "Mom is understood as the user's parent",
        subject: { kind: "person", personId: "mom" },
        expect: {
          primaryRole: "parent",
          directRoleToUser: "parent",
          anchorKind: "user",
          recipientPersonId: "mom",
          linkCount: 1,
        },
      },
    ],
  },
  {
    name: "child relationship graph stays anchored to parent",
    people: [person("ashley", "Ashley"), person("jane", "Jane")],
    relationships: [{ id: "rel-jane-child", fromId: "ashley", toId: "jane", type: "child" }],
    cases: [
      {
        label: "Jane resolves through Ashley",
        subject: { kind: "person", personId: "jane" },
        expect: {
          primaryRole: "child",
          anchorKind: "person",
          anchorPersonId: "ashley",
          recipientPersonId: "ashley",
          linkCount: 1,
        },
      },
      {
        label: "Ashley resolves as Jane's parent",
        subject: { kind: "person", personId: "ashley" },
        expect: {
          primaryRole: "parent",
          anchorKind: "person",
          anchorPersonId: "jane",
          recipientPersonId: "ashley",
          linkCount: 1,
        },
      },
    ],
  },
  {
    name: "embedded child stays tied to the parent record",
    people: [
      person("j", "J", {
        children: [{ id: "anthony", name: "Anthony", birthday: "2017-07-09" }],
      }),
    ],
    relationships: [],
    cases: [
      {
        label: "Legacy child Anthony resolves through J",
        subject: { kind: "child", parentId: "j", childId: "anthony" },
        expect: {
          primaryRole: "child",
          anchorKind: "person",
          anchorPersonId: "j",
          recipientPersonId: "j",
          linkCount: 1,
        },
      },
    ],
  },
  {
    name: "partner fallback works without graph relationships",
    people: [
      person("j", "J", { partnerId: "ben" }),
      person("ben", "Ben", { partnerId: "j" }),
    ],
    relationships: [],
    cases: [
      {
        label: "Ben resolves as J's partner",
        subject: { kind: "person", personId: "ben" },
        expect: {
          primaryRole: "partner",
          anchorKind: "person",
          anchorPersonId: "j",
          recipientPersonId: "ben",
          linkCount: 1,
        },
      },
      {
        label: "J resolves as Ben's partner",
        subject: { kind: "person", personId: "j" },
        expect: {
          primaryRole: "partner",
          anchorKind: "person",
          anchorPersonId: "ben",
          recipientPersonId: "j",
          linkCount: 1,
        },
      },
    ],
  },
  {
    name: "standalone people stay compatible without invented direct roles",
    people: [person("ryan", "Ryan")],
    relationships: [],
    cases: [
      {
        label: "Ryan remains in the model with unknown direct relationship",
        subject: { kind: "person", personId: "ryan" },
        expect: {
          primaryRole: "unknown",
          directRoleToUser: "unknown",
          anchorKind: "user",
          recipientPersonId: "ryan",
          linkCount: 1,
        },
      },
    ],
  },
  {
    name: "friend relationship graph remains person-to-person",
    people: [person("jessica", "Jessica"), person("ryan", "Ryan")],
    relationships: [{ id: "rel-friend", fromId: "jessica", toId: "ryan", type: "friend" }],
    cases: [
      {
        label: "Ryan resolves through Jessica as a friend",
        subject: { kind: "person", personId: "ryan" },
        expect: {
          primaryRole: "friend",
          anchorKind: "person",
          anchorPersonId: "jessica",
          recipientPersonId: "ryan",
          linkCount: 1,
        },
      },
    ],
  },
];
