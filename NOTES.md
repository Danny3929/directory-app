# NOTES (directory-app)

What the AI got wrong, accessibility problems, bugs and their causes. Dan's "Explain it" answers come from here.

## Decisions
- 2026-11-14: Ties in `sortByDistance` go A to Z by name, ignoring case. Dan first picked "original data order" (card 4), then changed it to A to Z because it is easier to explain to users. Revisit in Task 5: once "featured" is paid for, ties may go featured first.
- 2026-11-14: No special "same distance" message. Each gym card shows its distance (e.g. "0.8 km"), so equal distances are visible, and exact ties are very rare.
- 2026-11-14: Invalid ZIP (search page slice): show "We don't recognise ZIP 00999", then a "Did you mean…?" list of known ZIPs with area names that the user taps. Gyms stay in normal order with a "Not sorted by distance" note. Dan's first idea was to show gyms near the closest valid ZIP; rejected because ZIP codes are labels, not map positions (00619 Kilimani and 00621 Gigiri are 2 apart as numbers but far apart on a map), so "closest" would be a silent guess.
- 2026-11-14: `filterByText` searches name and description. Dan picked only Description on card 3, and the AI assumed name too. Dan agreed with the AI's suggestions on 2026-11-14.

## Things the AI got wrong
- (none logged yet)

## Accessibility problems found
- (none yet)

## Bugs and causes
- (none yet)

## Search page slice (2026-11-15)
- Search choices (`q`, `zip`, `sort`) live in the address bar through `src/lib/urlState.js`. Unknown `sort` values fall back to "featured"; values are capped at 100 characters.
- The page only gets data through `src/api/listings.js`. Opening `/?fail=1` makes the first load fail so the error state can be shown; "Try again" then works.
- A ZIP with fewer than 5 characters is "incomplete", not invalid, so the "We don't recognise ZIP" message does not flash while typing.
- Sorting: distance sort always runs first (adds `distanceKm`, A to Z on ties), then "cheapest" or "featured" sorts on top, keeping that order on ties.
- AI mistake: wrote `urlState.js` and its test in the same step, so I never saw the test fail first. Proved it can fail afterwards by breaking the code.
- AI mistake: first version set state at the top of an effect (lint warning `set-state-in-effect`). Moved "loading" into the Try again click.
- AI mistake: the last commit was 723 lines (page, card, styles, tests together); the commit hook warned. Rule: split page, component and styles into separate commits.
- Not yet checked: how the page looks on screen (screenshot was not allowed), keyboard-only walkthrough, real phone.

## Slice notes: favourites, routing, fetchListing (2026-11-15)
- My first break check on `favourites.js` proved nothing: removing the `Array.isArray` guard still gave `[]` because the `catch` caught the crash. Lesson: after a break check, confirm a test really failed. I committed before re-checking and fixed it right after.
- `favourites.test.js` first failed with "localStorage is not defined": tests that touch the browser need `// @vitest-environment jsdom` on line 1.
- My `fetchListing` tests and code were written together, so I never saw the tests fail first. I proved them with two break checks afterwards.
- Decisions (Dan): favourites store ids only; a saved gym that no longer exists shows a "no longer available" card with Remove; Back keeps the same search (search choices live in `?q=`, the page lives in `#/`).
