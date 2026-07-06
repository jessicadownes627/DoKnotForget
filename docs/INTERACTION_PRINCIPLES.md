# DoKnotForget Interaction Principles

This document defines the default interaction patterns for DoKnotForget. It is implementation-focused and should guide new UI work, refactors, and reviews.

## Product Anchor

Every interaction should reinforce the promise:

`Help me remember the people who matter.`

The UI should never feel like contact management, CRM workflow, or database administration.

## Core Rules

### 1. People First

- People are represented as readable, beautiful summary cards.
- A person should feel like a living presence in the app, not a record under construction.
- The main view should show the person first and their details second.

Implementation implications:

- Prefer summary cards over exposed field lists.
- Use the person's name in prompts and confirmations.
- Avoid generic labels like `Birthday`, `Relationship`, or `Custom Moment` without person context when copy can be more natural.

### 2. Moments First

- Birthdays, anniversaries, child birthdays, and important dates are the app's core value.
- Moments should be easy to scan and easy to add.
- Reminder-worthy information should appear early and stay visually important.

Implementation implications:

- Prioritize birthday and important-date actions near the top of relevant flows.
- Represent saved moments as compact, readable cards or rows.
- Do not bury key reminder actions behind unnecessary setup.

### 3. Forms Disappear Quickly

The default pattern across the app is:

`Tap -> Focused sheet/modal -> Save -> Return -> New card appears`

- Forms should exist only long enough to capture information.
- The main page should not accumulate nested editors.
- Inline forms are an exception, not the default.

Implementation implications:

- Adding a child, partner, phone, date, or relationship should usually happen in a focused sheet or modal.
- On save, close the input surface immediately and return the user to a calm reading view.
- The result should appear as a new card or summary row.

### 4. Read First, Edit Second

- The main page should primarily be a readable portrait.
- Editing should happen in focused interactions.
- Avoid mixing browsing, reading, editing, and validation in the same dense area.

Implementation implications:

- A detail page should read like a collection of person and moment cards.
- Use `Add ...` actions to open focused editors.
- Do not leave edit controls exposed inline unless the interaction is trivially small and clearly better inline.

### 5. Progressive Enrichment

- Users should never feel pressure to complete everything at once.
- Every screen should support quick success, easy return, and adding more over time.
- The minimum useful path should be obvious.

Implementation implications:

- Make required information minimal.
- Clearly separate core completion from optional enrichment.
- Use copy such as `Optional`, `Add later`, or contextual equivalents only when it genuinely reduces pressure.

### 6. One Clear Action

- At any moment, the user should know the single most natural next thing to do.
- Avoid competing forms, multiple open editors, or several equally loud calls to action.

Implementation implications:

- On each page, define the primary action and subordinate everything else.
- Do not show multiple expanded editors simultaneously.
- Keep the next step adjacent to the newly completed item whenever possible.

### 7. Grow the Circle

- The UI should make adding another person feel easy and inviting.
- Value should compound as the user's circle grows.
- This is not gamification. No points, streaks, badges, or progress percentages.

Implementation implications:

- End flows in a state of completion and momentum, not fatigue.
- Use summary cards and success states that make the user's circle feel richer.
- Do not over-ask for metadata that slows down repeated use.

### 8. Reduce Cognitive Load

- Users should think about people and moments, not internal structures.
- Avoid exposing implementation concepts such as enums, reminder objects, nested models, or admin terminology.

Implementation implications:

- Hide data-model vocabulary.
- Prefer natural-language labels to internal categories.
- Replace dropdown-heavy flows with chips, cards, and focused choices when possible.

## Standard Interaction Patterns

### Additive Pattern

Use for:

- add child
- add partner/spouse
- add relationship
- add birthday
- add anniversary
- add important date
- add phone number
- add a meaningful detail

Pattern:

1. User taps an `Add ...` action.
2. A focused sheet or modal appears.
3. The interaction asks only for what is necessary.
4. User saves.
5. The surface closes immediately.
6. A new summary card or row appears on the main page.

### Editing Pattern

Use for:

- changing an existing birthday
- editing a relationship
- updating a phone number
- changing a child's name or birthday

Pattern:

1. User taps the existing summary card or a small `Edit` affordance.
2. A focused sheet or modal appears.
3. User updates the data.
4. User saves.
5. The surface closes immediately.
6. The summary card updates in place.

### Page Composition Pattern

A strong default page structure is:

1. Person summary
2. Most important reminder actions
3. Existing moments and relationships as readable cards
4. Optional enrichment actions

Avoid:

- long editable forms embedded in the page
- multiple open mini-editors
- pages that feel like stacked settings groups

## Anti-Patterns

Avoid these unless there is a clear, justified exception:

- miniature forms embedded inside larger forms
- multiple open editors on the same page
- raw relationship dropdowns
- configuration-heavy pages that foreground system structure
- validation-heavy inline editing that interrupts scanning
- “fill out everything now” experiences

## Review Checklist

Before shipping a UI change, ask:

1. Is the main page readable before it is editable?
2. Could this interaction be one tap shorter?
3. Does the person stay present throughout the interaction?
4. Is the reminder promise still obvious?
5. Does the form disappear as quickly as possible?
6. Would this still feel good on the twentieth person?
7. Does the result return to the page as a clear summary card or row?

If the answer to several of these is `no`, simplify the interaction before proceeding.
