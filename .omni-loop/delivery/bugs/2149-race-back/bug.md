# Bug 2149: OMNI KART: a race is left for the page before the arcade on ⌘← or ALT+←

## Triage

- **Domain:** the arcade's keyboard during an OMNI KART race: the keydown handler (`apps/galaxy/src/arcade/ArcadeApp.tsx`) and the race's keys (`apps/galaxy/src/arcade/kart/options.ts`, PRD 1762); leaving the arcade for the app always asks OPEN THE APP? first (PRD 238)
- **Risk:** high — a player at the keyboard who presses ⌘ or ALT with a left or right arrow during a race leaves the arcade with no warning: a MULTI race goes on without them and a solo race is lost; avoiding those keys is the only workaround (Jev, 0.55)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/options.back.test.ts`
- **Red:** TypeError: browserBack is not a function

## Fix

The arcade's keydown handler handed every key pressed with ⌘, CTRL or ALT to the browser, in a
race too. ⌘ (macOS) and ALT (Windows, Linux) sit beside SPACE, the race's HOP, and the race steers
with the arrows: ⌘←, ⌘[ or ALT+← is the browser's Back, which left the arcade for the page before
it, /app, with no OPEN THE APP? first. A new pure function, `browserBack` in `kart/options.ts`,
names the keys the browser reads as Back or Forward (⌘← ⌘→ ⌘[ ⌘] and ALT+← ALT+→, and no other).
During a race's countdown and its race, the handler now asks it before letting a modified key
through, and keeps the browser from acting on those keys. Every other shortcut still reaches the
browser, and outside a race nothing changes.

The cause is the likeliest reading of the report, not a proven one. The browser's Back from the
mouse's side button or a trackpad swipe is not a key, and stays out of reach of this fix.

## Guard

A source-level test in the same file reads ArcadeApp's keydown handler and checks that it asks
`browserBack(e)` before `if (modified) return;`, prevents the browser from acting on what it
holds, and holds those keys in the countdown and the race only. Both of its tests fail on the
base's `ArcadeApp.tsx` and pass on the fix.

## Mutation

mutation: no changed core file against origin/main (a533dac7): nothing to mutate
