# Plan: A service starts /omni:bug-fix, and every bug-fix PR shows a before/after GIF

PRD #1972, spec beside this plan (`spec.md`). The feature branch `feat/bug-fix-service-proof` merges
into `main` through the feature PR (`Closes #1972`); each slice is a sub-PR from
`feat/bug-fix-service-proof--<slice>` into the feature branch (`Part of #1972`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A service queues a job with the kit's sign-in: `POST /api/runners/jobs` takes a Bearer access token through `kitCaller`, the header winning over the session, and the kit README says how a service sends one | `apps/galaxy/src/runners/runners.controller` `kit/README.md` | — | 1 |
| s2 | Proof runs land on bug dossiers: the proof API's two calls take `kind`, and `omni proof push --kind bug <n> <dir>` sends it and prints the bug page's link, then the GIF's | `apps/galaxy/src/proof/` `kit/bin/commands/proof` `kit/lib/proof/` `kit/lib/ask/client` `kit/lib/help/entries` | — | 1 |
| s3 | `omni bug film <n> --before <file> --after <file>` makes the before/after GIF and the run's folder, from two outputs or two clips | `kit/lib/bug/film` `kit/bin/commands/bug` `kit/bin/bug.test.ts` `kit/bin/omni.ts` `kit/lib/help/entries` | — | 2 |
| s4 | `/omni:bug-fix` films every bug and opens its pull request with `## Proof`, or as a draft that says why; `/omni:mega-bug-fix` leaves `## Proof` out | `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/porting/plugin--bug-fix.md` `kit/test/plugin.test.ts` `kit/test/skill-steps` `docs/guide/use-cases.md` `kit/README.md` | s2, s3 | 3 |

**Shared ground.** `kit/lib/help/entries` (the help entries and their test) is declared by s2 (the
`omni proof push` usage) and s3 (the `omni bug film` usage): s3 moves to wave 2 so the two never
share a wave. `kit/README.md` is declared by s1 (the runner section: queueing from a service) and s4
(the bug-fix paragraph: the `## Proof` section): wave 1 and wave 3. Every other prefix belongs to
one slice.

## Per slice: done when

**s1** (`ui: yes`)
- `sendJob` judges a request with an `Authorization` header by `kitCaller` alone, and one without
  by the session, as today; the rest of the call is unchanged.
- `runners.controller.test.ts`, on the in-memory store with the fake `connect`: a member's Bearer
  queues the job, 200 with `sentBy` its person; a non-member's Bearer is a 403; a Bearer for a
  repository outside every workspace is a 403; a bad Bearer is a 401, and still a 401 beside a valid
  session; no header with a session is a 200, as before.
- The kit README's runner section says how a service queues a job: exchange the kit token at
  `POST /api/ask/token`, keep the access token until `expires_at`, send it as `Authorization: Bearer`
  to `POST /api/runners/jobs`, and the 401, 403 and 400 it may answer.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green.

**s2** (`ui: yes`)
- `POST /api/proofs/uploads` and `POST /api/proofs` take an optional `kind`, `prd` or `bug`, `prd`
  when absent; the store finds the dossier numbered `(repo, number, kind)`; the register call answers
  `<origin>/bugs/<dossier id>` for a bug and the PRD's Proof tab for a PRD. No migration.
- `apps/galaxy/src/proof/api.test.ts`, on `FakeProofWorld`: `kind: 'bug'` reaches the bug dossier
  and answers its page; no `kind` reaches the PRD's, as before; a bug without a dossier is a 404; a
  `kind` other than the two is a 400; `preview.gif` serves a bug's run.
- `omni proof push --kind bug <n> <dir>` sends `kind: 'bug'` on both calls and prints the bug page's
  link, then the GIF's stable link; `--kind prd` and no `--kind` send and print exactly what they do
  before this PRD; any other kind is a usage error, exit 2. `kit/bin/commands/proof.test.ts`, through
  `main()` with a stubbed fetch, shows each.
- `omni help proof` shows `omni proof push [--kind bug] <n> <dir>`.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green; `kit/dist/` and `apps/omni-app/api/` rebuilt
  only to test.

**s3**
- `omni bug film <n> --before <file> --after <file> [--out <dir>]` writes, in `--out` (by default
  `<worktrees>/proof-bug-<n>/<YYYYMMDD-HHMMSS>/`): `preview.gif`, the two inputs (`red.txt` and
  `green.txt`, or `before.webm` and `after.webm`) and a `run.json` that `readRun()` accepts, with
  the head commit, the issue's URL and the spec's two criteria; it prints the folder's path, exit 0.
- Two `.txt` inputs give two cards, "Before the fix · red" and "After the fix · green", each the
  output's last 20 lines cut to 100 characters, 3 seconds each; two `.webm` inputs give the two
  clips, up to 4 seconds each, captioned; 640 pixels wide, 10 frames a second, looping. The ffmpeg
  arguments come from a pure function whose test holds both cases.
- Through `main()` with a fake process runner: the folder and its `run.json`; no ffmpeg on the PATH
  is exit 1 with `ffmpeg not found`; ffmpeg failing is exit 1 with `ffmpeg failed: <its last line>`;
  a missing file, a `.txt` beside a `.webm`, or a number that is not one is exit 2. `omni bug <n>`
  grades a fix branch exactly as before.
- `omni help bug` shows both usages.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green; `kit/dist/` rebuilt only to test.

**s4** (`law: BR-PRODUCT-3 · owner @pierrederval`) (`law: BR-PRODUCT-5 · owner @pierrederval`) (`law: N-PRODUCT-15 · owner @pierrederval`)

`kit/test/plugin.test.ts` proves these three laws: broken, an agent could wave its own work through
the gate, a person could merge work whose open decisions nobody answered, and unreviewed work could
reach every user. This slice only adds tests beside their proofs and leaves those checks as they are,
but the file is @pierrederval's, so the feature PR waits for @pierrederval's approval on GitHub.

- `/omni:bug-fix` step 7 writes the red output to `red.txt` in `<worktrees>/proof-bug-<n>/<run>/`,
  and, for a component bug (a repository with Storybook, a reproduction that is a story), films the
  story headless with Playwright to `before.webm`; step 8 writes `green.txt` and films `after.webm`.
- Step 12 runs, in order: `git push`, `/omni:dossier-push <n> --kind bug`, `omni bug film`,
  `omni proof push --kind bug <n> <folder>`, then opens the pull request; its body has `## Proof`
  right after **What was wrong**, with the GIF's stable link and the failing and passing lines.
- A story that cannot be filmed falls back to the two outputs and adds
  `Storybook not filmed - <reason>`; any GIF not made opens the pull request as a draft whose
  `## Proof` reads `GIF not produced - <reason>`, each reason of the spec's table named; the film
  never stops the skill.
- `/omni:mega-bug-fix` takes the body from **What was wrong** on without `## Proof`.
- `kit/test/plugin.test.ts` holds each of the above; the `skill-steps` snapshot matches; the porting
  note names the change; the guide's use cases and the kit README's bug-fix paragraph say a bug-fix
  pull request shows its bug before and after.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green.
