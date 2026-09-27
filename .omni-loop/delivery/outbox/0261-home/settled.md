# Settled outbox items — PRD 261

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-forward-every-arcade-link -->

## s1-01-forward-every-arcade-link — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-forward-every-arcade-link
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec names five old game links that the new front page sends on to the game, but the app still points at three more (the star chart, the game menu and the game room): should those go on to the game as well?

## The decision, in plain words

Yes: every link that names a game screen is sent on to the game, the five from the spec and the three the app still uses, so the knowledge page's star chart link and the app's Game mode button keep landing in the game.

## The intro, for fun

Three old signposts still point at the front door, though the game moved out back.

## The punchline, for fun

So the front door now forwards their mail too.

## The options, in plain words

A. Forward every arcade screen link, from the arcade's own list: What is built: no link to a game screen ever lands on HOME.
B. Forward only the five links the spec names: The star chart and Game mode links land on HOME until those two files are changed to /play.
C. Forward every link, and also rewrite the app's own links to /play: A later slice touches the knowledge page and the app switch so they no longer rely on the forwarding.

## What I had to decide

Whether the front page forwards only the five links the spec names, or every link that names a game screen.

## What I did meanwhile

HOME forwards #map, #chart, #fleets, #heroes, #games, #briefing, #menu and #planet-<n> to /play, reading the list from the arcade's own deep-link table (src/arcade/deep-link.ts DEEP_LINKS), so a new arcade screen is forwarded without touching HOME.

## What it costs to change later

Narrowing it back to five is a one-line change in apps/galaxy/src/home/forward.ts plus its test, but then the knowledge page's 'Open the star chart' link (/#chart) and the app's Game mode button (GAME_HOME = '/#menu') would land on HOME instead of the game, unless those two are changed to /play too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the app's own links (/#chart in src/knowledge/KnowledgeScreen.tsx, /#menu in src/switch/switch.ts) should instead be rewritten to /play#… directly; both files are outside this slice's territory (author)

```

<!-- /omni-outbox-settled: s1-01-forward-every-arcade-link -->

<!-- omni-outbox-settled: s1-02-arcade-page-test-follows-the-move -->

## s1-02-arcade-page-test-follows-the-move — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-arcade-page-test-follows-the-move
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The game's page tests had to follow the game to its new address, but their file sits outside the area this piece of work was given: is it fine that it was changed?

## The decision, in plain words

Yes: only the line that says which page the tests open was changed, so the same tests now check the game at its new address.

## The intro, for fun

The game packed its bags for a new address and its inspectors had to follow.

## The punchline, for fun

They only changed the address on their clipboard.

## The options, in plain words

A. Change only the line in the existing test file that names the page: what is built.
B. Move the test file beside the game's new page: the test runner never looks there, so the page would lose its tests.
C. Copy the tests next to the front page's tests: two places would describe the game's page.

## What I had to decide

Whether moving the arcade page's existing tests to the new route may touch their file, which is outside the slice's territory.

## What I did meanwhile

apps/galaxy/src/arcade/page.test.ts imports app/play/page.tsx instead of app/page.tsx (the import and its comment, nothing else); its 13 tests pass unchanged.

## What it costs to change later

None to undo: the file must point at the moved page either way, or the tests would check HOME and fail.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan asks for the tests to move with the page but did not list their file in the territory (author)

```

<!-- /omni-outbox-settled: s1-02-arcade-page-test-follows-the-move -->

<!-- omni-outbox-settled: s1-03-session-refresh-still-runs-on-home -->

## s1-03-session-refresh-still-runs-on-home — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-session-refresh-still-runs-on-home
prd: 261
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The front page reads no account and no database, but the step that keeps a signed-in player's session fresh still runs before every page, the front page included: should the front page be taken out of it?

## The decision, in plain words

It was left as it is: a visitor with no session triggers no call, and a signed-in player's session is only refreshed, never read by the front page.

## The intro, for fun

The front page promised not to peek at anyone's badge.

## The punchline, for fun

The doorman still polishes badges on the way in, though.

## The options, in plain words

A. Leave the session refresh running on every page, the front page included: what is built.
B. Take the front page out of the session refresh, so it never reaches the database.
C. Take every public page out of the session refresh: the front page and the design page.

