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
