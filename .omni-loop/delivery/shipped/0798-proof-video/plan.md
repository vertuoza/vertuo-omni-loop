# Plan: proof video

PRD #798, spec in `spec.md` beside this plan. The feature branch `feat/proof-video` goes into `main`
(`Closes #798`); each slice is a sub-PR from `feat/proof-video--<slice>` into the feature branch
(`Part of #798`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni check inbox` accepts `proof: video` and refuses any other value; the config gains a `proof` section (`url`, `setup`, `bypassEnv`, `maxSeconds`) | `kit/lib/config.mjs` `kit/lib/config.test.mjs` `kit/lib/inbox/` `kit/dist/` | — | 1 |
| s2 | the `proof_runs` table and private `proof-videos` bucket, `POST /api/proofs/uploads`, `POST /api/proofs` and the GIF's stable link | `supabase/migrations/` `apps/galaxy/app/api/proofs/` `apps/galaxy/src/proof/` | — | 1 |
| s3 | `omni proof push <n> <dir>` reads `run.json`, uploads through signed links, registers the run and prints the Proof tab's link | `kit/bin/commands/proof` `kit/bin/commands/index.mjs` `kit/lib/proof/` `kit/dist/` | s1, s2 | 2 |
| s4 | the Proof tab on `/prd/<id>`: newest run first, one row per criterion with verdict, note, player and script, older runs by the version picker | `apps/galaxy/src/dossier/page/` `apps/galaxy/src/dossier/store` | s2 | 2 |
| s5 | the `/omni:prove` skill and its help entry; the brainstorm's question, yolo's step after ready, invade's two proposal rows | `kit/plugin/skills/` `kit/lib/help/` `kit/test/plugin.test.mjs` `kit/dist/` | s3 | 3 |

**Shared ground.** `kit/dist/` (the committed bundle every kit change rebuilds) is declared by s1,
s3 and s5, which sit in waves 1, 2 and 3. `kit/bin/commands/index.mjs` (the command registry) is
s3's alone. The dossier page's shared render tests (`view.test.ts`, `render.test.ts`) sit under
`apps/galaxy/src/dossier/page/`, s4's alone. s2 owns the proof store in `apps/galaxy/src/proof/`, and
s4 reads it without editing it.

## Per slice: done when

**s1**
- `omni check inbox` is green on a spec with `proof: video` and refuses `proof: yes`, naming the field.
- `omni config` prints a `proof` section, all null with `maxSeconds` 60, and refuses a `maxSeconds`
  that is not a positive whole number.
- `kit/dist/omni.mjs` is rebuilt, and `pnpm test` is green.

**s2**
- The migration creates `proof_runs` and a private `proof-videos` bucket (webm, gif, text; 50 MB a
  file), readable only by members of the dossier's workspace.
- `POST /api/proofs/uploads` gives one signed link per file. It refuses a wrong type (400), a file
  over 50 MB (413), more than 25 files (400), a PRD without a dossier (404) and a signed-out call (401).
- `POST /api/proofs` stores one run and answers `{url}` to the Proof tab. It refuses a verdict
  other than pass, fail or unfilmable, and a file it did not upload.
- `GET /api/proofs/<run>/preview.gif` answers 302 without sign-in, and 404 for a run without a GIF.
- Every case is covered by route tests on the fake store.

**s3**
- Through `main()` on a fixture repository against a fake app, `omni proof push` uploads, then
  registers, and prints the link.
- It refuses a 60 MB file or a `.mp4` before uploading anything, with `refused (413)` or
  `refused (400)` and exit `1`.
- It prints `none`, `off`, `no sign-in (omni signin)` and `unreachable` as `omni dossier link`
  does, each with exit `1`.
- `kit/dist/omni.mjs` is rebuilt.

**s4**
- A dossier without a run shows no Proof tab.
- With a run, the tab shows its commit, URL, date and ✓/✗/— counts, then one row per criterion:
  a `<video>` player with a signed link, the verdict, the note, and the script in a fold.
- The version picker opens an older run.
- By hand: checked in the browser on a preview at desktop and phone width, light and dark.

**s5**
- `/omni:prove` is in the plugin and in `omni help`, and its text covers: the stop line when
  unconfigured, the 10-criteria and `maxSeconds` limits, unfilmable criteria, the push, the
  unsigned comment, and "never blocks".
- `/omni:brainstorm` asks "Record a proof video once it ships?" only when `proof.url` is set, and
  writes `proof: video` on yes.
- `/omni:yolo` follows `/omni:prove` after ready when the spec says `proof: video`.
- `/omni:invade` step 7 lists `proof.url` and `proof.setup` with when each is proposed.
- `kit/test/plugin.test.mjs` is green, and `kit/dist/omni.mjs` is rebuilt.
- By hand, once merged: `/omni:prove` on a ready PR of this repository posts the comment and fills
  the tab (acceptance 3–5).
