# DoKnotForget UX Audit

This audit evaluates the current app against [INTERACTION_PRINCIPLES.md](/Volumes/DevSSD/Dev/doknotforget/docs/INTERACTION_PRINCIPLES.md:1).

Priority is based on friction, frequency, and impact on the product promise.

## Priority Order

1. `Person Detail` and `PersonEditDrawer`
2. `Import Contacts`
3. `Home`
4. `Settings`
5. `Paywall`
6. `Add Person`
7. `Contacts`
8. `Onboarding` / `Welcome`

## 1. Person Detail

Files:

- [src/screens/PersonDetail.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/PersonDetail.tsx:1)
- [src/components/PersonEditDrawer.tsx](/Volumes/DevSSD/Dev/doknotforget/src/components/PersonEditDrawer.tsx:1)

Severity: `High`

Why it is high-friction:

- This is the most likely screen to grow over time with children, partner links, birthdays, anniversaries, holidays, and sensitive moments.
- It currently mixes reading, editing, relationship management, date picking, and nested additions in one surface.

Violations:

- Nested editors remain visible inside the main editing surface.
- Adding children, milestones, birthdays, anniversaries, and sensitive dates happens through inline or drawer-embedded mini-forms.
- The page exposes internal structure directly: moments, relationship types, child arrays, holiday preferences, school events.
- The main experience trends toward “edit profile” rather than “readable portrait + focused additions.”

Examples:

- `PersonEditDrawer` contains many simultaneous edit states and toggles for birthday, anniversary, children, milestones, sensitive dates, and holidays.
- `addChildEntry()` inserts a new blank child directly into the current editing context rather than using a focused add flow and returning a finished summary card.
- Additional dates and holiday preferences expand inline, increasing cognitive load and making the drawer feel like a collection of nested editors.

Recommendation:

- Convert child, partner, connection, important-date, and holiday additions to the shared pattern:
  `Tap -> focused sheet -> save -> return -> new card appears`
- Reframe `PersonDetail` as a readable portrait page with add actions and summary cards.
- Reduce the role of `PersonEditDrawer` or split it into targeted sheets instead of one large all-purpose editor.

## 2. Import Contacts

File:

- [src/screens/ImportContacts.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/ImportContacts.tsx:1)

Severity: `High`

Why it is high-friction:

- This is an onboarding and trial screen for many users.
- It determines whether the app feels like thoughtful curation or bulk data ingestion.

Violations:

- The experience is structurally closer to batch contact administration than circle-building.
- It foregrounds lists, sorting, starter-contact heuristics, permission states, and selection management.
- It likely asks users to process too many contacts in one screen before giving them a satisfying “person added to my circle” payoff.

Examples:

- Large contact lists and checkbox-style selection patterns emphasize import management rather than person-by-person meaning.
- The screen leans on bulk behaviors and starter logic instead of smaller, more human invitation patterns.

Recommendation:

- Preserve import capability, but move toward a “suggested people to start with” card model.
- Each selected person should quickly become a summary card or lightweight review card.
- Keep import powerful, but make the emotional unit of progress a person, not a selected row.

## 3. Home

File:

- [src/screens/Home.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/Home.tsx:1)

Severity: `Medium`

Why it matters:

- Home is the core reminder surface.
- It already has card-based patterns, but it also carries a lot of system and suggestion logic.

Strengths:

- The screen is already organized around reminders, upcoming moments, and action-oriented cards.
- The product promise is visible.

Violations:

- Several interactions still risk feeling operational rather than calm and focused.
- The screen contains many conditional surfaces, suggestion systems, search, recommendation fetching, notification behavior, and modal paths.
- There is a risk of too many competing actions if multiple prompt types appear at once.

Recommendation:

- Keep Home reminder-first.
- Audit every prompt/modal/card on Home for “one clear next action.”
- Avoid stacking several unrelated asks simultaneously.
- Favor readable moment cards over system-heavy UI states.

## 4. Settings

File:

- [src/screens/Settings.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/Settings.tsx:1)

Severity: `Medium`

Why it matters:

- Settings is naturally more configuration-heavy, but it should still avoid corporate utility tone where possible.

Violations:

- Settings is presented as a standard settings form, which is acceptable structurally but still leans toward raw configuration.
- Notification toggle and reminder time are shown as controls first, not framed through the promise of remembering well.

Recommendation:

