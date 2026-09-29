# Plan: /omni:visual-fix, a fast lane for small visual changes

PRD #541, spec beside this plan (`spec.md`). The feature branch `feat/visual-fix` merges into `main`
through the feature PR, whose body says `Closes #541`. Each slice is a sub-PR from
`feat/visual-fix--<slice>` into the feature branch, whose body says `Part of #541`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A visual fix can be proven. Covers: `labels.visual` (default `omni:visual`) in the config and in `omni init`'s label list; `omni visual <n>` printing `ok` or `not ok` with one line per failed check (one folder under `<paths.delivery>/visual/`, its `before-after.html`, the size cap through the code `omni check inbox` uses, no base64 raster image, every commit signed), exit `0`, `1` or `2`; its help entry; the rebuilt bundle | `kit/lib/config` `kit/lib/init/labels` `kit/lib/inbox/check-inbox` `kit/lib/visual/` `kit/bin/commands/visual.mjs` `kit/bin/commands/index.mjs` `kit/bin/visual.test.mjs` `kit/lib/help/entries` `kit/dist/omni.mjs` | — | 1 |
| s2 | A person can run `/omni:visual-fix`. Covers: the skill with the spec's flow and boundary, naming every label, branch and path through `omni config`; its help entry; its row and section in the guide's use-cases page; the delivery README's paragraph on `visual/`; the rebuilt bundle | `kit/plugin/skills/visual-fix/` `kit/lib/help/entries` `docs/guide/use-cases.md` `.omni-loop/delivery/README.md` `kit/dist/omni.mjs` | s1 | 2 |
| s3 | Seen working. Covers: one live run of `/omni:visual-fix` on a real line in this repository, ending in its own `omni:visual` PR into `main`, and one live stop on a line that needs data; both recorded in `live-run.md` beside this plan, with the links | `.omni-loop/delivery/shipped/0541-visual-fix/live-run.md` | s2 | 3 |

**Shared ground.** Two prefixes are declared by more than one slice, and the waves keep them apart:

- `kit/dist/omni.mjs` is declared by s1 (wave 1) and s2 (wave 2): each changes the kit's source and
  rebuilds the bundle with the kit's build command from the merged source, never by hand.
- `kit/lib/help/entries` is declared by s1 (the `omni visual` verb's entry, wave 1) and s2 (the
  `/omni:visual-fix` skill's entry, wave 2). The help test demands an entry for every verb and every
  skill folder, so each slice adds the entry for what it adds.

s3's own `omni:visual` PR goes into `main`, not into the feature branch, and a person merges it
like any visual fix. Only `live-run.md` is s3's sub-PR.

## Per slice: done when

**s1**

- `omni config` prints `labels.visual: omni:visual`, and a config that sets it prints the override
  (`kit/lib/config.test.mjs`).
- `omni init`'s label list holds `visual`, with a colour and a description
  (`kit/lib/init/labels.test.mjs`).
- On a fixture repository, `omni visual <n>` prints `ok` and exits `0` for a fix branch with one
  folder `<paths.delivery>/visual/<nnnn>-<slug>/` holding a valid `before-after.html`, every
  commit signed.
- It prints `not ok` and exits `1`, naming only that failure, for each of: no folder for `<n>`,
  two folders for `<n>`, no `before-after.html`, a page over `limits.beforeAfterMaxBytes`, a page
  with a base64 PNG or JPEG, an unsigned commit. A base64 SVG is allowed.
- It exits `2` outside an installed repository.
- `omni check inbox`'s size check behaves as before (its tests unchanged and green).
- The help lists `omni visual`, and the help test's command count moves by one.
- `kit/test/dist.test.mjs` and `kit/test/no-literals.test.mjs` are green.

**s2**

- `kit/plugin/skills/visual-fix/SKILL.md` carries the spec's ten steps, the boundary and the stop,
  and names no label, branch or path literally: `kit/test/plugin.test.mjs` and
  `kit/test/no-literals.test.mjs` are green.
- `/omni:help` lists `/omni:visual-fix` with one line on when to use it, and the help test is green.
- `docs/guide/use-cases.md`'s table has a row for a small visual change, linked to its own
  section, which shows the command and what comes next.
- The delivery README has one paragraph on `visual/<nnnn>-<slug>/`.

**s3**

- A live run on a real line opened an `omni:visual` issue, showed a page of today and four or five
  variations, applied the pick, and opened one PR labelled `omni:visual` that closes the issue,
  carries its `before-after.html`, and had `omni visual <n>` printing `ok`.
- A live run on a line that needs data commented on its issue with the `/omni:brainstorm` line
  and opened no PR.
- `live-run.md` links both issues and the PR, and says what was seen and what was not.
