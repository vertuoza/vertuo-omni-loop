---
screen: attestation
status: draft
kind: page
mock: attestation.html
implements: ["apps/galaxy/app/prd/[id]/attestation/page.tsx", apps/galaxy/src/dossier/attestation/AttestationPage.tsx, apps/galaxy/src/dossier/attestation/CopyCommand.tsx, apps/galaxy/src/dossier/attestation/ApproveAgain.tsx, apps/galaxy/src/dossier/attestation/attestation.css, apps/galaxy/src/dossier/attestation/attestation.service.ts]
reads: [apps/galaxy/src/dossier/attestation/, apps/galaxy/src/dossier/page/approval.ts, apps/galaxy/src/dossier/page/route-gate.tsx, apps/galaxy/src/dossier/page/DossierSignIn.tsx, kit/lib/approval/approval.ts, apps/galaxy/app/prd/layout.tsx, apps/galaxy/src/nav/AppShell.tsx, apps/galaxy/src/nav/Sidebar.tsx, apps/galaxy/src/nav/AppBar.tsx, apps/galaxy/src/nav/BrandLogo.tsx, apps/galaxy/src/nav/UserMenu.tsx, apps/galaxy/src/nav/sidebar.ts, apps/galaxy/src/nav/Bell.tsx, apps/galaxy/src/nav/bell.ts]
routes: [/prd/<id>/attestation]
supersedes: null
---

## Purpose

The omni/approved check's Details (PRD 1612): one page that proves, for a PRD born on the server, who
approved it, when, under which policy, and whether the plan files at the pull request's head are still
the approved ones, `/prd/<id>/attestation?head=<sha>`. It reads the approval in force as the signed-in
member and judges it with the kit's own `judgeApproval`, so the page, the check and
`omni approval <n>` never disagree (`apps/galaxy/src/dossier/attestation/attestation.service.ts`). It
sits inside the app shell (`apps/galaxy/app/prd/layout.tsx`), a shared screen of its own, `app-shell`,
with the bell its own `notifications`: their files are in `reads` here.

## Regions

- **The trail:** `PRDs › <n> › Attestation`, back to the history and to the PRD's page.
- **The head:** the seal (the PRD's number and the short hash it was approved at, lit while the
  approval holds), the state in one line, and under it what drifted or why it is held, then who
  approved: `<login> · member of <workspace> ✓ · <product> approver ✓ · <when>`.
- **Pinned vs head `<sha>`:** one row per approved file, `=` when it matches the head, `≠` with both
  hashes and how (`content`, `whitespace only`, `missing`, `voided by <login>'s push`), `?` when the head
  could not be read, `·` for the personas' rounds, which are never judged.
- **Fix it,** on a drift only: `omni approval restore <n>` with Copy, then Approve again for a member
  the product lets approve, or who approves again for anyone else.
- **Targets:** the PRD's target PRs (`Part of <home>#<n>`, in its product's other repositories), each
  with its state.
- **The policy line:** `Policy: <product> approvers · <workspace> members.`, or any member.

## States

- **Approved** (mostly seen): the lit seal, every file `=`, no Fix it.
- **Drifted:** `Seal stands · build refused`, the changed file `≠` with both hashes, Fix it.
- **Waiting:** `Waits for approval`, `Nobody approved PRD <n> yet.`, nothing pinned, Open the PRD to
  approve it.
- **Held:** `Held · not failed`: no head named, GitHub could not read it (each file `?`), or the
  approver left the workspace.
- **Signed out:** the PRD page's sign-in card, back to the PRD's page.
- **Not a member, no such PRD, a draft or a fix:** the PRD page's Not found.
- **A PRD approved in its repository (◇):** `No attestation for this PRD`, with a link to it.
- **Demo:** PRD 918 in development, `?state=` picking the state.

## Words

Approved · pinned · Seal stands · build refused · Waits for approval · Held · not failed · Pinned vs
head · Pinned files · Fix it · Copy · Copied. · Approve again · to keep the change · Targets ·
Policy · Open the PRD to approve it · No attestation for this PRD.

## Refusals

- The page never says the gate failed when it could not read: a head it cannot read holds, every file
  `?`.
- Approve again goes through the PRD page's approval route as the signed-in person: the database
  decides who may approve, whatever the page shows.
- A link to another workspace's PRD reads Not found, in the PRD page's own words.

## Open questions

- Waiting shows a link to the PRD page as its one action; should the page offer Approve itself?
- A target PR shows the PRD's state while open: the check on that PR is the App's, and may read
  another head.
- Signed out, the sign-in card comes back to the PRD's page, not to the attestation.

## Source

- .omni-loop/delivery/inbox/1612-approved-gate/before-after.html (Pixel perfect)
- PRD 1612 s4, 2026-10-11 (drawn by hand from the before/after page and the source)