## What I had to decide

Whether the session-refresh proxy should skip `/` so HOME never causes a request to Supabase, even for a signed-in player.

## What I did meanwhile

apps/galaxy/proxy.ts is unchanged and still matches `/`. With no Supabase settings it does nothing, and with no session cookie Supabase's client answers without a network call; a signed-in player opening HOME still has their session refreshed. HOME itself (app/page.tsx) imports nothing from Supabase and builds as static.

## What it costs to change later

Excluding `/` later is one pattern added to the proxy's matcher in apps/galaxy/proxy.ts, outside this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether 'makes no request to Supabase' in the acceptance criteria covers the proxy's refresh for a signed-in visitor (author)
- Not checked against a live Supabase that a cookie-less getUser makes no request (author)

```

<!-- /omni-outbox-settled: s1-03-session-refresh-still-runs-on-home -->

<!-- omni-outbox-settled: s3-01-start-pause-lengths -->

## s3-01-start-pause-lengths — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-start-pause-lengths
prd: 261
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

How long should HOME wait after PRESS START or the cheat code before opening the game?

## The decision, in plain words

HOME lets the start sound ring for about half a second before opening the game, and first shows the cheat message for just under a second; muted, it opens the game at once.

## The intro, for fun

Leaving a page too fast cuts the jingle off mid-note.

## The punchline, for fun

So HOME waits half a beat, like a good drummer.

## The options, in plain words

A. Wait about half a second for the sound, and show the cheat message for just under a second first (built).
B. Open the game at once and let the sound be cut off.
C. Longer pauses, so the cheat message and the full jingle are unmistakable.

## What I had to decide

Whether the pause before the game opens should be longer, shorter, or skipped.

## What I did meanwhile

The start sound plays in full, then the game opens; the cheat message shows for just under a second before that.

## What it costs to change later

Changing either pause is one number each in the HOME code, with no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the sound plays and then the game opens, but gives no length for either pause. (author)

```

<!-- /omni-outbox-settled: s3-01-start-pause-lengths -->

<!-- omni-outbox-settled: s3-02-enter-on-focused-controls -->

## s3-02-enter-on-focused-controls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-enter-on-focused-controls
prd: 261
slice: s3
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

When a visitor presses Enter while a button or link on HOME has the focus, should that start the game?

## The decision, in plain words

Enter starts the game anywhere on HOME except on a focused button, link or field, which keeps its own meaning; a focused PRESS START still starts the game.

## The intro, for fun

Enter means start, unless it already means something else.

## The punchline, for fun

A trading card asked to flip should not launch a spaceship instead.

## The options, in plain words

A. Leave Enter to a focused control, and start the game everywhere else (built).
B. Enter always starts the game, even over a focused card or link.
C. Only PRESS START itself answers Enter, never the page as a whole.

## What I had to decide

Whether Enter should start the game even when another button or link on HOME has the focus.

## What I did meanwhile

Enter on the page body starts the game, while Enter on a focused card, link or field does what that control does.

## What it costs to change later

One rule in the HOME code; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says Enter anywhere on HOME starts the game, and also that Enter flips a focused trading card; the two meet on a focused control and the spec does not say which wins. (author)

```

<!-- /omni-outbox-settled: s3-02-enter-on-focused-controls -->

<!-- omni-outbox-settled: s4-01-planet-drawn-at-build -->

## s4-01-planet-drawn-at-build — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-planet-drawn-at-build
prd: 261
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The poster's planet should show green ground spreading across it. Should it be animated live in the visitor's browser, or drawn ahead of time so the page needs no extra code to show it?

## The decision, in plain words

The planet is drawn once when the site is built, by the game's own planet painter, as three pictures that take turns so the green visibly spreads. The page keeps a single small interactive part, as the spec asks.

## The intro, for fun

A planet walks into a static page and asks for a script.

## The punchline, for fun

It got three still frames and a flipbook instead.

## The options, in plain words

A. A: Three frames drawn when the site is built, taking turns with no script (built).
B. B: A small live canvas that turns the planet and spreads the green smoothly, as a second client part.
C. C: A single still frame, half secured, with no motion at all.

## What I had to decide

Whether the invasion on the poster's planet may stay a three-frame loop, or should turn smoothly in the browser like the arcade's planets.

## What I did meanwhile

HOME shows the three frames in turn, and only the last one for visitors who asked for less motion.

## What it costs to change later

Small: the frames live in one file of the poster, and a live canvas would be one more small client part in their place.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one was asked whether a second client part for the planet would break the spec's rule of one interactive component; the builder read the rule strictly. (author)

```

