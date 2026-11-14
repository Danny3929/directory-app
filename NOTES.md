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
