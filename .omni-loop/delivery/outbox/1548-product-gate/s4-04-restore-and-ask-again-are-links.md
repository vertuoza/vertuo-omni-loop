---
id: s4-04-restore-and-ask-again-are-links
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When a file changed after a product PRD was approved, its approval card offers to restore the approved file and to ask for the approval again. What do those two do?

## The decision, in plain words

Restore opens the approved version of that file on the PRD's page, so someone can send it again, and Ask again opens the approval screen; neither changes anything by itself.

## The intro, for fun

The card got two shiny buttons, and we had to decide how brave they are.

## The punchline, for fun

For now they open doors, they do not walk through them.

## The options, in plain words

A. Two links: the pinned version, and the approve screen (built).
B. Restore pushes the pinned version back; Ask again stays a link.
C. Both act: Restore pushes it back, Ask again asks the product's approvers.

## What I had to decide

Confirm Restore as a link to the pinned version on the page (?tab=<kind>&v=<n>) and Ask again as a link to the approve screen (#approve), or ask for Restore to push the pinned version back as a new version, and Ask again to send the approvers a new request.

## What I did meanwhile

apps/galaxy/src/dossier/page/Attestation.service.ts builds both hrefs; Attestation.tsx renders them as plain links. The approve screen got id=approve in DossierPage.tsx. A product PRD's page shows no approve screen yet (approvalView reads only a PRD with a number), so Ask again lands on the page top until it does.

## What it costs to change later

A restoring push is a new action and route in galaxy calling dossier_push with the pinned content; an asking request is a page call of the existing approval request route. Either replaces a link with a button: no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec and the before/after page name restore and ask again, never what each does; the page has no action today that pushes an old version back.