<!-- /omni-outbox-settled: s4-01-planet-drawn-at-build -->

<!-- omni-outbox-settled: s4-02-phone-poster-order -->

## s4-02-phone-poster-order — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-phone-poster-order
prd: 261
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

On a phone the poster stacks, with the logo, the headline and the start button first. The spec does not say where the planet and the small red line above the headline go.

## The decision, in plain words

On a phone the logo, the headline and the start button sit on the starfield, then the planet, then the purple panel opens with the red line, the pitch, the quote, OmniMan and the sign-up button.

## The intro, for fun

Phones are tall and posters are wide.

## The punchline, for fun

Something had to go downstairs, and the red line drew the short straw.

## The options, in plain words

A. A: Logo, headline, start button, planet, then the purple panel starting with the red line (built).
B. B: The red line first, above the logo, so it still reads before the headline.
C. C: The mockup's order: the whole starfield first, then the full purple panel with the headline in it.

## What I had to decide

Whether the red line may follow the headline on a phone, and whether the planet belongs right under the start button.

## What I did meanwhile

Phones show the order described above; wider screens keep the poster's two columns unchanged.

## What it costs to change later

A few lines of the page's styles for phones.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The approved mockup put the whole starfield first on a phone, planet included, with the headline still in the purple panel; the spec's order and the mockup differ, and the builder followed the spec. (author)

