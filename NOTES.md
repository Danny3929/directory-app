# NOTES (directory-app)

What the AI got wrong, accessibility problems, bugs and their causes. Dan's "Explain it" answers come from here.

## Decisions
- 2026-11-14: Ties in `sortByDistance` go A to Z by name, ignoring case. Dan first picked "original data order" (card 4), then changed it to A to Z because it is easier to explain to users. Revisit in Task 5: once "featured" is paid for, ties may go featured first.
- 2026-11-14: No special "same distance" message. Each gym card shows its distance (e.g. "0.8 km"), so equal distances are visible, and exact ties are very rare.
- 2026-11-14: Invalid ZIP (search page slice): show "We don't recognise ZIP 00999", then a "Did you mean…?" list of known ZIPs with area names that the user taps. Gyms stay in normal order with a "Not sorted by distance" note. Dan's first idea was to show gyms near the closest valid ZIP; rejected because ZIP codes are labels, not map positions (00619 Kilimani and 00621 Gigiri are 2 apart as numbers but far apart on a map), so "closest" would be a silent guess.
- 2026-11-15: Gym photo rule (`gymImage.js`). Dan: "the tag the user asks for if they mention one, otherwise the most popular". Gaps Dan left to the AI's suggestion: (1) only tags that have a photo count, so `beginner`, `early`, `womens`, `personal-training`, `stretching` and `cardio` are skipped; (2) ties between equally popular tags go A to Z (same as the name tie rule); (3) no photo tag at all gives the `classes` photo. Popular means "on the most gyms in the list". Spin has two photos (E and H); gyms alternate by id so the list does not repeat one picture.
- 2026-11-15: Photos picked by Dan from free Unsplash photos: hero A, weights D, strength G (African lifters, because "gym" means weights to most people), boxing A, yoga B, pilates A, outdoor B, spin E + H, classes A (AI's suggestion). Licence pages checked on 2026-11-15, credits in `CREDITS.md`.
- 2026-11-15: Radius filter spec (Dan, picked on question cards): (1) a dropdown "Within" with Any distance, 5, 10, 25, 50 km; (2) it starts on Any distance, and the address only gets `?radius=10` once one is picked; (3) with no ZIP the dropdown is disabled with the hint "Enter a ZIP to filter by distance"; (4) an unknown ZIP behaves like no ZIP: radius ignored, all gyms shown, the "Did you mean…?" list stays so the ZIP can be fixed. AI's fill-ins: a radius in a shared link without a ZIP stays in the address but does nothing until a ZIP is entered; a `?radius=` value other than 5/10/25/50 is ignored; a gym exactly on the line (10.0 km for 10 km) counts as inside; if nothing is inside the radius, the empty state says so and offers "Show any distance".
- 2026-11-14: `filterByText` searches name and description. Dan picked only Description on card 3, and the AI assumed name too. Dan agreed with the AI's suggestions on 2026-11-14.

- 2026-11-15: Data fields renamed to the guide's names (`priceKsh` → `priceMin`/`priceMax`, `featured` → `isFeatured`) and `slug`, `zip`, `photos` added. `zip` comes from the gym's area (Kilimani 00619, Kileleshwa 00605, Lavington 00603, Westlands 00800, Upper Hill 00202). `priceMax` is invented: the starting price plus Ksh 1,000 to 3,000 for the top plan. `photos` lists the gym's tag photos, most popular tag first, with the classes photo if none. "Cheapest first" sorts by `priceMin`.

## Things the AI got wrong
- 2026-11-15: Said Task 2 only needed a README and Vercel. Checking against the guide showed radius, tag and price filters, debounce, 12 per page, `/listing/:slug` with React Router, gallery, similar listings, enquiry form, Favourites page and `vercel.json` were all missing. The AI had also suggested `#/gym/N` addresses instead of the React Router the guide asks for. Rule: check every guide requirement before calling a task nearly done.

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

## Slice notes: detail page, heart button, Saved filter, final checks (2026-11-15)
- Break check gap: I broke "detail heart ignores the saved list" and no test failed. Rule: after a break check, if nothing fails, add the missing test, then break again. Added `the detail page heart starts pressed for a saved gym`.
- A saved test (`combines with the text search`) passed before the code existed, so it proves little. The other 4 saved tests failed first.
- Heart button: real `<button type="button">`, label stays "Save <gym>", `aria-pressed` carries on/off. The heart shape also changes (♡ to ♥), so state is not shown by colour alone. Target is 44px with a visible focus ring.
- `?saved=1` lives in the address like `?q=` and `?zip=`, so Back from a detail page returns to the Saved view.
- Keyboard checked in a real Chrome (driven through its debugging port): Tab order is search, ZIP, sort, Saved only, then each card's name link and heart. Space and Enter both toggle the heart, and `localStorage` follows (`[8]` then `[]`).
- Layout checked at a true 390px width: no sideways scroll on the saved view or the detail page.
- Not tested: a screen reader (only the roles and `aria-pressed` are tested), a real phone, and the gym-gone card on screen (only in tests).
- Tooling slip: headless Chrome `--window-size=390` crops the picture because Chrome has a minimum window width. Use device emulation instead.

## Slice notes: gym photos (2026-11-15)
- What shipped: `gymImage.js` (photo by Dan's tag rule), a photo on every card (lazy, 16:9, width/height set so the list does not jump), a larger photo on the detail page, and a top band on the search page with the headline over the hero photo.
- New fake API call `fetchTagCounts()`: the detail page only fetches one gym, so it needs the tag counts to pick the same photo as the card. If it fails, the page still works (ties go A to Z). Task 3 swaps it for a Django count.
- Image weight: 10 WebP files, about 310 KB in all (hero 27 KB, cards 18-53 KB each). Cards load lazily, so a phone first loads the hero and the first few cards only.
- Checked at desktop 1280px and true 390px (device emulation): no sideways scroll, no broken images.
- What the AI got wrong: (1) the first hero crop cut off the lifter's head; recropped from the top. (2) A test expected gym 1 to get `spin-1`, but 1 ÷ 2 leaves 1, so it gets `spin-2`; the test and CREDITS were fixed, not the code. (3) A test used one gym with `classes` and `boxing`; that is a tie, so A to Z rightly gave boxing. The test needed a second classes gym.
- Accessibility: the hero photo is decorative (`alt=""`), because the headline says it all. White text sits on a dark shade (rgba(17,24,39,0.78)), about 9:1 contrast at the solid part. Card photos have alt text, but it describes a stock photo of the gym type, not the real gym; in Task 3 owners' own photos with their own alt text replace it.
- Side effect of the "most popular" rule worth knowing: boxing, outdoor and spin are always paired with a more popular tag in our data, so their photos show only when someone searches for them.

## Slice notes: radius filter (2026-11-15)
- What shipped: `RADII` and `?radius=` in `urlState.js`, `filterByRadius()` in `search.js`, a "Within" dropdown on the search page, and an empty state "No gyms within 5 km of 00502" with "Show any distance". Built to Dan's spec in Decisions.
- Tests: 12 new (URL parsing incl. `10.0`/`1e1`/`-5`, filter edges, page behaviour). Broke the code twice on purpose (exclusive `<` boundary; never disabling the box) and the tests caught both.
- What the AI got wrong: with an unknown ZIP, the switched-off box still showed "5 km", so it looked as if 5 km was applied when it was not. Now it shows "Any distance" while off and the hint says "Pick a ZIP above"; the 5 km stays in the address and comes back once a real ZIP is picked. Caught by looking at the 390px screenshot, then fixed test-first.
- Data finding: the invented gyms are bunched up. Every gym is within 4 km of Kilimani, so 5/10/25/50 km all show 45 gyms there; only Industrial Area (9 within 5 km), Gigiri (9) and Karen (0) show the filter working. 25 and 50 km never hide anything.
- Fix (Dan picked "spread them" on a card): 10 gyms moved, 2 from each old area, to Karen, Ruaka, Rongai, Kitengela and Thika, with new ZIPs 00618, 00511, 00241, 01000 (invented, not checked against the real postal list). From Kilimani: 5 km 35 gyms, 10 km 39, 25 km 41, 50 km 45. `city` now holds the county (Nairobi, Kiambu, Kajiado), so a card reads "8 Limuru Rd, Ruaka, Kiambu". A data test checks that each radius step shows more gyms than the one before; it failed on the old bunched data. Gyms named after their old area (Kilimani Core Club, Westgate Warriors…) were not moved.
- Explain-it (Dan, card): when a visitor fixes a bad ZIP, the radius box turns on and the 5 km from the address comes back. Correct.
- Accessibility: the off state is not colour only: the box is `disabled` (skipped by Tab, announced as dimmed) and a text hint is linked with `aria-describedby`.

## Slice notes: tag filters (2026-11-15)
- Dan's spec (question cards): a gym must have ALL the picked tags, so each extra tag narrows the list; tags are toggle chips with counts, like "Boxing (5)".
- AI's fill-ins: chips are A to Z with the count over all gyms (it does not change as you filter); the address keeps tags A to Z with plain commas (`?tags=boxing,strength`), lower case, no repeats, at most 10, and drops anything not tag-shaped; a tag in a shared link that no gym has (`?tags=sauna`) is ignored, like `?radius=7`; nothing matching shows "No gyms have all of: Boxing, Yoga." with "Clear tags".
- What shipped: `filterByTags()` in `search.js`, `tags` in `urlState.js`, `tagLabel()` in new `tags.js` ("personal-training" reads "Personal training", "womens" reads "Women's"), chips on the search page.
- Tests: 15 new. Broke the code twice on purpose (ANY instead of ALL; not ignoring unknown tags) and the tests caught both.
- Accessibility: chips are real buttons with `aria-pressed`, so screen readers say "pressed"; pressed shows a tick as well as the fill (not colour alone); each chip is at least 44 px tall for thumbs; the group has a `fieldset` and `legend`.
- What the AI got wrong: the "Tags" heading first used a different font from the other labels; spotted on the screenshot and fixed.

## Slice notes: price range filter (2026-11-15)
- Dan's spec (question cards): two boxes, "Min Ksh" and "Max Ksh". A gym costing Ksh 3,000 to 5,000 with Max 4,000 still shows, but its card says "Some plans over Ksh 4,000" ("show, but mark it").
- The rule in one line: a gym shows if any of its plans is inside the range (its cheapest plan is not above Max, and its dearest plan is not below Min). A plan exactly on a limit counts. An empty box means no limit on that side.
- AI's fill-ins: the boxes take whole Ksh only; letters, commas and spaces are dropped as you type, so "4,000" becomes 4000; at most 6 digits. The address gets `?min=2000&max=5000`; anything else in the link (`-500`, `4000.5`, `1e3`) is ignored. If Min is more than Max, the page says "Min is more than Max, so the price filter is off." and shows all gyms instead of an empty list. No match shows "No gyms have a plan between Ksh 5,500 and 7,500." with "Clear price". Only plans over Max are marked; plans below Min are not, because cheaper plans are not a problem.
- What shipped: `filterByPrice()` in `search.js`; `isOverBudget()`, `priceRangeError()`, `priceText()`, `formatKsh()` in `price.js`; `min`/`max` in `urlState.js`; the boxes on the search page; the note on `GymCard`.
- Tests: 25 new (164 in total). Broke the code twice on purpose (the whole range must fit under Max; every gym marked) and the tests caught both.
- Accessibility: real `<label>`s on both boxes inside a `fieldset` with the legend "Price a month"; `inputMode="numeric"` gives a number keypad on phones; when Min is more than Max both boxes get `aria-invalid` and point to the message with `aria-describedby`, and the message is read out (`role="alert"`). The over-budget note and the error are words, not only colour.
- What the AI got wrong: on a 390 px phone the Max box ran off the right edge, because grid `1fr` columns cannot shrink below an input's natural width (about 20 characters). Fixed with `minmax(0, 1fr)`. On desktop the price group also left a gap beside "Within", so "Sort by" moved up before it. Both spotted on screenshots.
- Dan's Explain-it answer (card): a gym at Ksh 1,500 to 2,500 with Min 2,000 and Max empty **shows, with no note**. Right: its 2,500 plan fits, and the note is only for plans over Max, and there is no Max.

## Slice notes: debounce the search box (2026-11-15)
- Dan's spec (question card): the list updates after a pause of about 0.3 s, not on every letter and not only on Enter.
- How it works: the box has its own value (`text`), so each letter shows at once. A timer (`setTimeout`, 300 ms) copies `text` into the search (`filters.q`), which drives the list and the address. Each new letter cancels the old timer (the effect's cleanup runs `clearTimeout`) and starts a new one, so the search only runs once the visitor stops for 0.3 s.
- AI's fill-ins: pressing Enter searches at once; "Clear search" empties the box and the list at once, and a timer still waiting cannot bring the old words back. A slow typist (more than 0.3 s between letters) still sees the list change after each letter, which is expected.
- Why it matters later: in Task 3 every search becomes a call to Django. Without the wait, typing "boxing" would send 6 requests; with it, one.
- Tests: 4 new, 3 older ones now press Enter (168 in total). They use a fake clock (`vi.useFakeTimers`) to step 299 ms, then 1 ms more. Broke the code twice on purpose (no `clearTimeout`, so letters did not restart the wait; "Clear search" left the box full) and the tests caught both.
- Real-browser check (`tools/scratch/typecheck.mjs`, headless Chrome): typing "boxing" 100 ms apart kept all 45 gyms while typing, then 5 gyms and `?q=boxing` about 0.3 s after the last letter. Typing 400 ms apart updated after each letter.

## Slice notes: 12 per page with Load more (2026-11-15)
- Dan's spec (question card): a visitor with 36 gyms showing who ticks Boxing goes back to the first 12, because a new filter is a new search.
- How it works: `filters.page` says how many lots of 12 are drawn (`results.slice(0, page * 12)`). Load more adds 1. Every other change goes through `update()`, which sets `page: 1` first, so any new search choice starts again at 12. The debounced search word does the same.
- Address: `?page=2`, `?page=3` and so on; page 1 is left out. A bad value (`?page=abc`, `0`, `2.5`, `51`) means page 1. Reloading or sharing the link shows the same number of gyms.
- AI's fill-ins: changing the sort also goes back to 12, because the first 12 become different gyms. The count says "Showing 12 of 45 gyms" while more are hidden, and "45 gyms" once all are shown, when the button disappears. "No longer available" saved gyms are always shown, outside the 12.
- Accessibility: after Load more, keyboard focus moves to the first new gym's link, so keyboard and screen-reader users carry on from there instead of staying on the button (which also vanishes on the last page).
- Tests: 11 new, 3 older URL tests updated (179 in total). Broke the code twice on purpose (no reset to page 1 in `update()`; no focus move) and the tests caught both.
- Real-browser check (`tools/scratch/loadmorecheck.mjs`, headless Chrome at 390px): 12 → 24 → 36 → 45 with `?page=2/3/4`, focus on Baobab Barbell, Harambee Health Club, Urban Orbit Gym; button gone at 45; reload kept 45; ticking Boxing gave 5 gyms and `?tags=boxing`.

## Slice notes: React Router pages (2026-11-15)
- Checked first: `react-router` 8.5.1, updated 27 Oct 2026, by the Remix team, 0 audit problems. In v7 and later, `react-router-dom` was folded into `react-router`. The guide says v6, but v8 is the current version and has the same parts (BrowserRouter, Routes, Link, useSearchParams).
- Addresses: `/` search, `/listing/:slug` one gym, `/favourites` saved gyms, anything else "Page not found". The old `#/gym/2` addresses are gone.
- Back keeps the search: a card link carries a note of the page it was on (`state: { from: '/?q=box' }`). The detail page's Back link goes there, and says "Back to saved gyms" when you came from that page. A shared link has no note, so Back goes to `/`. Only our own two list pages are trusted as a "from", so a strange note can't send anyone to another site (`backLink` in `lib/route.js`).
- Mistake caught by a test: `setSearchParams` writes `?tags=boxing%2Cstrength`. We write the address with `navigate({ search }, { replace: true })` to keep the plain comma, and read it with `useSearchParams`.
- Router updates are React transitions (they land a moment later), so the search page keeps its own copy of the choices for instant typing. It only takes choices from the address after a link (PUSH) or Back/Forward (POP), never after its own writes (REPLACE). Test: "Find a gym" in the menu clears `/?q=alpha`.
- A new page scrolls to the top; without it a gym opened from far down the list opened scrolled down.
- Break checks: without reading the address on arrival, the "Find a gym" test failed; without the "from" note on the card link, both Back tests failed.
- Checked in real Chrome at 390px: card -> detail -> Back to search kept `?q=fit&page=2` and the box text; browser Back/Forward; reload; heart -> Saved gyms (1) -> gym -> Back to saved gyms; fresh-tab `/listing/baobab-barbell`; unknown gym and unknown page.
- Still to do for deploy (step 11): Vercel needs a `vercel.json` rewrite, or `/listing/...` gives 404 on reload. `vite preview` already does this locally.
- Open question for Dan: keep the "Saved only" tick box on the search page now that there is a Saved gyms page, or remove it?
