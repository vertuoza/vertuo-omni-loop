# Live run: /omni:visual-fix

PRD #541, slice s3. Two runs of the skill as written on `feat/visual-fix`
(`kit/plugin/skills/visual-fix/SKILL.md`), on 2026-09-29, in this repository.

## 1. A visual fix, end to end

The line, as the person gave it: "in the main menu of the app, Docs and Release notes open in a new
tab".

| step | what happened |
|---|---|
| 2. Issue | #548 `Visual: Docs and Release notes open in a new tab from the app menu`, labelled `omni:visual`, signed. The label was created first, with the person's approval (`labels.autoCreate` is false here); its colour and description come from `omni init`'s list. |
| 3. Locate | The sidebar's Omni group: `apps/galaxy/src/nav/Sidebar.tsx` (the `leavesApp` items) and `apps/galaxy/src/nav/sidebar.css`. Inside the boundary: link markup chosen by an existing value, and how the cue looks. |
| 4. Variations | One scratchpad page, opened in the browser: today, then A (keep ↗), B (a new-tab box icon), C (a "new tab" chip), D (quieter items, ↗ on hover), E (the icon leads the label, a rule above the group). One question; the person picked **B** in the first round. |
| 5. Branch | `fix/548-omni-links-new-tab`, a worktree cut from `origin/main`. |
| 6. Apply | Test-first. `Sidebar.render.test.ts` and `src/switch/headers.test.ts` were changed and seen red (12 tests), then the component. The links now carry `target="_blank" rel="noopener"`, an inline SVG replaces ↗, and the names end "(opens in a new tab)". `pnpm test` was green (391 files, 6121 tests). |
| 7. Real check | **Not done.** The app has no local env in this checkout, only `.env.example`, so the sidebar could not be seen running. The PR says so, and its Vercel preview is the check. |
| 8. Record | `.omni-loop/delivery/visual/0548-omni-links-new-tab/before-after.html`, 6521 bytes: today beside B, then A, C, D and E under "Not picked". |
| 9. Ship | One signed commit. `omni visual 548` printed `ok`, run with the kit from `feat/visual-fix` because `main` does not have the verb yet. `omni visual 549`, a number with no folder, printed `not ok` and exited 1, which proves it read the fix branch. PR **#550**, labelled `omni:visual`, body `Closes #548`, into `main`. |

## 2. A stop

The line: "the sidebar shows how many visual fixes are open", issue **#551**, labelled `omni:visual`.

Step 3 found it needs data the sidebar does not read today: a new fetch of `omni:visual` issues and
a new badge source beside the waiting counts. The skill commented on #551 with what crossed the line
and the `/omni:brainstorm` line, then stopped. No branch was cut and no PR opened.

## What this run found

- **Before the feature PR merges, `omni visual` is not on `main`.** A visual fix made during that
  window has to run the verb from the feature branch's kit, as this run did. Once #542 merges and
  repositories run `omni update`, this goes away.
- **`labels.visual` must exist on GitHub.** In a repository where `labels.autoCreate` is false,
  the first run needs a person to create it (`omni init` creates it for new installs).
- **The real check depends on a runnable app.** Here it could not be done, and the skill said so
  instead of claiming it.
