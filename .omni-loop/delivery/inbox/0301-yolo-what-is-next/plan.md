# Plan: What is next, after the yolo

PRD #301, spec beside this plan (`spec.md`). The feature branch `feat/yolo-what-is-next` merges
into `main` through the feature PR, whose body says `Closes #301`. Each slice is a sub-PR from
`feat/yolo-what-is-next--<slice>` into the feature branch, whose body says `Part of #301`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The yolo and the yolo-fix end with a plain "What is next?". Covers: `/omni:yolo` step 7 headed `## 7. Hand off`, keeping its report, then the PRD's folder as a tree read from `omni prd <n>` (shipped with `outbox/` inside, or the inbox folder with its outbox folder as a second tree), where it is on the six stages with "you are here" under outbox and "merging the feature PR moves it here" under shipped, and What is next? for the green, red and held endings, each with its own last line; no hand-off for a run that stops before step 2; step 5's red-gate report line and step 7's closing merge line dropped; `/omni:yolo-fix` step 8 headed `## 8. Hand off`, ending with `/omni:yolo` §7's hand-off, its held ending running `/omni:yolo-fix <n>`; the assertions in the plugin test; one **Changed** line in each porting note | `kit/plugin/skills/yolo/` `kit/plugin/skills/yolo-fix/` `kit/test/plugin.test.mjs` `kit/porting/plugin--yolo.md` `kit/porting/plugin--yolo-fix.md` | — | 1 |

**Shared ground.** One slice, so none. `kit/test/plugin.test.mjs` is also where every other skill's
guard lives: s1 adds one `describe` block and changes no existing assertion. PRD 262's release-note
block reads yolo step 5 and yolo-fix step 7, which s1 leaves in the same order.

## Per slice: done when

**s1**

- `/omni:yolo` step 7 is headed `## 7. Hand off`. After the report it says to end the reply with:
  - the PRD's folder as a tree, read from `omni prd <n>` on the feature branch: `<dir>/` with
    `spec.md`, `plan.md`, `before-after.html`, `release.md` only when listed, and `outbox/` inside
    a shipped folder; in the inbox, the outbox folder as a second tree, one line per open item file
    and `settled.md`;
  - **Where it is**: `idea ──▶ PRD ──▶ inbox ──▶ outbox ──▶ shipped ──▶ retro`, "you are here"
    under outbox, "merging the feature PR moves it here" under shipped, and the brainstorm's six
    stage lines word for word;
  - **What is next?**, green (review the feature PR, merge it, the retro and knowledge PRs if the
    app is installed, then `Nothing to run: merging #<feature PR> is yours.`; a stuck CI names its
    red check under step 1), red (the outbox comment's link, how to answer, `/clear`, then
    `/omni:yolo-fix <n>`), or held (the PR that holds it, what a person must do, `/clear`, then
    `/omni:yolo <n>`), with that last line alone as the reply's last line.
- A run that stops before step 2 keeps its one line and prints no hand-off.
- Step 5's red-gate "Report: …" line and step 7's "A person merges the feature PR" line are gone.
- `/omni:yolo-fix` step 8 is headed `## 8. Hand off`, keeps its report, no longer says
  "A person merges", and ends with `/omni:yolo` §7's hand-off, its held ending running
  `/omni:yolo-fix <n>`.
- A new block in `kit/test/plugin.test.mjs` asserts the spec's **Test seams** on the live skills,
  and a fixture shows it fails when a phrase is removed, an ending's last line changes, or an
  ending is missing.
- `kit/porting/plugin--yolo.md` and `kit/porting/plugin--yolo-fix.md` each carry a **Changed**
  line for PRD 301.
- `pnpm test` passes, `no-literals`, `no-game-words`, PRD 262's release-note block and the plugin
  guard included.
