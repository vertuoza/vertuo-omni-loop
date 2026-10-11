---
id: s3-04-the-approval-route-takes-a-prd-id
prd: 1548
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Approving a product PRD on its page, and reading its approval from the terminal, used to fail because such a PRD has no repository or issue. How should the web app name such a PRD when asked for its approval?

## The decision, in plain words

It takes the PRD's own name, like mobile-12, with the repository optional and only used to pick the workspace. Approving a product PRD works and labels no issue, since it has none.

## The intro, for fun

The approval desk only took forms with a street address on them.

## The punchline, for fun

Now it also takes a name and a product, no address needed.

## The options, in plain words

A. A. The PRD is named by its id, the repository optional (built).
B. B. The product key and the number are sent as two parameters.

## What I had to decide

Confirm GET /api/dossiers/approval?prd=<key>-<n>[&repo=<owner/name>] as the shape s2's kit reads a product PRD's approval with.

## What I did meanwhile

apps/galaxy/src/approval/approval-api.ts calls dossier_approval(p_repo, p_prd, p_product) for a product PRD id (p_repo empty when none is given), refuses an id out of shape by saying the PRD is a number or a product PRD's id like mobile-12, and after dossier_approve() answers repo and prd null with prdId, reads the approval in force by that id and labels nothing.

## What it costs to change later

Another parameter shape is a few lines in the route and its tests, and in s2's caller.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s2 builds the kit's reader in parallel; the two must agree on this query shape.
- (author) After approving, the PRD is re-read by its id with no repository hint, so a person in two workspaces sharing the key reads the oldest product's PRD (settled item s1-02).
