# Settled outbox items — PRD 2992

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-any-member-requests-on-the-page -->

## s1-01-any-member-requests-on-the-page — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-17T12:11:25Z
- Channel: feature pull request #2993
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2993#issuecomment-6947666084
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-108
- Raised: 2026-11-17
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; BR-PRODUCT-108 reads as before, and only the Tech Approval assertion beside its proof changed.

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
---
id: s1-01-any-member-requests-on-the-page
prd: 2992
slice: s1
rank: high
bears-on: BR-PRODUCT-108
raised: 2026-11-17
wave: 1
---

## The question, in plain words

The page used to offer "Request a Tech Approval" only to the person who wrote the PRD. Should any member of the workspace see it, as long as the PRD is not approved and nobody has asked yet?

## The decision, in plain words

Any member sees it now. The test that checks who sees the approval area had a line saying another member does not, and that line now says they do.

## The intro, for fun

Who gets to knock on the engineer's door?

## The punchline, for fun

Anyone with a key to the building, as long as the door is still open.

## The options, in plain words

A. Any member of the workspace can ask for a Tech Approval on a PRD that is not approved (built).
B. Keep it for the author only, and other members ask the author to request one.

## What I had to decide

BR-PRODUCT-108 is proven by `apps/galaxy/src/dossier/page/approval.test.ts`. One assertion in the Tech Approval test there said a member who is not the author gets no request button. It now says they do (`canRequestTech` true for Bob). BR-PRODUCT-108's own assertions are unchanged.

## What I did meanwhile

The branch offers the button to any member, and the new tests in `tech-request-any-member.test.ts` pin it.

## What it costs to change later

Revert one line in `approval.ts` and one assertion in the test.

## What I could not know

- Whether a member who is not the author should also be kept from naming themselves: the branch lets them, and only refuses naming the author (author).
```

<!-- /omni-outbox-settled: s1-01-any-member-requests-on-the-page -->

<!-- omni-outbox-settled: s1-02-any-member-requests-in-the-database -->

## s1-02-any-member-requests-in-the-database — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-17T12:11:25Z
- Channel: feature pull request #2993
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2993#issuecomment-6947666084
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-127
- Raised: 2026-11-17
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; BR-PRODUCT-126 and BR-PRODUCT-127 read as before, and only the check of who may request changed.

### The answer, as it was given

```text
go with recommendation
```

### The item, as it was raised

```text
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
```

<!-- /omni-outbox-settled: s1-02-any-member-requests-in-the-database -->
