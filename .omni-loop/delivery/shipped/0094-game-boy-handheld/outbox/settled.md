# Settled outbox items — PRD 94

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-outsider-screen-in-the-shots -->

## s1-01-outsider-screen-in-the-shots — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1
- Stays here: A local testing-tool choice in one script, cheap to undo, with no lasting rule or architecture for the knowledge base; no domain for the game exists.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-outsider-screen-in-the-shots
prd: 94
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The practice galaxy always signs you in with a Vertuoza account, so the screen for someone signed in from another company never shows there. How should the screenshot tool reach that screen?

## The decision, in plain words

For that one screen, the tool pretends inside its own browser that the practice account belongs to another company. Nothing in the game itself changes.

## The intro, for fun

Every arcade has one screen that almost nobody ever gets to see.

## The punchline, for fun

So the photographer sent in a stand-in with the wrong badge, just for the picture.

## The options, in plain words

A. Pretend inside the tool's own browser, for that one screen, that the practice account is from another company. This is what was built.
B. Add a practice-only switch to the game itself that signs in as someone from another company.
C. Leave that screen out of the screenshots and check it by hand.

## What I had to decide

How `pnpm galaxy:shots` reaches the `outsider` scene (WRONG CARTRIDGE). The demo account's guest is always `guest@vertuoza.com` with `crew: true`, so the demo flow never shows it, while the plan asks for a screenshot of every scene and s1's territory holds only the script, the package files, the gitignore and the README.

## What I did meanwhile

A second browser context per size intercepts the dev server's `/_next/static/**/*.js` chunks and rewrites the demo guest (`guest@vertuoza.com`, `crew: true`) to `guest@example.com`, `crew: false`. It signs in, goes back to the title through GitHub link (B) and the menu (B), and presses START, which opens `outsider`. If no chunk held the guest, the run says so, lists `outsider` as missed and exits 1.

## What it costs to change later

Deleting one walk and one route handler in `apps/galaxy/scripts/shots.mjs`. Option B is a small demo-only switch in `src/arcade/account-demo.ts` plus a one-line change to the walk.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the rewrite still matches a minified production build: it was run against `pnpm galaxy:dev` only (author)

```

<!-- /omni-outbox-settled: s1-01-outsider-screen-in-the-shots -->

<!-- omni-outbox-settled: s1-02-playwright-pinned-to-1-56 -->

## s1-02-playwright-pinned-to-1-56 — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s1
- Wave: 1
- Stays here: A local tooling version pin that is cheap to change, with no lasting rule or architectural decision; no existing entry covers it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-playwright-pinned-to-1-56
prd: 94
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Which version of the browser robot that takes the screenshots should the project use?

## The decision, in plain words

We use an older version, the one whose browser is already installed where our coding agents run, rather than the newest one.

## The intro, for fun

Robots age too, and this one is a little set in its ways.

## The punchline, for fun

It still takes a fine picture. It just insists on bringing its own camera.

## The options, in plain words

A. Keep the older version whose browser the agents' machines already have. This is what was built.
B. Move to the newest version, and install its browser on the agents' machines too.

## What I had to decide

The `playwright` devDependency of `@omni/galaxy-app`. The spec names Playwright but no version.

## What I did meanwhile

`playwright` `~1.56.1`, whose Chromium build (1194) is the one pre-installed where the loop's agents run, so the agents take screenshots without `playwright install`. A person installs Chromium once with `pnpm --filter @omni/galaxy-app exec playwright install chromium`, the step the README gives, whatever the version.

## What it costs to change later

One version in `apps/galaxy/package.json` and a `pnpm install`, then one `playwright install chromium` on each machine that runs the shots.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the agents' machines will move to a newer Chromium build (author)

```

<!-- /omni-outbox-settled: s1-02-playwright-pinned-to-1-56 -->

<!-- omni-outbox-settled: s2-01-scene-imports-name-their-extension -->

## s2-01-scene-imports-name-their-extension — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s2
- Wave: 1
- Became: ADR-0041

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-scene-imports-name-their-extension
prd: 94
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Each group of screens now keeps its drawing and its on-screen words in two files that share a name, and the project's type checker only tells the two apart once a setting outside this slice's files is switched on. Is switching that setting on the right call?

## The decision, in plain words

I switched the setting on, so the files keep the names the plan gives them, and every place that uses one of them says which of the two it means.

## The intro, for fun

Two files walk into a folder, both answering to the same name.

## The punchline, for fun

Now everyone who calls them has to use their full names.

## The options, in plain words

A. Keep the setting on and the file names from the plan; every place that uses a group's files says which of the two it means.
B. Leave the setting off and give each group's on-screen words file a longer name, so no two files in the folder share a name.
C. Leave the setting off and give each group a folder of its own, with one file for the drawing, one for the words and one for the styles.

## What I had to decide

The plan names each group's canvas `scenes/<group>.ts` and its text layer `scenes/<group>.tsx`. With both present, an import without an extension is ambiguous, and the tools disagree on it: TypeScript resolves `./scenes/attract` to `attract.ts`, while Turbopack, webpack and esbuild try `.tsx` first, so the same line would type-check against one file and bundle the other. The imports therefore name the extension (`./scenes/attract.tsx`), which `tsc` refuses (TS5097) unless `allowImportingTsExtensions` is on. `apps/galaxy/tsconfig.json` is outside s2's territory, and no slice of the plan owns it.

