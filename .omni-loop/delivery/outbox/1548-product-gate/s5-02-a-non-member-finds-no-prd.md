---
id: s5-02-a-non-member-finds-no-prd
prd: 1548
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When someone outside a product's workspace tries to answer or raise one of its questions, should the server say they are not allowed, or that there is no such PRD?

## The decision, in plain words

It says there is no such PRD in their workspaces, the same answer as for a PRD that does not exist, so nobody learns what another workspace is building.

## The intro, for fun

A stranger knocks on a door that, as far as they can tell, is not there.

## The punchline, for fun

No door, no doorbell, no clue what is behind the wall.

## The options, in plain words

A. A. No such PRD, as for one that does not exist (built).
B. B. Not allowed, which tells them the PRD exists elsewhere.

## What I had to decide

Confirm that outbox_settle(), outbox_item_put() and outbox_item_adopt() refuse a non-member with P0002 'No PRD <key>-<n> in your workspaces.' rather than 42501.

## What I did meanwhile

The three RPCs find the PRD with prd_dossier(), which only looks among the caller's workspaces, as s1's approval_request() and dossier_push() do; a signed-out caller gets 42501. The check proves another workspace's owner and an account in no workspace are refused and write nothing.

## What it costs to change later

Answering 42501 instead is a lookup outside the caller's workspaces in outbox_prd_of(); no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Acceptance 9 says a non-member's answer is refused, not with what answer; s1 settled the same shape for approvals.