- Keep it simple, but make sections more human and outcome-oriented.
- Use clearer framing like “When should reminders reach you?” instead of exposing settings language where unnecessary.
- This is lower priority than `Person Detail` and `Import Contacts`.

## 5. Paywall

File:

- [src/screens/Paywall.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/Paywall.tsx:1)

Severity: `Medium`

Why it matters:

- The paywall is the continuation of the first-three-people experience.
- It should feel like preserving a growing circle, not switching to monetization mode.

Violations:

- Copy still leans on feature bullets and upgrade framing rather than continuation of something meaningful.
- Buttons and alerts remain somewhat transactional.

Recommendation:

- Reframe the screen around protecting and continuing the user's circle.
- Keep the main value emotional and reminder-centered.
- Reduce the sense of interruption and increase the sense of continuity.

## 6. Add Person

File:

- [src/screens/AddPerson.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/AddPerson.tsx:1)

Severity: `Low to Medium`

Why it is lower now:

- This screen has already been substantially redesigned around the new interaction language.
- It now supports a quick success path and uses focused reminder interactions rather than large embedded editors.

Remaining opportunities:

- Continue increasing the visual centrality of the person summary over instructional copy.
- Apply the same focused-add pattern for any future additive elements introduced here.
- Maintain discipline around not reintroducing nested inline editors.

Recommendation:

- Treat `Add Person` as the reference implementation for the new interaction language.
- Reuse its successful patterns elsewhere rather than expanding it further right now.

## 7. Contacts

Files:

- [src/screens/Contacts.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/Contacts.tsx:1)
- [src/screens/People.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/People.tsx:1)
- [src/screens/PeopleIndex.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/PeopleIndex.tsx:1)

Severity: `Low to Medium`

Why it matters:

- This is a browsing screen, so some list behavior is unavoidable.

Violations:

- It still reads more like a contact index than a living circle.
- Search, export, import, and backup controls live close to the people list, which pulls the screen toward utility mode.

Recommendation:

- Keep the list simple, but consider visually prioritizing “your circle” over contact-management utilities.
- Move low-frequency maintenance actions farther away from the main person-browsing experience.

## 8. Onboarding / Welcome

Files:

- [src/screens/Onboarding.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/Onboarding.tsx:1)
- [src/screens/Welcome.tsx](/Volumes/DevSSD/Dev/doknotforget/src/screens/Welcome.tsx:1)

Severity: `Low`

Why it matters:

- These are small surfaces, but they set the tone.

Violations:

- They are minimal, but also generic.
- They do not yet strongly establish the “build your circle / remember the people who matter” interaction language.

Recommendation:

- Keep these lightweight.
- Align copy more tightly with the product promise and the first-three-people experience.

## Cross-Cutting Component Issues

### PersonEditDrawer

File:

- [src/components/PersonEditDrawer.tsx](/Volumes/DevSSD/Dev/doknotforget/src/components/PersonEditDrawer.tsx:1)

Severity: `High`

- This component is the clearest app-wide violation of the new principles.
- It centralizes too many edit modes and too much nested state.
- It should be the first major refactor target after alignment.

### MomentDatePicker

File:

- [src/components/MomentDatePicker.tsx](/Volumes/DevSSD/Dev/doknotforget/src/components/MomentDatePicker.tsx:1)

Severity: `Low`

- This component already supports the preferred focused interaction model.
- It is a good building block for the app-wide pattern.

### ContactsSearchResults

File:

- [src/components/ContactsSearchResults.tsx](/Volumes/DevSSD/Dev/doknotforget/src/components/ContactsSearchResults.tsx:1)

Severity: `Low`

- This is compatible with the new interaction language when used as part of focused add/connect flows.

## Recommended Redesign Order

1. Refactor `PersonDetail` and `PersonEditDrawer` around card-first reading and focused additive sheets.
2. Rework `ImportContacts` so the unit of progress is a person entering the circle, not a selected row.
3. Simplify `Home` prompts so the screen always presents one clear next action.
4. Reframe `Paywall` as continuation of the user’s growing circle.
5. Polish `Settings`, `Contacts`, and onboarding surfaces to match the same interaction language.

## Decision Rule Going Forward

When redesigning any screen, ask:

1. Is the main page a readable portrait or a collection of editors?
2. Does adding something happen through a focused interaction that disappears quickly?
3. Does the saved result return as a clear summary card or row?
4. Would this still feel good on the twentieth person?

If the answer is `no`, the screen is not yet aligned with DoKnotForget’s interaction language.
