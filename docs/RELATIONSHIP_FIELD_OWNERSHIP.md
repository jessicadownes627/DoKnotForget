# Relationship Field Ownership

This document defines one source of truth for each relationship field during Phase 3.

Baseline:

- Phase 1 commit: `cc4dfb6`
- Phase 2 commit: `065e962`

Phase 3 introduces the first persisted V2 relationship store. The purpose of this document is to prevent contradictory data between that store and legacy compatibility fields.

## Authoritative Fields

### `relationshipLinksV2`

- Storage: new persisted V2 relationship store in app state and local storage
- Written by:
  - Add Person in Phase 3
- Type:
  - V2-native
- Production readers:
  - V2 relationship resolver inputs
  - Home reminder relationship resolution
  - notification title resolution
- Role:
  - authoritative relationship source for any relationship explicitly captured by Add Person in Phase 3
- Phase 4:
  - remains the long-term source of truth

### `relationships`

- Storage: existing legacy graph relationship array
- Written by:
  - Add Person
  - Person Detail
- Type:
  - legacy compatibility
- Production readers:
  - existing legacy relationship consumers
  - V2 adapter fallback
- Role:
  - authoritative only for legacy person-to-person graph paths not yet migrated to native V2 writes
- Phase 4:
  - retired once all production consumers read V2-native links directly

## Compatibility Fields on `Person`

### `partnerId`

- Written by:
  - Add Person only when the relationship is explicitly partner-to-person
  - Person Detail legacy relationship editing
- Type:
  - legacy compatibility
- Production readers:
  - legacy anniversary / partner flows
  - V2 adapter fallback
- Source of truth rule:
  - if a persisted V2 partner link exists, that link is authoritative
  - `partnerId` exists only to keep legacy consumers working
- Phase 4:
  - retire after legacy partner readers are migrated

### `parentRole`

- Written by:
  - Add Person only for direct `Parent` relationships to the user
- Type:
  - legacy compatibility
- Production readers:
  - legacy prompts
  - V2 adapter fallback
- Source of truth rule:
  - if a persisted direct-to-user V2 `parent` link exists, that link is authoritative
  - `parentRole` is a compatibility mirror only
- Phase 4:
  - retire after prompt and care logic stop reading it

### `isMother` / `isFather`

- Written by:
  - existing legacy flows only
  - not newly authored by Add Person in Phase 3
- Type:
  - legacy compatibility
- Production readers:
  - legacy prompts
  - V2 adapter fallback
- Source of truth rule:
  - Add Person clears these when it writes a new explicit primary relationship to avoid contradictory direct-parent signals
- Phase 4:
  - retire with `parentRole`

### `children`

- Written by:
  - Person Detail / child editing flows
- Type:
  - legacy compatibility data model for embedded children
- Production readers:
  - child birthday reminders
  - V2 adapter fallback
- Source of truth rule:
  - embedded child records remain authoritative only for legacy child entities not yet migrated to full person-based V2 relationships
- Phase 4:
  - retire only after embedded children are replaced or fully migrated

## Add Person Write Rules

Add Person writes:

- exactly one primary persisted V2 relationship link per saved person
- zero or one legacy graph `Relationship` rows
- only the minimum compatibility fields on `Person`

Add Person does **not** write legacy mirrors when no safe legacy equivalent exists.

Examples:

- direct friend to user
  - authoritative: `relationshipLinksV2`
  - no legacy mirror
- direct child to user
  - authoritative: `relationshipLinksV2`
  - no legacy mirror
- direct partner to user
  - authoritative: `relationshipLinksV2`
  - no safe legacy mirror
- parent to user
  - authoritative: `relationshipLinksV2`
  - compatibility mirror: `parentRole`
- person connected through another person
  - authoritative: `relationshipLinksV2`
  - compatibility mirror: legacy `relationships`

## Conflict Prevention Rule

When Add Person writes a new primary V2 relationship for a person, existing persisted V2 primary links for that same person are replaced.

Compatibility fields are rewritten from the same Add Person decision in the same save transaction.

That means:

- V2 link and compatibility fields are derived from one decision
- stale direct-parent or stale partner legacy fields are cleared when they no longer match the new primary V2 relationship

## Phase 4 Exit Criteria

Legacy compatibility writes can be removed only when:

- all production relationship readers consume `relationshipLinksV2`
- no production behavior depends on `partnerId`, `parentRole`, `isMother`, `isFather`, or legacy `relationships`
- validation passes for both direct-to-user and anchored relationships using only persisted V2 data
