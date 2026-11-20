---
screen: prd-review
status: draft
mock: prd-review.html
implements: ["apps/galaxy/app/prd/[id]/review/page.tsx", "apps/galaxy/src/dossier/review/*.tsx", "apps/galaxy/src/dossier/review/*.ts"]
reads: ["apps/galaxy/src/dossier/page/approval.ts", "apps/galaxy/src/dossier/page/approval-diff.ts", "apps/galaxy/src/dossier/page/ApproveButton.tsx", "apps/galaxy/src/dossier/page/BusinessLawsVerdict.tsx", "apps/galaxy/src/dossier/page/ReadyPanel.tsx", "apps/galaxy/src/dossier/page/MarkSeen.tsx", "apps/galaxy/app/prd/layout.tsx"]
routes: [/prd/<id>/review]
uses: [PageHeader, ReviewScreen, SectionHeading, DefinitionList, Notice, Button, Badge, Stack, Text]
supersedes: null
---

## Purpose

The one screen a reader goes to when a decision of theirs is signed: "Review and approve" (a
spec and plan waiting), "Review the plan" (a tech approval) and "Review the feature" (a ready
feature PR). It is focused and full-width, and it holds nothing else: no tabs, no other panel, no
outbox. It reads in order (what changed since the reader last read it, the business-law verdict,
then the problem, the solution and the plan or the Ready checks) and ends in the one decision the
reader makes. Then it returns to the PRD page, on the tab that holds the decision's record.

It is a `ReviewScreen` in `@omni/ui`, under the page's `PageHeader`, whose breadcrumb ends at the
review (`Products › product › PRD number › Review`). The decision is the same server action the
approve button posts today: the same route, the same pinned files (BL-APPROVALS-1).

## Regions

- **The head, `PageHeader`:** the breadcrumb's last crumb names the review ("Review the spec and
  plan", "Review the plan", "Review the feature"). The title is the PRD's title at 32 px. The
  subtitle says what the reader is asked to decide in one sentence. The meta row holds at most five
  facts (Version, Opened, Waiting since, Repo, By). No primary action in the head: the decision sits
  at the foot of the screen.
- **What changed,** a `SectionHeading` "What changed since you last read it": each changed file's
  diff, as a list of `ListRow`s, each opening its diff inline. First read: the whole version, named
  as "First read". Nothing unchanged is shown.
- **The business-law verdict,** a `SectionHeading` "Business laws": on a red, each finding's law, its
  Why, the spec's words, what the judge found broken, its owner and Ask to amend this law, with
  Approve off. On a green, what was judged. When it could not judge, why, in one line.
- **The problem and the solution,** the spec's Problem and Solution, rendered as prose at the 900 px
  measure.
- **The plan or the Ready checks:**
  - for a spec and plan review, the plan's slice table;
  - for a tech approval, the plan's slices with their territories;
  - for a feature review, the five Ready checks with their evidence, and the criteria, as the
    `ready-checks` screen shows them.
- **The decision,** the foot of the screen, a `Stack` with the one row of actions:
  - **Approve** (spec, plan, tech approval): posts the pinned files of what the reader read;
  - **Request changes** (spec, plan): the reader's words, posted as an answer in the outbox, never
    reworded;
  - **Merge on GitHub** (feature): opens the feature PR on GitHub; nothing is merged here.
  Then a `Button` "Back to the PRD" as a plain link.
- **The notice,** a `Notice` above the decision, only when the version changed while the reader
  read it: "This changed while you read it. Review the new version." Approve is then off.

## States

- **Waiting, first read:** every file is marked First read; the decision is on.
- **Waiting, read before:** changed files marked Changed since you read it, unchanged files folded.
- **Drifted:** the decision is off; a `Notice` says the spec or plan moved since it was read, with
  Review again.
- **Red business laws:** Approve off, the Why and Ask to amend this law shown on each finding.
- **Not allowed to approve:** the page shows the same content read-only, with an `EmptyState`
  "You can read this. Only the people named on the approval can approve it." and no decision row.
- **Already approved:** the screen says who approved, when, and the version, with Back to the PRD.
- **Demo:** the demo PRD's review, without a database; its decision is shown but disabled.
- **Not found:** the same "Not found" as the PRD page, in the same words either way.

## Words

Decisions: Approve, Request changes, Merge on GitHub, Back to the PRD. Headings: What changed since
you last read it, Business laws, Problem, Solution, Plan, Ready checks. States: First read, Changed
since you read it, This changed while you read it. Review the new version. Approval record: Approved
by <who> on <when>. Agents' decisions keep the agent label (L-AIACT-1).

## Refusals

- Approve posts only the files the reader read: a file that changed after the reader opened the
  screen is never approved silently (BL-APPROVALS-1).
- No approve control on the PRD page's tabs: the review is the only place the decision is taken.
- The screen never merges. Merge on GitHub leaves the decision to GitHub.
- Request changes never rewords the reader's words (BL-ASK-1).
- It tells no one outside the workspace whether a PRD is real: the same Not found as the PRD page.

## Open questions

- Whether a reader who approved on the review screen returns to the PRD page on the tab that waits
  next, or to the tab that holds the approval record.
- Whether Request changes for a tech approval shares the spec's words, or has its own.
- Whether the "What changed" list folds a large diff by default, and at how many lines.

## Source

- omni-loop-20 spec, section 4 "Signed decisions on their own review screen", AC-3 (no approve panel above a tab)
- apps/galaxy/src/dossier/page/ApproveButton.tsx (the action the review's Approve posts)
- apps/galaxy/src/dossier/page/approval-diff.ts, approval.ts
- apps/galaxy/src/dossier/page/BusinessLawsVerdict.tsx
- BL-APPROVALS-1, BL-ASK-1, L-AIACT-1
