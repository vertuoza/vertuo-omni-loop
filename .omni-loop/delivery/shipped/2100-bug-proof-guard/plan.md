# Plan: Every bug-fix PR carries its proof, and a stale plugin cannot skip it

PRD #2100, spec beside this plan (`spec.md`). The feature branch `feat/bug-proof-guard` merges into
`main` through the feature PR (`Closes #2100`); each slice is a sub-PR from
`feat/bug-proof-guard--<slice>` into the feature branch (`Part of #2100`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni bug film` draws the red/green GIF of two outputs in pure JS, with no ffmpeg: two 640×360 cards, 3 seconds each, looping, the failing and passing lines highlighted, the same bytes every run; two clips still go through ffmpeg | `kit/lib/image/` `kit/lib/bug/film` `kit/bin/commands/bug-film` `kit/bin/bug.test.ts` | — | 1 | deep |
| s2 | `omni bug <n>` checks the pull request body's `## Proof`, from `--body-file` or the branch's open pull request, and refuses a body with no image and no `GIF not produced - <reason>` line; a `## Fixes` record passes | `kit/lib/bug/proof-body` `kit/lib/bug/verdict` `kit/bin/commands/bug.ts` `kit/bin/bug.test.ts` | — | 2 | build |
| s3 | `omni proof push --kind bug` prints the two clip links after the GIF's, and `GET /api/proofs/<run>/<clip>` answers `before.webm` and `after.webm` with a 302 to a signed link, any other name with a 404 | `kit/bin/commands/proof` `kit/lib/proof/` `apps/galaxy/src/proof/` `apps/galaxy/app/api/proofs/[run]/[clip]/` | — | 1 | build |
| s4 | `omni runner` brings the omni plugin up to the job's pinned omni before Claude starts, and fails the job with its reason when it cannot; it also updates the plugin at start and once an hour | `kit/lib/runner/` `kit/bin/commands/runner` `kit/lib/update/plugin` `kit/bin/update.test.ts` `kit/lib/sync/kit` `docs/guide/runners.md` `kit/README.md` | — | 1 | deep |
| s5 | `/omni:bug-fix` checks its body with `omni bug <n> --body-file` before it opens the pull request, falls back to the text GIF when the clips fail, adds the `Clips:` line, and writes `Fixed by #<n>` under stop rule 3 only for a proven candidate; `/omni:mega-bug-fix` writes the same comment | `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/test/bug-fix-proof.test.ts` `kit/test/skill-steps` `kit/porting/plugin--bug-fix.md` `docs/guide/use-cases.md` `kit/README.md` `kit/lib/help/entries` | s1, s2, s3, s4 | 3 | build |

**Shared ground.** `kit/bin/bug.test.ts` (the `omni bug` tests, on one fixture repository and its
fake exec) is declared by s1 (the `omni bug film` block) and s2 (the body checks): s2 moves to wave 2
so the two never share a wave. `kit/README.md` is declared by s4 (the runner section: the plugin it
keeps up to date) and s5 (the bug-fix paragraph and the `omni bug` section): wave 1 and wave 3. Every
other prefix belongs to one slice. The help entries (`kit/lib/help/entries`) belong to s5 alone: the
four code slices change the `omni bug`, `omni bug film`, `omni proof push` and `omni runner` entries
in one place, once their interfaces are merged, rather than four slices meeting on one file.
`kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them, and the wave rebuilds them
once after merging.

## Per slice: done when

### s1 (deep: a GIF encoder, its LZW and a deterministic layout)
- `kit/lib/image/gif.ts` encodes frames of at most 8 colours as a GIF89a with its looping extension,
  and refuses more than 8; `kit/lib/image/font.ts` holds the X11 misc-fixed 6×13 glyphs for ASCII and
  ✓ ✗ × ❯ › · • → ─ │.
- `kit/lib/image/gif.test.ts`: a 4×2 image encodes to known bytes; a decoder written in the test
  reads back every pixel of a two-frame image, its 300-hundredths delays and its looping extension;
  a ninth colour is refused.
- `kit/lib/bug/film.test.ts`: ANSI sequences and carriage returns are dropped, tabs become two
  spaces, lines are cut at 100 characters; the window holds the last 20 lines, or starts two lines
  above a highlighted line that sits higher; the highlighted line's pixels are red on the red card
  and green on the green card; a character outside the font is drawn as `?`; the clips' ffmpeg
  arguments are those of today.
- `kit/bin/bug.test.ts`, through `main()` on the fixture repository: two `.txt` write `preview.gif`,
  `red.txt`, `green.txt` and a `run.json` that `readRun` accepts, with no ffmpeg call recorded; the
  same inputs twice give the same bytes; two `.webm` still call ffmpeg, and `ffmpeg not found` still
  exits 1.
- Acceptance criteria 1, 2 and the CLI half of 3 hold; the only exit 1 of a text pair is
  `could not write <path>`.

### s2
- `omni bug <n> --body-file <file>` prints `ok` for a body whose `## Proof` holds an `https://` image
  and its `- **Before the fix**` and `- **After the fix**` lines, or a `GIF not produced - <reason>`
  line with a reason; otherwise `not ok` with one of the four fault lines the spec names.
- With no flag, it reads the branch's open pull request through `gh pr view --json
  body,isDraft,state,number`; no open pull request prints `not ok` with the line that says how to
  proceed; a not-produced proof on a pull request that is not a draft prints
  `the proof was not produced but #<pr> is not a draft: gh pr ready <pr> --undo`.
- A record with a `## Fixes` section passes with no `## Proof`, with or without the flag.
- `kit/bin/bug.test.ts` covers each case above on fixture bodies and a fake `gh`; the branch checks
  `omni bug` ran before print as they did.
- Acceptance criteria 5, 6 and 7 hold.

### s3 (`ui: yes`)
- `omni proof push --kind bug` of a run holding `before.webm` and `after.webm` prints the bug page's
  link, the GIF's link, then `<origin>/api/proofs/<run>/before.webm` and `/after.webm`; a run of text
  prints exactly what it prints today (`kit/bin/commands/proof.test.ts`, a stubbed fetch).
- `apps/galaxy/app/api/proofs/[run]/[clip]/route.ts` answers through a proof API function in
  `apps/galaxy/src/proof/`, as the `preview.gif` route does: no sign-in, a 302 to a 5-minute signed
  link with `no-store`.
- `apps/galaxy/src/proof/api.test.ts` on `FakeProofWorld`: `before.webm` of a run that holds it is a
  302 with `no-store`; a run without it, `red.txt`, and a name outside the two are each a 404; an id
  that is not a UUID is a 404.
- Acceptance criterion 4 holds. No screen changes: the design review finds nothing to draw.

### s4 (deep: one plugin update shared by every slot and the hourly sweep)
- Before each job, once its worktree is made, the runner reads the plugin's version from `claude
  plugin list --json` and the repository's pinned omni; an older plugin runs the update once, even
  with two slots starting together, then reads it again.
- Still older: the job fails with `omni plugin v<x> is older than <owner/repo>'s omni v<y>: claude
  plugin update failed: <its last line>`, and `claude` is never started. Not installed: it fails
  with `the omni plugin is not installed: claude plugin install omni@omni-loop`. An unreadable list
  runs the job with the log line `omni plugin version not read: <why>`. An equal or newer plugin
  starts no update.
- The runner updates the plugin at start and once an hour, and prints only `omni plugin v<x> →
  v<y>` or `omni plugin update failed: …`.
- `kit/bin/commands/runner.test.ts` and `kit/lib/runner/*.test.ts`, on a fake exec, cover each case
  above; `omni update`'s own plugin lines are unchanged (`kit/bin/update.test.ts`).
- `docs/guide/runners.md` and the kit README's runner section say what the runner does with the
  plugin and the line a person reads when it fails.
- Acceptance criteria 8 and 9 hold.

### s5
- `/omni:bug-fix` step 12 runs, in order: commit, push, dossier push, film and proof push, write the
  body file, `omni bug <n> --body-file <file>` until it prints `ok`, then `gh pr create --body-file`
  with that same file; a pinned omni that refuses the flag (exit 2) falls back to `omni bug <n>`.
- Clips that fail, `ffmpeg not found` included, fall back to the text GIF of `red.txt` and
  `green.txt`, with `Storybook not filmed - <reason>`; the reason table has no `ffmpeg not found`
  row; `## Proof` has the `Clips: [before](<link>) · [after](<link>)` line for a component bug.
- Stop rule 3 finds candidates with `git log --merges -- <files>` and `gh pr list --state merged
  --search`, writes `Fixed by #<n>` (or `Fixed by <PR URL>`) only for one proven red at its merge's
  first parent and green at its merge, `Maybe: #<n>` lines otherwise, and never closes the issue;
  `/omni:mega-bug-fix` writes the same comment.
- `kit/test/bug-fix-proof.test.ts` locks the three points above; `kit/test/skill-steps` matches the
  new steps; `kit/test/plugin.test.ts` stays green, unchanged.
- The guide's use cases, the kit README's bug-fix paragraph and `omni bug` section,
  `kit/porting/plugin--bug-fix.md` and the help entries of `omni bug`, `omni bug film`, `omni proof
  push` and `omni runner` say what s1 to s4 now do.
- Acceptance criteria 3 (the skill half), 10 and 11 hold.
