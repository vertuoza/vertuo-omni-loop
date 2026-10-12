# Settled outbox items — PRD 1739

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-context-tests-outside-law-proofs -->

## s1-01-context-tests-outside-law-proofs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-12
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-12
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-context-tests-outside-law-proofs
prd: 1739
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The plan put the new checks for the context files beside the existing install and settings checks, but those files prove product rules, and touching them makes every change look like a change to a rule. Where should the new checks live?

## The decision, in plain words

The new checks sit in their own files next to the code they test, so the files that prove product rules stay untouched and the change reads as what it is: new behaviour, no rule changed.

## The intro, for fun

Two test files guard the house rules, and we tiptoed past them.

## The punchline, for fun

Same checks, new address, no alarms tripped.

## The options, in plain words

A. Keep the new checks in their own files, so the files that prove product rules stay untouched (what was built)
B. Move the new checks into the files the plan named, and raise a high question to account for touching the rule proofs

## What I had to decide

Keep the new tests in kit/lib/laws.test.ts and the new kit/lib/init/detect.test.ts (A), or move them into kit/lib/config.test.ts and kit/bin/init.test.ts as the plan's done-when named, which needs a high item to account for the law-proof change (B).

## What I did meanwhile

The tests run in kit/lib/laws.test.ts (the paths.context default, the invariants lookup) and kit/lib/init/detect.test.ts (detectLawsSource with AGENTS.md alone, CLAUDE.md alone, and a CLAUDE.md outside paths.context). omni init reaches the same detectLawsSource, already proven by kit/bin/init.test.ts for CLAUDE.md.

## What it costs to change later

Moving them is a copy of three short tests between files, and one high item for the law-proof change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test drives omni init end to end with an AGENTS.md-only repository; detectLawsSource is tested directly (author).

```

<!-- /omni-outbox-settled: s1-01-context-tests-outside-law-proofs -->

<!-- omni-outbox-settled: s2-01-session-tests-beside-a-law-proof -->

## s2-01-session-tests-beside-a-law-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-12T16:11:30Z
- Channel: feature pull request #1744
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1744#issuecomment-6128066484
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-12
- Raised: 2026-10-12
- Slice: s2
- Wave: 1
- Became: playbook/testing#layout

### The answer, as it was given

```text
A. A. Keep the new session checks in the files that already test these commands, beside the rule's proof (built).
```

### The item, as it was raised

```text
---
id: s2-01-session-tests-beside-a-law-proof
prd: 1739
slice: s2
rank: high
bears-on: N-PRODUCT-12
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The new session id checks were added to two test files that also prove the rule that the 'what am I on now' command never refuses outside an installed folder. Is it fine that those files now carry more than that rule's proof?

## The decision, in plain words

Yes: the rule itself is untouched and still proven by the same checks. The files only gained new checks for the session id, and the command still reads nothing and answers 'on nothing' outside an installed folder.

## The intro, for fun

Two test files guard a rule, and now they guard a little more.

## The punchline, for fun

Same guard dogs, one extra fence to watch.

## The options, in plain words

A. A. Keep the new session checks in the files that already test these commands, beside the rule's proof (built).
B. B. Move the new session checks to a separate test file, so the rule's proof files stay as they were.

## What I had to decide

Confirm the rule's proof stands as it is, or ask for the new session checks to move to a test file of their own.

## What I did meanwhile

The new checks sit in the same files as the rule's proof; the rule's own checks are unchanged and green.

## What it costs to change later

Moving the new checks to their own file later is a small test-only change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the coverage guard flags any change to a file that proves a law, and these two files only gained new tests (author).

```

<!-- /omni-outbox-settled: s2-01-session-tests-beside-a-law-proof -->
