---
id: s4-02-approval-route-shape
prd: 1299
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The page and the terminal must agree on how an approval is described before the page side is built. What does the page answer?

## The decision, in plain words

The page answers the PRD page's link and the approval in force, or none yet: who approved, whether they are still in the workspace, when, and each approved file with its kind, its place, its fingerprint and, when it can, its approved text. A PRD with no page is refused.

## The intro, for fun

Two teams are building a bridge from both banks at once.

## The punchline, for fun

This item is the drawing they both tape to the wall.

## The options, in plain words

A. A. This shape, the approved text optional, as built
B. B. The route sends a whitespace-free fingerprint beside each one instead of the text
C. C. Drop the whitespace-only wording and always say content

## What I had to decide

The reply shape of GET /api/dossiers/approval that slice s2 must honour, and how the kit pairs and words a drift.

## What I did meanwhile

The kit reads { url, approval: null | { approver: { login, member }, approvedAt, files: [{ kind, path, sha256, versionId, content? }] } }; a 404 (no dossier) reads as refused (404); any other shape as refused (malformed reply). Kinds the PRD folder keeps (spec, plan, before-after, voice) are paired by kind; any other kind (a scenario) is read at its pinned path. Whitespace only is told only when the route sends the approved text; without it a change says content. Either way it refuses.

## What it costs to change later

Each field is one line on both sides while neither has shipped; after s2 merges, a rename is a coordinated change to the route and the kit's schema.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the route answers the approver's login, membership, time and pinned files, but not the field names, the dossier link, nor how the kit can tell whitespace from content with only a hash. The optional approved text is my answer to the last.
