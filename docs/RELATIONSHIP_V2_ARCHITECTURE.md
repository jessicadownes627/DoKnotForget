# Relationship V2 Architecture

This document defines the Phase 1 relationship engine that now exists in parallel with the current production model.

Phase 2 should consume this contract rather than reading legacy relationship shapes directly.

## Goal

Provide one canonical relationship context that can answer:

- who or what the reminder is about
- who the user should show up for
- what relationship context explains that choice

The engine must preserve ambiguity when the legacy model does not provide enough certainty.

## V2 Types

Defined in [src/models/RelationshipV2.ts](/Volumes/DevSSD/Dev/doknotforget/src/models/RelationshipV2.ts).

### Roles

`RelationshipV2Role`

- `parent`
- `child`
- `partner`
- `sibling`
- `friend`
- `other`
- `unknown`

`unknown` is intentional. It means the current data model does not support a safe direct inference.

### Subject

`RelationshipV2SubjectRef`

- `person`
  - `personId`
- `child`
  - `parentId`
  - `childId`

This allows the new engine to represent both:

- full people in the circle
- legacy embedded children that still exist under a parent record

### Anchor

`RelationshipV2AnchorRef`

- `user`
- `person`
  - `personId`

The anchor is the person or perspective the subject is being understood through.

Examples:

- `Mom` can be anchored to `user`
- `Jane` can be anchored to `Ashley`

### Link

`RelationshipV2Link`

- `subject`
- `anchor`
- `relationshipToAnchor`
- `source`
- `confidence`
- `sourceRelationshipId?`

This is the canonical normalized relationship unit used by the resolver.

### Source

`RelationshipV2Source`

- `graphRelationship`
- `personPartnerId`
- `personParentRole`
- `embeddedChild`
- `standalonePerson`

### Confidence

`RelationshipV2Confidence`

- `explicit`
- `derived`
- `ambiguous`

The engine favors explicit knowledge over derived knowledge, and derived knowledge over ambiguous fallback.

## Resolver Pipeline

Implemented in [src/utils/relationshipV2.ts](/Volumes/DevSSD/Dev/doknotforget/src/utils/relationshipV2.ts).

### 1. Read legacy inputs

Inputs remain unchanged in Phase 1:

- `people: Person[]`
- `relationships: Relationship[]`

No production data is rewritten.

### 2. Normalize graph relationships

Existing graph relationships are canonicalized through the current relationship model first.

Current canonical behavior remains:

- parent/child stored as parent -> child using `type: "child"`
- reciprocal types normalized by id ordering

### 3. Adapt legacy data into V2 links

`buildRelationshipV2Links()` converts all supported legacy sources into `RelationshipV2Link[]`.

Current adapters:

- graph relationships
  - `Ashley -> Jane (child)` becomes:
    - subject `Jane`, anchor `Ashley`, role `child`
    - subject `Ashley`, anchor `Jane`, role `parent`
- `partnerId`
  - creates person-to-person partner links when graph data is absent
- legacy direct parent flags
  - `parentRole`, `isMother`, `isFather`
  - creates direct `subject -> user` links with role `parent`
- embedded `children`
  - creates child subject refs anchored to their parent person
- standalone people
  - creates `unknown` direct links to user so unlinked people still resolve safely

### 4. Resolve a subject into one context

`resolveRelationshipV2Context()` takes:

- a `subject`
- `people`
- `relationships`
- optional prebuilt `links`

It returns one resolved context containing:

- all links for that subject
- direct link to user, if one exists
- anchored link to another person, if one exists
- primary link
- suggested recipient

### 5. Select the primary link

Current priority:

1. explicit direct link to user, if known and not `unknown`
2. anchored person link
3. direct `unknown` link to user
4. `null`

This is the key Phase 1 behavior that prevents the engine from guessing.

Examples:

- `Mom` with `parentRole: mother`
  - primary role: `parent`
  - anchor: `user`
- `Jane` with graph relationship `Ashley -> Jane (child)`
  - primary role: `child`
  - anchor: `Ashley`
- `Ryan` with no relationship data
  - primary role: `unknown`
  - anchor: `user`

## Phase 2 Output Contract

Phase 2 reminder migration should consume the resolved context rather than legacy models directly.

### Current resolved contract

`RelationshipV2ResolvedContext`

- `subject`
  - resolved entity name and ref
- `directLinkToUser`
  - direct relationship if explicitly known
- `anchoredLink`
  - relationship through another person, if present
- `primaryLink`
  - best current relationship interpretation
- `allLinks`
  - all normalized links for the subject
- `suggestedRecipient`
  - best current person to show up for, if resolvable

### Intended Phase 2 reminder consumption

Phase 2 should derive reminder context from this resolved contract:

- `subject`
  - who or what the reminder is about
- `recipient`
  - who the user should likely reach out to
- `anchor`
  - whose story the subject belongs within
- `relationshipToAnchor`
  - why the reminder should behave that way

That means a reminder resolver should be able to ask:

- what happened
- who matters most for this moment
- why that recipient was chosen

without re-deriving relationship logic from multiple legacy paths.

## Example Outcomes

### Direct person

`Mom`

- subject: `Mom`
- anchor: `user`
- relationshipToAnchor: `parent`
- recipient: `Mom`

### Child through another person

`Jane`, where `Ashley -> Jane (child)`

- subject: `Jane`
- anchor: `Ashley`
- relationshipToAnchor: `child`
- recipient: `Ashley`

### Legacy embedded child

`Anthony`, embedded under `J.children`

- subject: child ref `(J, Anthony)`
- anchor: `J`
- relationshipToAnchor: `child`
- recipient: `J`

### Unknown standalone person

`Ryan`

- subject: `Ryan`
- anchor: `user`
- relationshipToAnchor: `unknown`
- recipient: `Ryan`

## Validation Coverage

Validation lives in:

- [src/utils/relationshipV2Fixtures.ts](/Volumes/DevSSD/Dev/doknotforget/src/utils/relationshipV2Fixtures.ts)
- [src/utils/relationshipV2Validation.ts](/Volumes/DevSSD/Dev/doknotforget/src/utils/relationshipV2Validation.ts)

Run with:

```bash
npm run validate:relationship-v2
```

Current fixtures validate:

- direct parent from legacy fields
- graph parent/child relationships
- legacy embedded children
- partner fallback from `partnerId`
- standalone unknown people
- graph friend relationships

## Phase 2 Constraint

Phase 2 should migrate reminder resolution to this engine.

It should not:

- rewrite saved user data
- assume direct user relationships that do not exist
- remove legacy compatibility yet

The migration target is behavior correctness first. Architecture cleanup can continue after production behavior is proven.
