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
