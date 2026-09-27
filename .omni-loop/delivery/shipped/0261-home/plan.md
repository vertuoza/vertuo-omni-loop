# HOME — plan

**PRD:** #261 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/home` → `main`
(`Closes #261`) · **Sub-PRs:** `feat/home--<slice>` → the feature branch (`Part of #261`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**The tracer is s1.** It moves the arcade to `/play` and every return with it, forwards the old hash
links, and puts a bare HOME at `/`: the headline and a PRESS START link. From its merge on, `/` is
HOME and nothing about the game is lost. Beside it in wave 1, two pure modules are built and tested
on their own:

- s2 counts the high scores from the shipped delivery folder;
- s3 holds the interactions: PRESS START with its sound, and the Konami code.

Wave 2 draws the poster (s4), wiring s3's interactions into it, and, beside it, gives HOME its
metadata, its Open Graph image and the README (s6). Wave 3 adds the five magazine spreads under the
poster (s5), reading s2's counters.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `/` is HOME and the game is at `/play`: the arcade moved, sign-in and sign-out return to `/play`, the old hash links forwarded, a bare HOME with the headline and PRESS START, and `galaxy:shots` starting at `/play` | `apps/galaxy/app/page.tsx` `apps/galaxy/app/play/` `apps/galaxy/app/auth/` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/home/Home.tsx` `apps/galaxy/src/home/forward` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/scripts/shots.mjs` | — | 1 |
| s2 | The high scores: PRDs shipped, slices merged and decisions adopted, counted from `.omni-loop/delivery/shipped/` at build time, `—` for a counter that cannot be read | `apps/galaxy/src/home/scores` | — | 1 |
| s3 | The interactions: PRESS START and Enter play the start sound unless muted, then open `/play`; the Konami code flashes CHEAT ACTIVATED! first | `apps/galaxy/src/home/konami` `apps/galaxy/src/home/start` `apps/galaxy/src/home/Controls.tsx` | — | 1 |
| s4 | The poster above the fold: the kicker, JOIN THE LOOP!, the pitch, OmniMan pointing, the disabled sign-up button, the invaded planet, the crest and PRESS START, stacked on a phone | `apps/galaxy/src/home/Home.tsx` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/src/home/poster` `apps/galaxy/src/home/home.css` | s1, s3 | 2 |
| s6 | HOME shared as the ad: the page's title and description, an Open Graph image, and the galaxy README naming HOME and `/play` | `apps/galaxy/app/opengraph-image` `apps/galaxy/app/page.tsx` `apps/galaxy/README.md` | s1 | 2 |
| s5 | The magazine spreads: the strategy guide's six stages, PLUS ALL OF THIS GREAT STUFF!, HIGH SCORES, the fleets' flipping trading cards and the order form | `apps/galaxy/src/home/Home.tsx` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/src/home/spreads/` `apps/galaxy/src/home/home.css` | s2, s4 | 3 |

**Shared ground.**

- `apps/galaxy/src/home/Home.tsx` and `apps/galaxy/src/home/home.test.ts`: s1 creates HOME with its
  headline and PRESS START, s4 builds the poster into it, s5 adds the spreads under it. Waves 1, 2
  and 3, one each.
- `apps/galaxy/src/home/home.css`: s4 creates it, s5 adds the spreads' styles. Waves 2 and 3.
- `apps/galaxy/app/page.tsx`: s1 makes it HOME, s6 adds its metadata. Waves 1 and 2.

## Per slice: done when

**s1: the route move.**

- `app/play/page.tsx` renders the arcade exactly as `app/page.tsx` did, in demo, closed and
  supabase modes; its tests moved with it.
- `/` renders HOME with no session and no Supabase variables, and makes no request to Supabase: the
  headline JOIN THE LOOP! and a PRESS START link to `/play`.
- The auth callback returns to `/play` (its tests say so), and the arcade reloads to `/play` after
  signing out.
- `forward.test.ts`: `#map`, `#fleets`, `#heroes`, `#briefing` and `#planet-7` map to `/play#…`; an
  empty hash, `#top` and `#planet-x` do not. HOME runs the forwarding before it paints.
- `pnpm galaxy:shots` starts at `/play`, and every arcade scene is as before.
- `pnpm test`, the galaxy's `typecheck` and `build` pass.

**s2: the high scores.**

- On a fixture delivery folder with two shipped PRDs, the three counters are exact: the folders,
  the rows of each `plan.md`'s slice table, and the `settled.md` entries whose verdict is `adopted`.
- A missing folder, a plan without a slice table and a missing `settled.md` each give `—` for their
  own counter only.
- It reads the repository's files as `src/data/load-knowledge.ts` does, from the working directory,
  and never calls GitHub or Supabase.

**s3: the interactions.**

- `konami.test.ts`: the exact sequence matches; a wrong key resets it; an extra key in the middle
  does not match.
- `start.test.ts`: starting with the game muted (`omni-loop:muted`) plays nothing and still opens
  `/play`; unmuted, it plays the arcade's `start` sound first.
- `Controls.tsx` is one client component: it listens for Enter and the Konami code on HOME, shows
  CHEAT ACTIVATED!, and makes any PRESS START button start the game.

**s4: the poster.**

- A render of HOME finds the kicker, JOIN THE LOOP!, the pitch, OmniMan's `omni-point` pose, the
  crest's `full` form, the planet and PRESS START.
- The sign-up button is `disabled`, reads SIGN UP WITH GITHUB · COMING SOON, has "coming soon" in its
  accessible name, and goes nowhere.
- The planet is drawn by the game's own `drawPlanet`, with green secured patches.
- Under 760 px wide, the crest, the headline and PRESS START come first; no sideways scroll at
  393 px.
- It uses only `@omni/design`'s colours and fonts: the design-system guard passes.

**s6: shared as the ad.**

- `/` carries its title, its description and an Open Graph image showing the crest and JOIN THE
  LOOP! on the starfield.
- `apps/galaxy/README.md` names HOME at `/`, the arcade at `/play`, and the forwarded hash links.

**s5: the spreads.**

- Under the poster, in order: the strategy guide with its six stages and OmniMan's `omni-run`, the
  five great-stuff bullets, HIGH SCORES with s2's three counters, one trading card per built-in fleet
  that is not retired, and the order form with the fine print.
- Each card is a button: hover, a tap, Enter or Space flips it; under reduced motion it crossfades.
  Its back shows the fleet's colour and a value that `game/rulebook.mjs` holds.
- The render test finds each stage, each bullet, the three counters, each card and no Nintendo name.
- The feature PR carries screenshots of HOME at 393, 852 and 1440 px.