## What I did meanwhile

Added `"allowImportingTsExtensions": true` to `apps/galaxy/tsconfig.json` (allowed, since `noEmit` is already on) and wrote every import of a scene module with its extension: `ArcadeApp.tsx` imports each text layer as `./scenes/<group>.tsx`, and the modules inside `scenes/` import `./common.ts`, `./common.tsx` and each other the same way. `pnpm --filter @omni/galaxy-app typecheck`, `pnpm galaxy:build` (which type-checks too), `pnpm test` and `pnpm galaxy:artifact` are green.

## What it costs to change later

A constant: one line in the tsconfig. Going the other way means renaming the seven text layers and `scenes/common.tsx` (to `scenes/<group>.screen.tsx`, say, still under each wave-3 slice's `scenes/<group>.` prefix) and dropping the extensions from about fifteen import lines. No data, no stored shape and no shared contract move. Until then, later slices must keep writing the extension on a scene import: one written without it type-checks against the canvas file but is bundled from the text layer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the files `scenes/<group>.ts` and `scenes/<group>.tsx` but does not say how an import tells the two apart, nor whether a slice may change `apps/galaxy/tsconfig.json` to allow it.

```

<!-- /omni-outbox-settled: s2-01-scene-imports-name-their-extension -->

<!-- omni-outbox-settled: s3-01-pages-turn-round -->

## s3-01-pages-turn-round — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2
- Stays here: A local UI choice in the game app, one line to change, no lasting product law; no game domain exists and product knowledge never names the game.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-pages-turn-round
prd: 94
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a list on the small upright screen is split into pages, what should happen when a player presses right on the last page, or left on the first?

## The decision, in plain words

Right on the last page goes back to the first, and left on the first goes to the last, the way the arcade's other lists already go round.

## The intro, for fun

Every book has a last page, but an arcade list likes to start all over again.

## The punchline, for fun

So the last page simply hands the reader back to the first one.

## The options, in plain words

A. Right on the last page goes back to the first, and left on the first goes to the last. This is what was built.
B. The pages stop at the ends: right on the last page and left on the first do nothing.
C. The pages stop at the ends, and a short buzz says there is no page further.

## What I had to decide

The plan has a tall `briefing` or `heroes` split into pages that ◀ ▶ turn, and s5 and s8 show "PAGE n/N", but nothing says what ▶ does on the last page, or ◀ on the first. s3 builds the page turning every group will use.

## What I did meanwhile

`turnPage()` in `apps/galaxy/src/arcade/grid.ts` goes round: ▶ on page N shows page 1, ◀ on page 1 shows page N, as the menu, the planet's tabs, the fleet select and the fleets wall already do. `act()` in `ArcadeApp.tsx` calls it for any scene whose group declares more than one page (`PAGES` in `scenes/<group>.ts`), with the tab sound. `grid.test.ts` pins it.

## What it costs to change later

A constant: one line in `turnPage()` (clamp instead of going round) and its three tests. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players expect a paged table to stop at its ends: no group declares pages yet, and nobody has played it.

```

<!-- /omni-outbox-settled: s3-01-pages-turn-round -->

<!-- omni-outbox-settled: s3-02-sound-key-unnamed-on-computers -->

## s3-02-sound-key-unnamed-on-computers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2
- Stays here: A local, cheap-to-change UI choice deferred to later scene-group and wording work; nothing in the knowledge base covers game UI and there are no domains.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-sound-key-unnamed-on-computers
prd: 94
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

On a computer, nothing on screen says any more that the M key switches the sound off, because the plate under the screen that said so is gone. Should the screen say it?

## The decision, in plain words

For now nothing on screen names the M key: it still works as before, and phones get the speaker grille and its light instead.

## The intro, for fun

The volume knob is still on the machine; it just lost its little printed label.

## The punchline, for fun

Players who find it anyway will feel they have unlocked a secret level.

## The options, in plain words

A. Show nothing: the key works as before, unannounced. This is what was built.
B. Show a short message on the screen each time M is pressed, saying whether the sound is now on or off.
C. Name the key on the title screen, next to the credits at the bottom.

## What I had to decide

The spec retires the deck plates (decision 16), and the right-hand plate was the only place on `full` that read SOUND ON (M) or SOUND OFF (M). The spec gives the two Game Boy bodies the grille and the LED, and keeps M, but says nothing about the sound state or the M key on `full`, where no body and no LED is drawn.

## What I did meanwhile

Nothing is shown: on `full`, M toggles `omni-loop:muted` as before (`toggleSound()` in `ArcadeApp.tsx`, the same one the grille calls), with no indicator. The key hints on the screens belong to the scene groups in wave 3, and their wording to s7, so s3 adds none.

## What it costs to change later

Small either way: a toast on M is one line in `ArcadeApp.tsx`; a hint in the title's footer is a line in the attract group's text layer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether desktop players found the M key through the plate: nothing measures it.

```

<!-- /omni-outbox-settled: s3-02-sound-key-unnamed-on-computers -->

<!-- omni-outbox-settled: s3-03-first-paint-before-the-device-is-known -->

## s3-03-first-paint-before-the-device-is-known — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s3
- Wave: 2
- Stays here: A local rendering default in the game's app, cheap to change (one constant); no domain exists for the game and nothing in the kit's knowledge base concerns it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-first-paint-before-the-device-is-known
prd: 94
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

The server cannot tell a phone from a computer, so the page first arrives drawn one way and changes once it starts in the browser. Which way should it arrive?

## The decision, in plain words

It arrives as the computer view, the screen alone, and a phone changes to the Game Boy a moment later, as soon as the page starts.

## The intro, for fun

Every console needs a second to find out who is holding it.

## The punchline, for fun

Until then it politely assumes you brought a keyboard.

## The options, in plain words

A. Arrive as the computer view, and change on a phone once the page starts. This is what was built.
B. Arrive as the upright Game Boy, and change on a computer once the page starts.
C. Arrive as a plain dark page, and draw the right body once the page starts.

## What I had to decide

`formFor()` needs the pointer and the viewport, which only the browser knows, and the arcade's page is rendered on the server. The spec does not say what shows before the arcade starts in the browser.

## What I did meanwhile

`useForm()` in `apps/galaxy/src/arcade/form.ts` gives the server `full`, and React switches to the device's form right after hydration. On a phone on a slow connection, the screen alone shows until the scripts run, as the cabinet showed its screen unfitted until then.

## What it costs to change later

A constant: the server snapshot in `useForm()`. A first paint drawn by CSS alone, from the pointer and the orientation media queries, is a larger change to `shell.css` and `ArcadeApp.tsx`, still with no data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long a phone shows the first view on a real connection: measured only on the local dev server.

```

<!-- /omni-outbox-settled: s3-03-first-paint-before-the-device-is-known -->

<!-- omni-outbox-settled: s10-01-small-planet-beside-its-name -->

## s10-01-small-planet-beside-its-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s10
- Wave: 3
- Stays here: A local layout choice for one game screen, cheap to change (a few constants and CSS); no domain exists for the game and nothing lasting for the kit's knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s10-01-small-planet-beside-its-name
prd: 94
slice: s10
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On the small upright screen, the planet's screen must show the planet and all four tabs of its details, and the left and right buttons already switch the tabs. How should it all fit?

## The decision, in plain words

The planet is drawn small in the top right corner, beside its name, and the details run across the rest of the screen, so every tab fits on one screen with no pages to turn.

## The intro, for fun

A planet the size of a postage stamp still has a whole crew flying around it.

## The punchline, for fun

They just fly a little closer together than they used to.

## The options, in plain words

A. A small planet in the top corner beside its name, the details across the screen below it, every tab on one screen. This is what was built.
B. A large planet at the top and the details below it, with the longer tabs split into pages that the A button turns.
C. The planet alone on a tab of its own, and each tab of details using the whole screen.

## What I had to decide

The plan asks for the planet with its Entropy in orbit and its fleets on station, and all four tabs, on 320×288, dropping nothing. The spec allows stacking, or pages the D-pad turns, but on `planet` ◀ ▶ already switch the tabs (`act()` in `ArcadeApp.tsx`, outside s10's territory), so no key is free to turn pages. The status tab alone takes up to eleven lines at the smallest type the spec allows, which leaves the planet a band 78 grid px tall.

## What I did meanwhile

`planetStage(TALL)` in `apps/galaxy/src/arcade/scenes/planet.ts` draws the planet at radius 26 (92 on the wide grid) at (260, 39), with the Entropy on a 40×8 orbit and the fleets on a 44×13 station, all inside x 200–320 and y 0–78 (`TALL_BAND`); `planet.test.ts` holds every sprite there over a whole orbit, with a hero stand-in among five fleets, and pins the wide stage as it was. The header (number, state, a title of up to three lines) and the caption take the band's left, and the panel runs 308 px across under it. On the status tab CAPTAIN and FLEET share a line and the value column is wider than the wide grid's, so long values (expedition, distress) are cut later than on the wide grid, and log lines too (292 px at 16 px, against 276). A zone tile shows its icon beside its id. A synthetic worst case (eleven status rows with four regions, four phases with eight zones in one, six Entropy units and the count of the rest, a three-line title) fits every tab.

## What it costs to change later

A few constants in `planetStage()` and the tall rules of `planet.css`. Option B needs `act()` in `ArcadeApp.tsx` to turn a tab's pages with A (which today also switches tabs) and a page count for `planet`; option C changes `PLANET_TABS`, which the wide layout shares. No data and no stored shape move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a planet 52 grid px across, with its fleets close around it, reads well on a real phone: seen only in Chromium at 393×700.

```

<!-- /omni-outbox-settled: s10-01-small-planet-beside-its-name -->

<!-- omni-outbox-settled: s11-01-more-fleets-than-fit-upright -->

## s11-01-more-fleets-than-fit-upright — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s11
- Wave: 3
- Stays here: A local layout choice in one scene, cheap to change and unseen today; no domain exists for the game UI and no product principle applies.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-01-more-fleets-than-fit-upright
prd: 94
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The upright screen has room for five fleet cards side by side. If more fleets fly one day, how should the fleets wall show them?

## The decision, in plain words

Beyond five, the cards are split into pages of even size, and the wall shows the page of the fleet being looked at, with a small page count in the corner. Moving from fleet to fleet turns the page by itself.

## The intro, for fun

Five fleets fit on the upright wall like five friends on a sofa.

## The punchline, for fun

A sixth one waits on the next page, and gets the sofa when its turn comes.

## The options, in plain words

A. Split the cards into even pages of five at most, and show the page of the fleet being looked at, with a small page count. This is what was built.
B. Keep one row, and make the cards narrower as fleets are added, down to a size that still reads.
C. Show only the fleet being looked at and its two neighbours, sliding along as the player moves.

## What I had to decide

The tall grid is 320 grid px wide: five cards of 58 px fit across it. The wide wall shows every card in one row, and has room for about five. The spec lets a tall layout split a long list into pages the D-pad turns, but on `fleets` ◀ ▶ ▲ ▼ and SELECT already move the selection (`act()` in `ArcadeApp.tsx`, outside this slice), so the cards cannot have page keys of their own.

## What I did meanwhile

`cardsShown()` in `apps/galaxy/src/arcade/scenes/fleets.ts`: on the tall grid with more than five fleets, pages of at most five cards, as even as they go (six fleets: 3 + 3; seven: 4 + 3), and the page shown is the one that holds the selected fleet, so moving the selection turns the page. `scenes/fleets.tsx` shows `n/N` at 8 grid px in the top-right corner, beside the heading, when there is more than one page. The wide wall is unchanged. `scenes/fleets.test.ts` pins it. The demo galaxy and the README's fleets are five, so no player sees a page today.

## What it costs to change later

A constant: the page size and the page rule in `cardsShown()` and its tests, and one line of the text layer for the marker. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether more than five fleets are planned: the README lists five, and the wide wall itself has room for about five cards in its row.

```

<!-- /omni-outbox-settled: s11-01-more-fleets-than-fit-upright -->

<!-- omni-outbox-settled: s11-02-crew-lines-upright -->

## s11-02-crew-lines-upright — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s11
- Wave: 3
- Stays here: A local layout choice in the fleets group's styles, cheap to change; no domain for the game exists and no product principle or rule covers screen layout.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s11-02-crew-lines-upright
prd: 94
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The upright screen shows a fleet's crew on four lines, where the wide screen shows two. What should happen if a crew ever has more names than those four lines hold?

## The decision, in plain words

Names past the fourth line are cut off, as the wide screen already cuts them after its second line. The four upright lines hold at least as many names as the wide screen's two.

## The intro, for fun

Big crews are great, until everyone has to squeeze into the team photo.

## The punchline, for fun

The photographer stepped back as far as the screen allows, and not one step further.

## The options, in plain words

A. Show four lines of names and cut off the rest, as the wide screen does after two. This is what was built.
B. Shrink the names to the smallest readable size once the crew is long, so more lines fit.
C. Show the crew as a count, with the names on a page of their own that a button opens.

## What I had to decide

On the tall grid the selected fleet's crew takes the room left under HOME, PLANETS and the three stats. The wide wall caps the crew at two lines of 17 px (`max-height: 2em` with `overflow: hidden` in `scenes/fleets.css`), so a long crew is already cut there. The spec says a tall layout drops nothing, but gives no rule for a list that outgrows its panel, and ◀ ▶ belong to the fleet selection on this screen.

## What I did meanwhile

On the tall grid the crew is 16 grid px text over four whole lines (`max-height: 4em`), 280 grid px wide, running on under its label from the second line. With crews of twenty names swapped into the page, the wide wall's two lines showed 16 names and the tall four lines 17, a two-line motto above them included. Past four lines the names are cut off, whole lines only.

## What it costs to change later

Small: the line count and the text size are two values in the fleets group's styles. Paging the crew on its own would need a key of its own on this screen, in the arcade's key handling, which this slice does not own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How large the real crews get: the demo fleets have two or three members each, and nothing here counts the players of each production fleet.

```

<!-- /omni-outbox-settled: s11-02-crew-lines-upright -->

<!-- omni-outbox-settled: s4-01-f-key-on-every-device -->

## s4-01-f-key-on-every-device — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 3
- Stays here: A cheap, local game-input choice pinned in fullscreen.test.ts; the knowledge base covers the kit, not the game, and there is no game domain to hold it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-f-key-on-every-device
prd: 94
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The plan says the F key switches fullscreen on and off on a computer. Should it also do so on a phone or a tablet played with a keyboard plugged in?

## The decision, in plain words

Yes: the F key switches fullscreen on every device, since the keyboard works the same everywhere and only the body around the screen changes. On the name screen it still types an F.

## The intro, for fun

A tablet with a keyboard plugged in is a computer on weekends.

## The punchline, for fun

So it gets the same F key, and nobody asks about its day job.

## The options, in plain words

A. The F key switches fullscreen on every device, except on the name screen. This is what was built.
B. The F key switches fullscreen on a computer only; on a phone or a tablet it does nothing, and only the first press of each page load asks.

## What I had to decide

Decision 11 and the `full` section of the spec say F toggles fullscreen on `full`, except on the name screen. The spec does not say whether F also toggles on `handheld` and `advance`, where a Bluetooth keyboard drives the Game Boy ("The keyboard still works in every form").

## What I did meanwhile

`fullscreenPress()` in `apps/galaxy/src/arcade/fullscreen.ts` reads F the same way in every form: it toggles fullscreen, except on the name screen, where F types an F. The rule never reads the form, as the spec's Solution has a form pick only the body around the screen and the grid inside it. Pinned in `fullscreen.test.ts`.

## What it costs to change later

A constant: pass the form to the rule and let F through unless it is `full`, plus one test. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a tablet player with a keyboard expects F to do anything: nobody has played it

```

<!-- /omni-outbox-settled: s4-01-f-key-on-every-device -->

<!-- omni-outbox-settled: s4-02-esc-just-after-leaving-fullscreen -->

## s4-02-esc-just-after-leaving-fullscreen — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s4
- Wave: 3
- Stays here: A local tuning constant in the arcade's fullscreen handling, cheap to change; no domain exists for the game and the knowledge base covers only the kit.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-esc-just-after-leaving-fullscreen
prd: 94
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

Some browsers tell the page that fullscreen has ended before they pass on the Esc press that ended it. How should the arcade tell that press apart from an Esc meant to go back?

## The decision, in plain words

An Esc pressed within half a second of leaving fullscreen is taken as the one that left it, and does nothing more. A later Esc goes back, as before.

## The intro, for fun

One key, two jobs, and a browser that sometimes reports the second job first.

## The punchline, for fun

So the arcade waits half a second before it takes Esc at its word again.

## The options, in plain words

A. Half a second: an Esc that soon after leaving does nothing more. This is what was built.
B. No wait at all: only an Esc that arrives while still fullscreen is held back, and one arriving just after goes back.
C. A whole second, which covers slower browsers, at the price of ignoring a quick second Esc meant to go back.

## What I had to decide

The spec says the Esc that leaves fullscreen never also counts as B. Chromium keeps that Esc to itself, but a browser may deliver its keydown after `fullscreenchange`, when `document.fullscreenElement` already reads null, and the page cannot tell it from a new Esc by the fullscreen state alone.

## What I did meanwhile

`ESC_AFTER_LEAVING_MS = 500` in `apps/galaxy/src/arcade/fullscreen.ts`. An Esc keydown while fullscreen leaves it and is spent (the page calls `exitFullscreen()` itself when the browser passes the key on, as headless Chromium does); an Esc within 500 ms of any exit from fullscreen is spent too. After that, Esc is B again. Pinned in `fullscreen.test.ts`.

## What it costs to change later

A constant: the number, or dropping the window, one line and one test. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) which browsers deliver the Esc keydown after `fullscreenchange`: checked in headless Chromium only, where the page sees that Esc while still fullscreen

```

<!-- /omni-outbox-settled: s4-02-esc-just-after-leaving-fullscreen -->

<!-- omni-outbox-settled: s5-01-hall-of-heroes-four-to-a-page -->

## s5-01-hall-of-heroes-four-to-a-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s5
- Wave: 3
- Stays here: A local layout choice held in one constant (HALL_ROWS_TALL); cheap to change, no stored shape, and nothing in the knowledge base covers game screen layout.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-hall-of-heroes-four-to-a-page
prd: 94
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On a phone held upright, the eight best heroes of the season do not fit on one screen at a size anyone can read. How should the list be split?

## The decision, in plain words

Four heroes a page, on two pages the player turns with left and right, each page saying which page it is. The season, the column names and the three leading fleets stay on every page.

## The intro, for fun

Eight heroes, one small screen, and nobody wants to stand at the back of the photo.

## The punchline, for fun

So they pose in two rows of four, and everyone gets a turn at the front.

## The options, in plain words

A. Four heroes a page, on two pages turned with left and right, the page number shown above the fleets line. This is what was built.
B. All eight heroes on one page, with tighter rows and smaller hero pictures.
C. Five heroes on the first page and three on the second, like the five the title screen shows.

## What I had to decide

How the tall Hall of Heroes (`heroes` on the 320×288 grid) splits the eight rows the wide table shows. The spec lets a tall layout split a long list into pages the D-pad turns, and s5's done-when asks for "PAGE n/N" when the tall table takes more than one page, but neither says how many rows a page holds, nor where the page line goes.

## What I did meanwhile

`hallPages()` and `hallPage()` in `apps/galaxy/src/arcade/scenes/attract.ts` put four rows on a page (`HALL_ROWS_TALL`): five to eight heroes take two pages, one to four take one, and none takes one with its empty line. `PAGES.heroes` declares the count on the tall grid only, so s3's `act()` turns the pages with ◀ ▶, round from the last to the first (adopted item s3-01). Every page keeps the heading, the season, the column heads and the TOP FLEETS line, and shows `◀ ▶ PAGE n/N` just above that line. A row with a player's hero sprite is 34 grid px tall, so four rows leave room for a GitHub login that wraps onto a second line. The title's high-score phase keeps its five rows on one page: they fit.

## What it costs to change later

A constant: `HALL_ROWS_TALL` in `attract.ts`, and the tests in `attract.test.ts` that pin four rows and two pages. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How players read a paged table on a phone: nobody has played it yet.
- (author) Whether eight rows would stay readable on one page once real players' hero sprites and long GitHub logins fill it: only the demo galaxy, which draws no hero sprites in the table, was screenshotted.

```

<!-- /omni-outbox-settled: s5-01-hall-of-heroes-four-to-a-page -->

<!-- omni-outbox-settled: s6-01-smaller-pictures-upright -->

## s6-01-smaller-pictures-upright — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 3
- Stays here: A local layout choice in one game scene, set by constants in join.ts and join.css and cheap to change; there is no lasting rule and no fitting domain.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-smaller-pictures-upright
prd: 94
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On the phone held upright, the GitHub screen and the intro no longer have room for their big pictures and all their words at once. What should give way?

## The decision, in plain words

The pictures shrink to half their size on those two screens, the player's hero on the GitHub screen and the five fleets of the intro, so every word stays on one screen.

## The intro, for fun

The heroes were asked to squeeze into a smaller screen, and they took it with good grace.

## The punchline, for fun

They are half the size now, and not one of them has complained about it yet.

## The options, in plain words

A. The pictures on those two screens shrink to half size, and every word fits on one screen. This is what was built.
B. The pictures keep their full size, and the GitHub screen's words sit over the lower half of the hero.
C. The pictures keep their full size, and the GitHub screen's words are split into two pages the arrows turn.

## What I had to decide

The spec lets a tall layout rearrange a scene (stack what sits side by side, or split a list into pages) but drop nothing, and it does not say how big the pictures stay. On the wide grid the link scene shows the hero at 2× beside a panel of six lines, and the intro shows OMNI-MAN at 2× with five fleets at 2× in a row of 128 px columns. At 320×288 the link panel alone needs the full width and about 190 of the 288 rows, and five 64 px mascots with their names do not fit side by side in 320 px.

## What I did meanwhile

In `apps/galaxy/src/arcade/scenes/join.ts`, the tall stage draws the link scene's hero and fleet mascot at 1× on a small pedestal above the panel (the panel starts at row 68), and the intro's five fleets at 1× in a zigzag, every other one 16 px lower, with their names under them (join.css), so a fleet name of up to 12 letters never touches its neighbour. OMNI-MAN in the intro, the ready hero, the welcome hero and their mascots keep 2×. The wide grid is untouched: the wide stage holds the numbers the scenes always used, and the wide screenshots are byte-identical.

## What it costs to change later

A constant: the `scale` and positions in the tall stage of `join.ts` and the matching `top` values in `join.css`. Option B is the same two files plus the link panel's layout; option C adds a page count for the link scene to the group's `PAGES`, which the arcade already turns with ◀ ▶.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players find a half-size hero on the GitHub screen too small to recognise: nobody has played it on a phone yet.

```

<!-- /omni-outbox-settled: s6-01-smaller-pictures-upright -->

<!-- omni-outbox-settled: s6-02-long-errors-cover-the-picture -->

## s6-02-long-errors-cover-the-picture — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s6
- Wave: 3
- Stays here: A local layout choice in one CSS file, cheap to change; no lasting rule or architecture, and nothing in the knowledge base covers the game's screens.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-long-errors-cover-the-picture
prd: 94
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When signing in or linking GitHub fails, the message comes from the sign-in service and can be of any length. On the small upright screen, where should a long one go?

## The decision, in plain words

The words keep their usual place when they fit. When a long message needs more room, the whole block of words moves up over the picture above it, so nothing runs off the bottom of the screen or under the button hints.

## The intro, for fun

Error messages never check the size of the screen before they start talking.

## The punchline, for fun

So the words politely climb up and stand on the picture instead.

## The options, in plain words

A. The block of words moves up over the picture when a long message needs the room. This is what was built.
B. The message is cut after two lines, ending with an ellipsis.
C. The block stays where it is, and a very long message runs past the bottom of the screen.

## What I had to decide

The coin's error line and the link's error line show a message the sign-in service or the auth callback hands back (a query parameter, or the error Supabase throws), so its length is not known. On the 320×288 grid the coin's words start at row 100 over a hint at the bottom, and the link panel starts at row 68 under the hero; a message longer than about two lines would run past the bottom edge or under the hint. The spec says a tall layout drops nothing, and does not say what gives way.

## What I did meanwhile

In `apps/galaxy/src/arcade/scenes/join.css`, on the tall grid the coin's and the link's roots are a grid whose first row (`minmax(0, 100px)` and `minmax(0, 68px)`) is the block's usual place and shrinks when the block needs the room: a short message leaves the layout as drawn, a long one lifts the block over the coin or the hero. Checked in the browser with a three-line message on each: the words stay inside the screen and clear of the hint. The wide grid keeps its fixed positions, as before.

## What it costs to change later

A constant: two rules in `join.css`. Going to option B means a line clamp on the error line in the same file; option C means removing the two grid rules.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long the messages the sign-in service really returns get: the longest seen in the code is 66 characters, and the service's own messages are not listed anywhere in the repository.

```

<!-- /omni-outbox-settled: s6-02-long-errors-cover-the-picture -->

<!-- omni-outbox-settled: s7-01-fleet-cards-follow-the-cursor -->

## s7-01-fleet-cards-follow-the-cursor — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s7
- Wave: 3
- Stays here: A local layout choice in one game scene, cheap to change and with no stored shape; the knowledge base covers the kit, not game UI, and has no domain for it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-fleet-cards-follow-the-cursor
prd: 94
slice: s7
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On a phone held upright, the row of fleet cards under the big mascot has room for six fleets. What should it show if there are ever more than six?

## The decision, in plain words

It shows six at a time and slides along as the player moves, so the fleet being looked at is always among them. Today's five fleets all show at once, as before.

## The intro, for fun

Five fleets fit on the little screen, with one seat left over for a newcomer.

## The punchline, for fun

The seventh fleet will have to wait in the wings until someone scrolls its way.

## The options, in plain words

A. Show six cards at most, sliding along with the player, so the one being looked at always shows. This is what was built.
B. Make the cards smaller so every fleet always fits in one row, however many there are.
C. Split the cards into pages of six that the arrows turn, with a page number under them.

## What I had to decide

The spec lets a tall layout stack or split a long list into pages, and drops nothing, but does not say how the fleet select's row of cards behaves when it is wider than the tall grid (320 px). At 44 px a card with 6 px between them, six cards fit; the demo and the fleets in the README are five.

## What I did meanwhile

`cardRow()` in `apps/galaxy/src/arcade/scenes/recruit.ts` shows every fleet on the wide grid, as before, and on the tall grid as many as fit (six), a window that keeps the fleet under the cursor in the middle when it can. The canvas draws that window and the text layer lays its card buttons over it; the big mascot, the name, the motto and the crew line always show the fleet under the cursor, and ◀ ▶ reach every fleet. `recruit.test.ts` pins it for one to twelve fleets.

## What it costs to change later

A constant: the window is one function and its test. Smaller cards are two numbers in the same table; pages are a few lines more in that function and a label in the text layer. No stored shape and no data move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether more than six fleets are planned: the demo and the README list five, and nothing says how many there will be.

```

<!-- /omni-outbox-settled: s7-01-fleet-cards-follow-the-cursor -->

<!-- omni-outbox-settled: s8-01-how-to-play-keeps-the-wide-rules -->

## s8-01-how-to-play-keeps-the-wide-rules — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s8
- Wave: 3
- Stays here: A local layout choice in one game scene, cheap to change (three list lines); no domain exists for the game and nothing lasting for the kit's knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-how-to-play-keeps-the-wide-rules
prd: 94
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The game hands the How to play screen three rules it has never shown: the bonus for helping clear a planet you did not work on, how soon a planet calls for help, and how much bigger planets pay. Should the upright Game Boy's How to play show them?

## The decision, in plain words

No: the upright screen shows exactly the rules the computer screen shows, split over two pages, so both say the same thing. The three rules stay unshown on both, as today.

## The intro, for fun

Every rulebook has a few pages at the back that nobody has ever turned to.

## The punchline, for fun

The pocket edition kept the same pages, and left the back ones where they were.

## The options, in plain words

A. Show on the upright screen exactly the rules the computer screen shows, and leave the three unshown on both. This is what was built.
B. Add the three rules to How to play on both screens, the computer's and the upright Game Boy's.
C. Add the three rules to the upright Game Boy's How to play only, where its first page has room.

## What I had to decide

The plan asks that How to play on the tall grid show every rule `game/rulebook.mjs` gives it, and the spec that a tall layout show the same information as the wide one. The rules the galaxy hands the screen (`view.rules`) hold three that the wide `BriefingOverlay` never shows: `terraformCloser` (+25 for a closer who was not on the expedition), `distressAfterHours` (8 working hours) and `classMultipliers` (1, 1.5, 2, 2.5; the wide page says only "× CLASS", and the planet screen shows a planet's own). Showing them only on the tall grid would make the two layouts differ, and the wide layouts must stay unchanged in this slice.

## What I did meanwhile

The tall How to play shows exactly what the wide one shows: EARN on page 1 (four ways to score and the night and cross-fleet multipliers) and ENTROPY on page 2 (the six kinds with what clearing each earns and what it costs, the decay period and when a planet is lost). `menu.test.ts` holds that every run of text on the wide page is on one of the tall pages. The three rules above stay on neither page.

## What it costs to change later

A constant: three list lines in `BriefingOverlay` in `apps/galaxy/src/arcade/scenes/menu.tsx`, on both grids or on the tall one only. On the tall grid the EARN page has room for them; on the wide grid the EARN panel would grow by about three rows. No data, no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether "every rule the rulebook gives it" in the plan meant every rule the screen is handed or every rule it shows today: the plan does not say, and the spec's same-information rule points to the second.

```

<!-- /omni-outbox-settled: s8-01-how-to-play-keeps-the-wide-rules -->

<!-- omni-outbox-settled: s9-01-upright-map-planets-in-lanes -->

## s9-01-upright-map-planets-in-lanes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s9
- Wave: 3
- Stays here: A local layout choice for the game's map scene, cheap to change in one file; no domain exists for it and nothing in the knowledge base concerns it.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s9-01-upright-map-planets-in-lanes
prd: 94
slice: s9
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

On a phone held upright the galaxy map has half the width it had, so the planets cannot sit where they sat. How should they be arranged, and how big should they be?

## The decision, in plain words

Each sector keeps its own column, as before, and its planets step down it in two or three slanted lines, with room above each for its little status picture. All planets shrink by the same amount, so a bigger planet still means a bigger project.

## The intro, for fun

Twelve planets, one phone held upright, and every one of them wants a window seat.

## The punchline, for fun

So they queue down their columns like passengers boarding by rows.

## The options, in plain words

A. Each sector keeps its column, its planets step down it in slanted lines with room for their status pictures, all shrunk by the same amount. This is what was built.
B. Stack the sectors as rows across the whole width, each sector's planets side by side in one line.
C. Draw the planets bigger and let a status picture overlap the planet above it where the column is crowded.

## What I had to decide

The spec asks that the tall map keep every planet inside 320×288 and apart, that the D-pad reach every planet, and that the sectors, the hyperlanes, the distress pulses and the dialog all show. It does not say how the planets are arranged on the tall grid, nor how big they are drawn.

## What I did meanwhile

`layoutMap(view, TALL)` in `apps/galaxy/src/arcade/scenes/map.ts` keeps each sector's column and zigzags its planets down it in lanes: planet j sits in lane j % lanes, one step lower than planet j - 1. Each planet owns a box its lane wide, with 22 grid px at its top for the state icon, so no two planets overlap and no icon lands on another planet. One shrink factor for the whole map, set by the most crowded sector, keeps sizes by class: on the demo galaxy a class I planet has a radius of 9 grid px, II 11 and III 14, against 14, 18 and 22 on the wide grid (on a 393 px phone that is still larger on screen than today's letterboxed map). The planets stay 10 px from the grid's outer edges so the selection's brackets stay on screen. `neighbour` is unchanged. `scenes/map.test.ts` pins the properties on the demo galaxy and on four made-up ones.

