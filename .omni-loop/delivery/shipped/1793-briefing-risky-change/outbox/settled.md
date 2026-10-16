# Settled outbox items — PRD 1793

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-app-reads-briefing-pointers -->

## s1-01-app-reads-briefing-pointers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-app-reads-briefing-pointers
prd: 1793
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

On GitHub, the check only sees the files the briefing points to when it already downloads the playbook, which happens when the repository keeps its rules in the knowledge folder. Should the check also download the briefing in every other repository, so a change to a file it points to is always caught there?

## The decision, in plain words

The check on GitHub catches every change to the briefing itself in every repository. It catches a change to a file the briefing points to only where it already downloads the playbook; the terminal check catches it everywhere.

## The intro, for fun

A rulebook that says see page twelve is only as safe as whoever checks page twelve.

## The punchline, for fun

Here the terminal always turns the page; the GitHub check turns it when the folder is already open.

## The options, in plain words

A. A. Leave the App's download as it is: the briefing's own path is caught everywhere, its pointers where the playbook is already downloaded.
B. B. Also download the briefing form at the head of every checked pull request, so its pointers are read in every repository.
C. C. Catch the briefing's pointers only in the terminal check, and say so in the guide.

## What I had to decide

Whether the check on GitHub downloads the briefing on every pull request, so it reads its pointers in every repository.

## What I did meanwhile

The briefing's own file is caught everywhere. A file it points to is caught on GitHub where the laws live in the knowledge folder with the playbook inside it, as here, and always by the terminal check.

## What it costs to change later

Option B is one more downloaded file per checked pull request and a change to the App's check, outside this slice's ground.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many repositories keep a pointer briefing outside the knowledge folder is unknown (author).

```

<!-- /omni-outbox-settled: s1-01-app-reads-briefing-pointers -->

<!-- omni-outbox-settled: s2-01-knowledge-check-test-names-the-briefing -->

## s2-01-knowledge-check-test-names-the-briefing — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-16T06:42:16Z
- Channel: feature pull request #1981
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1981#issuecomment-6209727024
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-95
- Raised: 2026-10-15
- Slice: s2
- Wave: 2
- Stays here: the laws' owner agreed to this one additive case in the file that proves BR-PRODUCT-95, which testing › Where tests live already leaves to the owner; no new rule.

### The answer, as it was given

```text
A. Keep the new case in the knowledge check's test, beside the other reviewer-list cases (built).
```

### The item, as it was raised

```text
---
id: s2-01-knowledge-check-test-names-the-briefing
prd: 1793
slice: s2
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-15
wave: 2
---

## The question, in plain words

The test that proves one of our knowledge rules now also checks that the list of reviewers for the laws names the agents' rulebook. Is it fine to grow that test?

## The decision, in plain words

I added one case to that test: a reviewer list written before the rulebook was named is reported out of date. Every case it already had stays as it was, and the rule it proves still holds as written.

## The intro, for fun

The rulebook finally gets its own bodyguard.

## The punchline, for fun

One more line on the guest list, and the bouncer checks it.

## The options, in plain words

A. Keep the new case in the knowledge check's test, beside the other reviewer-list cases (built).
B. Move it to the kb command's test only, and leave the rule's test as it was.

## What I had to decide

Whether `kit/lib/knowledge/check-knowledge.test.ts`, the test BR-PRODUCT-95 names, may carry the new case that a CODEOWNERS block without the briefing's lines is out of date (plan s2 asks for it there). The case only adds; no assertion of the rule's own cases changed.

Decided by: Jev (hardToRevert 0.76) · agent said true

## What I did meanwhile

The slice branch carries the new case beside the other CODEOWNERS cases; the knowledge check and kb tests are green.

## What it costs to change later

Moving the case to `kit/bin/kb.test.ts` alone is a test move, a few minutes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None known: the plan's done-when for s2 names this test as the place of the case (author).

```

<!-- /omni-outbox-settled: s2-01-knowledge-check-test-names-the-briefing -->
