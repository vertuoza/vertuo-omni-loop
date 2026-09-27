# HOME, value first — plan

**PRD:** #285 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/home-value` →
`main` (`Closes #285`) · **Sub-PRs:** `feat/home-value--<slice>` → the feature branch
(`Part of #285`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**The tracer is s1.** It makes HOME say the new thing from top to bottom: the poster's kicker,
**AGENTS SHIP. YOU STEER.**, the pitch and the promise strip, then the spreads in their new order,
each with its heading. To let the spreads be filled side by side, s1 also gives each spread its own
component, stylesheet and test under `apps/galaxy/src/home/spreads/`, named after the spread
(`ForYou.tsx`, `ForYou.css`, `ForYou.test.ts`, and so on), with `Spreads.tsx` only composing them in
order. From its merge on, the reframed spreads (high scores, the game, the order form) are finished,
and the new ones (what's in it for you, you see everything, easy in and easy out) hold their heading
and lead line. Beside it in wave 1:

- s2 gives a shared link its new title, description and Open Graph card;
- s3 builds LOOP LINGO as a pure module: the five terms and their glosses, and the functions that
  find an unglossed term, an unused gloss and a banned word in a text.

Wave 2 fills the four spreads the spec rewrites, each in its own files: the role cards (s4), the
strategy guide's seven levels with the LOOP LINGO sidebar (s5, reading s3), the six see-everything
bullets (s6), and easy in and easy out (s7). Wave 3 (s8) runs the page-wide guards once every word
is in: the jargon guard on HOME's render, the only two links, and the galaxy README.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | HOME says agents ship, you steer, top to bottom: the poster's kicker, the one `h1` AGENTS SHIP. YOU STEER., the pitch and the promise strip; the spreads in the new order, one component each, with their headings; the high scores relabelled FEATURES SHIPPED, the game's Entropy line, and the order form's Join the loop! | `apps/galaxy/src/home/poster/` `apps/galaxy/src/home/spreads/` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/home.test.ts` | — | 1 |
| s2 | A shared link says AGENTS SHIP. YOU STEER.: the page's title, its description, and the Open Graph card's headline and alt text | `apps/galaxy/src/home/share` `apps/galaxy/app/opengraph-image` | — | 1 |
| s3 | LOOP LINGO as a module: HARNESS, PRD, SLICE, WAVE and OUTBOX with their glosses, in the loop's order, and the checks for an unglossed term, an unused gloss and a banned loop word in a text | `apps/galaxy/src/home/lingo` | — | 1 |
| s4 | What's in it for you?: the head of engineering's, the developer's and the product manager's cards, each with its promise and three proofs, all visible, stacked on a phone | `apps/galaxy/src/home/spreads/ForYou` | s1 | 2 |
| s5 | The strategy guide, level by level: SET UP to SHIP and the KNOWLEDGE bonus, each naming its practice, with OmniMan on the path and the LOOP LINGO sidebar beside the map | `apps/galaxy/src/home/spreads/StrategyGuide` | s1, s3 | 2 |
| s6 | You see everything: the six bullets, the release notes bullet linking to `/releases` | `apps/galaxy/src/home/spreads/SeeEverything` | s1 | 2 |
| s7 | Easy in, easy out: the four GET IN steps, and GET OUT with its fine print about the labels and the App | `apps/galaxy/src/home/spreads/InOut` | s1 | 2 |
| s8 | The page-wide guards: every loop term in HOME's prose glossed and every gloss used, no banned loop word, no link but `/play` and `/releases`; and the galaxy README's HOME section in the new words | `apps/galaxy/src/home/lingo` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/README.md` | s3, s4, s5, s6, s7 | 3 |

**Shared ground.**

- `apps/galaxy/src/home/spreads/`: s1 owns the whole folder in wave 1, where it splits the spreads
  into their own files. In wave 2, s4, s5, s6 and s7 each own one spread's prefix (`ForYou`,
  `StrategyGuide`, `SeeEverything`, `InOut`), which do not meet, so they build side by side. Each
  puts its styles in its own stylesheet and its tests in its own test file, never in `home.css`,
  `home.test.ts` or `Spreads.tsx`.
- `apps/galaxy/src/home/home.test.ts`: s1 rewrites it to the new poster and order, and s8 adds the
  page-wide link check. Waves 1 and 3.
- `apps/galaxy/src/home/lingo`: s3 creates the module and its unit tests, and s8 adds the guard on
  HOME's render. Waves 1 and 3.

## Per slice: done when

**s1: the tracer.**

- A render of HOME finds, in the column's order, the kicker THE DELIVERY FRAMEWORK FOR CODING
  AGENTS, the headline AGENTS SHIP. YOU STEER. as the page's one `h1`, the pitch, and the promise
  strip's three promises in order; OmniMan, the quote, the disabled sign-up, the planet, the crest
  and PRESS START are as before, and on a phone the crest, the headline and PRESS START come first.
- Under the poster, in order, each with its own `h2`: What's in it for you?, Strategy guide: the loop,
  level by level, You see everything (with its line), Easy in, easy out, High scores: the loop built
  this (with its line), The game: Entropy you can see, and Join the loop!
- The high scores are labelled FEATURES SHIPPED, SLICES MERGED and DECISIONS ADOPTED, show what the
  build counted, and `—` for one it could not read.
- The game's line names Entropy, and there is still one flipping card per built-in fleet not
  retired; the order form keeps TO JOIN INSTANTLY: SIGN UP WITH GITHUB, the disabled sign-up, PRESS
  START, the fine print and the Konami tip.
- Each spread is its own component under `spreads/`, with its own stylesheet and test where it has
  styles or behaviour; `Spreads.tsx` only composes them; `home.css` keeps the poster and the styles
  every spread shares.
- PRD 261's tests that still hold still pass: no session, no Supabase, the forwarding script
  first, the controls mounted, the reduced-motion crossfade, no Nintendo name.
- The design-system guard passes; `pnpm test`, the galaxy's `typecheck` and `build` pass.

**s2: shared.**

- `share.test.ts`: the title is `OMNI LOOP · AGENTS SHIP. YOU STEER.`, the description is the spec's,
  and the card's headline and alt text say AGENTS SHIP. YOU STEER.
- The card still shows the crest on the starfield, drawn once at build time.

**s3: LOOP LINGO, the module.**

- It holds the five terms in the loop's order (HARNESS, PRD, SLICE, WAVE, OUTBOX), each with the
  spec's gloss, and the banned words (phase-0, worktree, sub-PR, dossier, territory, yolo).
- On sample texts, its checks find a term that is not glossed, a gloss whose term the text never
  uses, and a banned word; matching is whole-word, ignores case, and takes a plural *s*.
- A text using every term and no banned word has no finding.

**s4: what's in it for you.**

- A render of the spread finds three `h3` cards, HEAD OF ENGINEERING, DEVELOPER and PRODUCT
  MANAGER, each with the spec's promise and its three proofs, in the spec's words.
- All three are visible with no script, side by side on a wide screen and stacked under 760 px.

**s5: the strategy guide.**

- A render of the spread finds the seven levels in order (1-1 SET UP to 1-6 SHIP, then ★ BONUS
  KNOWLEDGE), each with the spec's line, and OmniMan's `omni-run` pose on the path.
- The LOOP LINGO sidebar has its `h3` and the five terms with their glosses, read from s3's module,
  beside the map on a wide screen and under it on a phone.

**s6: you see everything.**

- A render of the spread finds the six bullets in the spec's order and words.
- The release notes bullet's *public page* is a link to `/releases`, and it is the spread's only
  link.

**s7: easy in, easy out.**

- A render of the spread finds GET IN with the four steps in order, the commands in `<code>`, and GET
  OUT with *Delete `.omni-loop/` and commit. That's it.*, the line about ordinary code, pull requests
  and git history, and the fine print about the labels and the App.
- The two columns sit side by side on a wide screen and stack under 760 px.

**s8: the page-wide guards.**

- `lingo.test.ts` renders HOME and takes the text a visitor reads, leaving out scripts and the text
  of `<code>`, `<kbd>`, the fleet cards and the LOOP LINGO sidebar. In it, every loop term is glossed
  in LOOP LINGO, every gloss is used at least once, and no banned word appears.
- `home.test.ts`: HOME's only links go to `/play` and `/releases`.
- `apps/galaxy/README.md`'s HOME section names the new headline, the eight blocks in order, and the
  LOOP LINGO guard.
- The feature PR carries screenshots of HOME at 393, 852 and 1440 px, with no sideways scroll at
  393 px.
- `pnpm test`, the galaxy's `typecheck` and `build` pass.