```

<!-- /omni-outbox-settled: s4-02-phone-poster-order -->

<!-- omni-outbox-settled: s6-01-share-words-beside-home -->

## s6-01-share-words-beside-home — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-share-words-beside-home
prd: 261
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Where should the words and the picture a shared link shows live, so they can be tested?

## The decision, in plain words

They live in a small file of their own beside the rest of the home page, where tests can reach them; the two page files only point to it.

## The intro, for fun

Every ad needs a proof sheet before it goes to print.

## The punchline, for fun

So the proof sheet got its own drawer, right next to the poster.

## The options, in plain words

A. Keep the words and the card in their own tested file beside HOME, the option built.
B. Inline them in the two page files, untested, inside the row's territory as written.

## What I had to decide

The slice's territory is `apps/galaxy/app/opengraph-image`, `apps/galaxy/app/page.tsx` and the README, but tests only run under `apps/*/src/` (vitest.config.mjs), so nothing in the territory can hold a test of the metadata or the Open Graph card.

## What I did meanwhile

Added `apps/galaxy/src/home/share.tsx` (the title, the description, the card's size and its drawing) and `apps/galaxy/src/home/share.test.ts` beside it. `app/page.tsx` exports `HOME_METADATA` and `app/opengraph-image.tsx` renders `shareCard()`. The spec's Scope already puts the metadata and the Open Graph image under `apps/galaxy/src/home/`; both files are new, so no other slice's ground is touched.

## What it costs to change later

Moving two new files; no stored shape, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant the territory to include a test beside HOME (author)

```

<!-- /omni-outbox-settled: s6-01-share-words-beside-home -->

<!-- omni-outbox-settled: s6-02-share-card-headline-face -->

## s6-02-share-card-headline-face — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-share-card-headline-face
prd: 261
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The picture a shared link shows cannot use the page's own lettering. Which lettering should its headline use?

## The decision, in plain words

The headline is drawn in the picture tool's plain built-in lettering, large, yellow and slanted, while the logo above it keeps its pixel art.

## The intro, for fun

The poster's lettering showed up in a format the printer cannot read.

## The punchline, for fun

So the headline wears plain type, and the logo still wears its pixels.

## The options, in plain words

A. Draw the headline in the renderer's built-in lettering, the option built.
B. Add a copy of the display lettering in a format the picture tool reads, and draw the headline in it.
C. Draw the headline as pixel art, the way the crest is drawn.

## What I had to decide

Next's image renderer reads fonts as TTF, OTF or WOFF only, and `@omni/design` ships its faces as WOFF2 only (`packages/design/fonts/`), so the `display` role cannot draw JOIN THE LOOP! in the Open Graph image.

## What I did meanwhile

The card draws the crest's `full` form from `logoSvg` (pixel-exact) and the kicker and JOIN THE LOOP! in the renderer's built-in sans (Noto Sans), yellow, skewed -10°, with an ad-purple drop shadow, all colours from `COLOURS`. Checked by rendering the PNG from `pnpm build`.

## What it costs to change later

A few lines: load a TTF/WOFF copy of the display face in `app/opengraph-image.tsx` and pass it to `ImageResponse`'s `fonts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a person finds the built-in sans off-brand next to the pixel crest (author)

```

<!-- /omni-outbox-settled: s6-02-share-card-headline-face -->

<!-- omni-outbox-settled: s6-03-share-card-for-every-page -->

## s6-03-share-card-for-every-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s6
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-share-card-for-every-page
prd: 261
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Should the ad's preview picture also show when someone shares a link to the game or to another page of the site?

## The decision, in plain words

Yes for now: every page of the site that has no picture of its own shows the ad's picture when shared. The link's own address is left out of the preview.

## The intro, for fun

One poster went up at the front door and the whole street got a copy.

## The punchline, for fun

Nobody complained yet, but the side doors never asked for it.

## The options, in plain words

A. The ad card for every page that has none, and no og:url, the option built.
B. Move the home page into a group of its own so only it carries the ad picture.
C. Fix the site's production address in the app and print each page's full address in the preview.

## What I had to decide

Next applies an `opengraph-image` at the app root to every route below it that has none of its own, and the slice's territory names only `apps/galaxy/app/opengraph-image`, so `/play`, `/ask`, `/knowledge`, `/app` and the others inherit the ad card. Separately, the app sets no `metadataBase`, so an `og:url` would print as a bare `/`.

## What I did meanwhile

Kept the card at `app/opengraph-image.tsx`: every page without its own shares with the ad card (their title and description are unchanged, from `app/layout.tsx`). Left `og:url` out of HOME's metadata; the image's address takes the deployment's origin from Next's fallback (VERCEL_PROJECT_PRODUCTION_URL on Vercel, localhost locally).

## What it costs to change later

Moving one file into a route group, or adding a card per page; setting `metadataBase` is one line once the production domain is settled.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the other pages should preview with a card of their own (author)

```

<!-- /omni-outbox-settled: s6-03-share-card-for-every-page -->

<!-- omni-outbox-settled: s5-01-card-flip-in-the-controls -->

## s5-01-card-flip-in-the-controls — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s5
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-card-flip-in-the-controls
prd: 261
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

A trading card has to turn over on a tap, Enter or Space, which needs a little script, and the page allows only one piece of script, owned by another part of the plan. Where should the flip live?

## The decision, in plain words

The flip was added to that one piece of script, a two-line change, so the page still ships a single script and every card turns over on a tap, Enter or Space.

## The intro, for fun

The cards wanted to flip, but the page only hires one stagehand.

## The punchline, for fun

So the stagehand learned a card trick on the side.

## The options, in plain words

A. Flip inside the one client component: What is built: one script on the page, the flip logic tested in the spreads folder.
B. A second client component in the spreads: Stays inside the slice's files, but the page ships two scripts, against the spec.
C. No script: hover and focus only: No change outside the slice, but Enter, Space and a tap on some phones would not flip a card.

## What I had to decide

Whether the cards' flip on a tap, Enter or Space goes into HOME's one client component, which the plan gave to the interactions slice, or somewhere this slice owns.

## What I did meanwhile

apps/galaxy/src/home/spreads/flip.ts holds the flip (a card is a button with data-flip; a click toggles aria-pressed, which home.css turns over), tested on its own; Controls.tsx calls it first in its click handler, two lines. Hover flips a card with CSS alone.

## What it costs to change later

Moving it out is a matter of deleting the two lines from Controls.tsx and mounting a second small client component in spreads/, at the price of a second script on the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives Controls.tsx to s3 only and the spreads' territory does not name it, while the spec says one client component carries every interaction including the cards; the spec was followed over the territory list.

```

<!-- /omni-outbox-settled: s5-01-card-flip-in-the-controls -->
