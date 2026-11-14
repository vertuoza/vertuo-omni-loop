---
id: s4-04-approval-read-from-the-prd-page
prd: 2842
slice: s4
rank: medium
bears-on: none
raised: 2026-11-14
wave: 3
---

## The question, in plain words

Where does a mission read whether a PRD's approval still stands, before it sends it?

## The decision, in plain words

From the PRD's page on Omni only: the latest product approval there, and whether a later change voided it, which reads 'approve it again'. A PRD approved only by merging its first pull request, with no approval recorded on its page, reads 'approve it' and is not sent.

## The intro, for fun

The mission checks the stamp on the PRD before it lets it board.

## The punchline, for fun

No stamp on the page, no boarding, however nice the ticket looks.

## The options, in plain words

A. Only the approval in force on the PRD's page counts (built).
B. A merged phase-0 pull request counts too, when the page holds no approval.

## What I had to decide

Whether the approval in force on the PRD's page is the only proof a mission accepts, as built, or whether a PRD approved by merging its phase-0 pull request should count too.

## What I did meanwhile

Built the read on the approvals of the PRD's page (the product kind, latest first) and the voids a push left on it; the tech approval is not read apart, since a product approval is refused until it is given. A mission's scope is this repository's PRDs, whose phase 0 here is on the server.

## What it costs to change later

A constant and one read: counting a phase-0 merge means reading the PRD's stage past inbox as approved too. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether every repository a mission may run in records its approvals on the page was not checked: a repository whose phase 0 is a merged pull request would see its PRDs wait on approval for ever.
