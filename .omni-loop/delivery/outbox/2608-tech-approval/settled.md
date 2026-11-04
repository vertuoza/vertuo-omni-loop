# Settled outbox items — PRD 2608

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow -->

## s1-01-a-person-adds-the-tech-approval-check-to-the-workflow — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T10:03:57Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6628019789
- Basis: affirmation — the answer opens with "ok" and carries no contradiction marker
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: human-action
- Bears on: none
- Raised: 2026-11-03
- Slice: s1
- Wave: 1
- Stays here: a one-off step for this PRD, already on the feature branch; nothing lasting to record.

### The answer, as it was given

```text
ok
```

### The item, as it was raised

```text
---
id: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow
prd: 2608
slice: s1
rank: human-action
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

The new database check that proves the Tech Approval rules only counts if the automatic checks run it, and the agent was refused permission to change the workflow that lists them. Can a person add that one step?

## The decision, in plain words

The slice ships the check without its workflow step. Until a person adds the step, the check runs only when someone runs it by hand, so the database could stop enforcing a rule without any check going red.

## The intro, for fun

The guard is hired and trained, but nobody may write it onto the rota.

## The punchline, for fun

Only a person holds the pen for that page.

## What a person must do

1. Open .github/workflows/supabase.yml on the branch feat/tech-approval--s1 (or the feature branch once it merged).
2. Right after the step named "A push that changes a pinned file voids the approval", add a step named "A Tech Approval before the product approval" whose run line is the same psql command as its neighbours, with -f supabase/checks/tech_approval.sql.
3. Commit and push it as yourself, and answer this item.

## What I had to decide

A person adds the step to the database workflow, on this slice's branch or the feature branch, before the feature pull request is marked ready.

## What I did meanwhile

The check passes against a fresh local database with every migration, and every other database check stays green; the pull request's own checks do not run it yet.

## What it costs to change later

One step of five lines in one workflow file; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The agent's GitHub App lacks the permission to change workflow files, so this is the one part of the slice it cannot push.

```

<!-- /omni-outbox-settled: s1-01-a-person-adds-the-tech-approval-check-to-the-workflow -->

<!-- omni-outbox-settled: s1-02-an-early-product-request-still-reaches-the-bell -->

## s1-02-an-early-product-request-still-reaches-the-bell — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T10:02:16Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6627991725
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-11-03
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-126

### The answer, as it was given

```text
A. A. Record an early request; only the product approval waits (what was built).
```

### The item, as it was raised

```text
---
id: s1-02-an-early-product-request-still-reaches-the-bell
prd: 2608
slice: s1
rank: medium
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

If someone asks the product's approvers before the Tech Approval is given, should the database refuse that request, or record it and let the approvers' bell show it while their approval stays refused?

## The decision, in plain words

The database records it: the product's approvers see the request in their bell, but their approval is refused, naming who it waits on, until the Tech Approval is given. Keeping the terminal and the page from asking early is left to the slices that build them.

## The intro, for fun

Knocking on the second door before the first one opens is allowed; walking through is not.

## The punchline, for fun

The doorbell rings, the lock holds, and the sign says who has the key.

## The options, in plain words

A. A. Record an early request; only the product approval waits (what was built).
B. B. Refuse a product request while a requested Tech Approval is not given.

## What I had to decide

Keep asking open: only the approval itself waits. A later slice may refuse an early request with one more check in the same function.

## What I did meanwhile

A product approver asked early sees the request, presses approve, and reads that the PRD waits for the named person's Tech Approval.

## What it costs to change later

One check to add in the request function if early requests should be refused; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the product's approvers are asked once the Tech Approval is given, but does not say what an earlier request does (author).

```

<!-- /omni-outbox-settled: s1-02-an-early-product-request-still-reaches-the-bell -->

<!-- omni-outbox-settled: s1-03-the-tech-state-is-left-out-when-nobody-asked -->

## s1-03-the-tech-state-is-left-out-when-nobody-asked — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-04T10:02:16Z
- Channel: feature pull request #2609
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2609#issuecomment-6627991725
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: medium
- Bears on: none
- Raised: 2026-11-03
- Slice: s1
- Wave: 1
- Became: BR-PRODUCT-127

### The answer, as it was given

```text
A. A. Leave the tech part out when nobody asked (what was built).
```

### The item, as it was raised

```text
---
id: s1-03-the-tech-state-is-left-out-when-nobody-asked
prd: 2608
slice: s1
rank: medium
bears-on: none
raised: 2026-11-03
wave: 1
---

## The question, in plain words

When a PRD has no Tech Approval request, should the approval the terminal reads say nothing about it, or say there is none?

## The decision, in plain words

It says nothing: the tech part appears only once a Tech Approval was requested, so a PRD with no request reads exactly as it does today, for an older terminal too.

## The intro, for fun

Silence is the most backward-compatible answer there is.

## The punchline, for fun

Nobody asked, so nobody hears a word about it.

## The options, in plain words

A. A. Leave the tech part out when nobody asked (what was built).
B. B. Always send it, empty when nobody asked.

## What I had to decide

Keep the tech part absent with no request; it holds the login of the named person and one state of asked, approved or voided once there is one.

## What I did meanwhile

The later slices read a missing tech part as no Tech Approval requested.

## What it costs to change later

A constant to change in one function if an empty value is wanted instead; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec calls the field optional without saying whether it is absent or empty when nobody asked (author).

```

<!-- /omni-outbox-settled: s1-03-the-tech-state-is-left-out-when-nobody-asked -->
