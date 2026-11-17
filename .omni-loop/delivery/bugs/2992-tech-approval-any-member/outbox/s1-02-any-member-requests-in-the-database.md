---
id: s1-02-any-member-requests-in-the-database
prd: 2992
slice: s1
rank: high
bears-on: BR-PRODUCT-127
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The database refused a Tech Approval request from anyone but the PRD's author. Should it accept one from any member, while still refusing to name the author as the reviewer?

## The decision, in plain words

It accepts one from any member now. The author is still recorded as the request's author, the person who asked is recorded too, and naming the author is still refused.

## The intro, for fun

The database had a bouncer who only knew one face.

## The punchline, for fun

Now it checks the guest list instead.

## The options, in plain words

A. Any member of the workspace can record the request (built).
B. Keep the database refusing anyone but the author, and the page button would fail for them.

## What I had to decide

BR-PRODUCT-127 (and BR-PRODUCT-126) are proven by `supabase/checks/tech_approval.sql`. That check asserted that a member who is not the author is refused. It now asserts that such a request is recorded, still refuses naming the author, and still refuses a ◇ PRD. The checks that prove BR-PRODUCT-126 and BR-PRODUCT-127 themselves are unchanged.

## What I did meanwhile

A new migration, `20270125140000_tech_request_any_member.sql`, drops the one author-only refusal from `dossier_request_tech_approval()`.

## What it costs to change later

A follow-up migration puts the refusal back. Requests already made by other members stay.

## What I could not know

- Whether PRDs born in a repository (◇) should take a Tech Approval too: left out, sent to /omni:brainstorm as a follow-up (author).
