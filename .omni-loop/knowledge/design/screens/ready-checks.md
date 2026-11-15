---
screen: ready-checks
status: draft
kind: page
mock: ready-checks.html
implements: [apps/galaxy/src/dossier/page/ReadyPanel.tsx, apps/galaxy/src/dossier/page/ready.ts, apps/galaxy/src/dossier/page/dossier.css]
reads: [apps/galaxy/src/dossier/page/ready.repository.ts, apps/galaxy/src/dossier/page/DossierPage.tsx, kit/lib/ready/]
routes: [/prd/<id>]
supersedes: null
---

## Purpose

What "ready for review" proves, for one feature pull request a mission gates: the five checks of
its latest commit, each one tap from its evidence, so a reviewer trusts it without asking an
engineer. A panel of the PRD page (`prd-dossier`), never a page of its own: it shows the latest
verdict the Omni App saved (`public.ready_verdicts`, PRD 2898). Ready is never merged: only a
person merges.

## Regions

- **The top:** the label Ready, the verdict (`Ready for review · 5 of 5`, `Not ready · 4 of 5`,
  `Not finished · 3 of 5 so far`) and its signature, the App's with the commit and the time
  (L-AIACT-1).
- **The failing check,** named at the top when one fails: the check, the file and why, and whether
  an answered question excuses it.
- **The five checks,** in order: CI green on the latest commit · Full tests and lint ran · Every
  acceptance criterion has its proof · No test was loosened · The change stayed in its area. Each
  with its mark, its state and a link to its evidence.
- **The criteria,** under check 3: each `AC-n` with its kind (`test` or `e2e`), its Given, When and
  Then, its state and its proof (the test, or the e2e report).
- **The foot:** `Ready for review, not merged.` `Only a person merges.` and the primary action
  **Review PR <n>**; on a draft, why it stays one and the primary action opens the evidence.

## States

- **5 of 5** (1.A): ready, every check Pass.
- **4 of 5** (1.B): a check Fail, named at the top; the pull request stays a draft and the Reviewer
  asked for changes.
- **Waiting** (1.C): a check whose evidence is not there yet (a run still going, the preview not up,
  no runner for the e2e scenarios) reads Waiting and never passes.
- **Not judged · <why>:** a check whose evidence could not be read; never passes. Not drawn.
- **No verdict yet:** no panel.

## Words

- `Ready`, `Ready for review · 5 of 5`, `Not ready · 4 of 5`, `Not finished · 3 of 5 so far`.
- `Pass`, `Fail`, `Waiting`, `Not judged · <why>`.
- `Ready for review, not merged.`, `Only a person merges.`, `Review PR <n>`.
- `Stays a draft.`, `The Reviewer asked for changes.`, `waiting for a runner`.

## Refusals

- No check passes on an agent's word: each one links to a run, a test, a diff or a report.
- Waiting and Not judged never count as passed (BL-GATE-1).
- The word "merged" never appears as a state.

## Open questions

- Whether the panel shows above every tab, as drawn, or only on PR care.
- Whether check 3 lists its criteria open at 5 of 5, as drawn, or folded.

## Source

- /omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
- /omni:brainstorm, PRD 2898: .omni-loop/delivery/inbox/2898-ready-five-checks/before-after.html
