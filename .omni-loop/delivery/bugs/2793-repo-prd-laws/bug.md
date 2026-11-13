# Bug 2793: the terminal never reads a repository PRD's business-law verdict

## Triage

- **Domain:** approvals — the business-law verdict as the terminal reads it (the approval route, `omni prd`, `omni dossier push`, `/omni:brainstorm`)
- **Risk:** medium — an agent or person driving a repository PRD from the terminal never sees the red business-law verdict that blocks Approve; workaround: open the PRD page and read it there. (Jev, 0.97)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/bin/commands/prd-repo-laws.test.ts`
- **Level:** unit
- **Red:** × prints a red after the approval lines, each law with the spec's words and the judge's why

## Fix

The reproduction has two more files, for the route and the skill:
`apps/galaxy/src/approval/approval-api.repo-laws.test.ts` and `kit/test/brainstorm-laws.test.ts`; the
three ran 11 failed, 2 passed before the fix.

The approval route sent `laws` only for a product PRD, so a repository PRD's verdict never reached the
terminal. It now reads it for every PRD's dossier, the same way. `omni prd <n>` prints the `laws:` lines of
a ◆ PRD after its approval lines, and `omni dossier push <n>` prints them once the spec is judged, through
the product push's own wait (`reportLaws`, now shared). `/omni:brainstorm` reads the verdict after it pushes
the spec, at step 7 and in **Rework**, and reworks the spec on a red until it is not red.

## Guard

The three reproduction files: the route test fails if a repository PRD's reply drops `laws` again, the
command tests if `omni prd <n>` or `omni dossier push <n>` stop printing it, and the skill-text test if
`/omni:brainstorm` stops reading the verdict after its push.

## Mutation

mutation: no changed core file against origin/main (133632f8): nothing to mutate