## What it costs to change later

A constant or a function: the tall branch of `layoutMap()` and its constants (`TALL_MAP`, the lane count, the edge margin) in one file, with its tests. The wide layout, the stored data and the D-pad's rule do not move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players find a planet faster in slanted lines or in a plain grid: nobody has played it on a phone yet.
- (author) The real galaxy's sectors and planet counts: checked on the demo galaxy and four made-up ones only.

```

<!-- /omni-outbox-settled: s9-01-upright-map-planets-in-lanes -->

<!-- omni-outbox-settled: s12-01-scene-list-read-from-its-declaration -->

## s12-01-scene-list-read-from-its-declaration — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-25
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-25
- Slice: s12
- Wave: 4
- Stays here: A local test-helper choice in the game, cheap to replace with a runtime SCENE_NAMES list later; no domain exists for the game and nothing product-wide lasts.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s12-01-scene-list-read-from-its-declaration
prd: 94
slice: s12
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The check that every screen has an upright layout needs the full list of screens, but the game keeps that list only as a rule for the code, not as a list a check can read while it runs. Where should the check get the list from?

## The decision, in plain words

The check reads the list straight from where the game declares its screens, and makes sure it matches the screens the game actually draws. A new screen without an upright layout now fails the tests, with nothing else to update.

## The intro, for fun

Counting the screens is easy, until you find nobody wrote the list down anywhere a check can read it.

## The punchline, for fun

So the check reads the game's own table of contents, then flips through the pages to be sure.

## The options, in plain words

A. Read the list from where the game declares its screens, and check it against the screens the game draws. This is what was built.
B. Add a list of screens to the game's code, build the rule from it, and have the check use it: a small change outside this slice's ground.
C. Keep a copied list in the check that the code checker refuses when it misses a screen, so a missing upright layout fails the code checker rather than the tests.

## What I had to decide

`SceneName` in `apps/galaxy/src/arcade/scenes/common.ts` is a type-only union: nothing lists the scenes at run time, and the only other full list is the `case` labels of `drawFrame` in `scenes/index.ts`. The slice's territory is `grid.test.ts` and the README, so adding a runtime list (a `SCENE_NAMES` const the type derives from) is outside it. The completeness test must not use a hand-copied list that could drift, and the spec's risks ask that a missing tall layout fail `pnpm test`, not only the typecheck.

## What I did meanwhile

`grid.test.ts` reads the `SceneName` union with TypeScript's own parser (`ts.createSourceFile`, from the `typescript` devDependency the typecheck already uses), fails loudly if the type stops being a union of string literals, and checks that the names equal the dispatcher's `case` labels. The completeness test then holds that every name is in `TALL_SCENES` and gets `TALL` from `gridFor('handheld', …)`. Shown red twice, locally and reverted: dropping `fleets` from its group's list, and adding a `shop` scene to the type. The hand-copied `SCENES` array that `grid.test.ts` had is gone.

## What it costs to change later

One test helper. Moving to a runtime list later means exporting a `SCENE_NAMES` const from `scenes/common.ts`, deriving `SceneName` from it, and importing it in `grid.test.ts` in place of the helper: no stored shape, no data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a test that reads source text is welcome here: the playbook's testing form says nothing either way, though two tests already read repository files (the game workflow and the migrations).
- (author) Whether the team would rather have a runtime list of scenes in the arcade's code, which this slice could not add outside its territory.

```

<!-- /omni-outbox-settled: s12-01-scene-list-read-from-its-declaration -->
