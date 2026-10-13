# Settled outbox items — PRD 1804

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-setup-not-listed-unfilled -->

## s1-01-setup-not-listed-unfilled — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-setup-not-listed-unfilled
prd: 1804
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

When the install step cannot guess how to prepare a fresh copy of the project, should its closing list still name that step as one left to fill?

## The decision, in plain words

It is asked on a terminal and takes a flag like the others, but an empty answer means no preparation is needed, so the closing list never names it as unfilled.

## The intro, for fun

Some projects need nothing installed before their tests run.

## The punchline, for fun

Nagging them about it would be like reminding a bicycle to refuel.

## The options, in plain words

A. A. Never list the setup as unfilled: null means none is needed (built).
B. B. List it like the other commands, with its --setup flag, whenever it is null.

## What I had to decide

Whether a setup left empty is listed among the commands still to fill at the end of omni init.

## What I did meanwhile

omni init lists only test, preflight and preflightFull as unfilled; a null setup is read as none needed.

## What it costs to change later

One filter condition in kit/bin/commands/init.ts and the closing-steps tests that pin the list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says init asks for the setup when it cannot detect it, but not whether the closing list names it (author).

```

<!-- /omni-outbox-settled: s1-01-setup-not-listed-unfilled -->

<!-- omni-outbox-settled: s1-02-init-help-usage-setup-flag -->

## s1-02-init-help-usage-setup-flag — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-init-help-usage-setup-flag
prd: 1804
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The help page for the install command does not yet mention its new option for the preparation step. Who adds it?

## The decision, in plain words

That help text belongs to the other slice of this feature, so this slice left it as it was; the option works and the command's own usage line names it.

## The intro, for fun

A new switch arrived on the install command this morning.

## The punchline, for fun

Its help page has not heard the news yet.

## The options, in plain words

A. A. Leave the help entry to the feature branch after the wave merges (built: nothing changed here).
B. B. Add it in s2, whose territory holds the help entries.

## What I had to decide

Whether the --setup flag is added to omni help init's usage in kit/lib/help/entries.ts, by s2 or on the feature branch after the wave.

## What I did meanwhile

omni init accepts --setup and its usage error names it; omni help init still shows the usage without it.

## What it costs to change later

One line in kit/lib/help/entries.ts, plus its help test if one pins the usage.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the help entries to s2 for the skills only; init's usage line there was not assigned to either slice (author).

```

<!-- /omni-outbox-settled: s1-02-init-help-usage-setup-flag -->

<!-- omni-outbox-settled: s1-03-setup-tests-beside-a-law-proof -->

## s1-03-setup-tests-beside-a-law-proof — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T10:53:27Z
- Channel: feature pull request #1805
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1805#issuecomment-6143950989
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-13
- Raised: 2026-10-13
- Slice: s1
- Wave: 1
- Stays here: where one feature's tests sit beside a law's proof is a one-off placement; the law and its proof are unchanged, so nothing lasting to write back.

### The answer, as it was given

```text
A. A. Keep the setup checks in the files that already test init and the config, beside the rules' proofs (built).
```

### The item, as it was raised

```text
---
id: s1-03-setup-tests-beside-a-law-proof
prd: 1804
slice: s1
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The new checks for the preparation step were added to two test files that also prove that the install writes only inside its own folder, and that the config refuses a bad signature. Is it fine that those files now carry more than those proofs?

## The decision, in plain words

Yes: both rules are untouched and still proven by the same checks. The files only gained new checks that the config reads the preparation step and that the install proposes and writes it.

## The intro, for fun

Two test files guard the install's manners, and now they guard a little more.

## The punchline, for fun

Same guard dogs, one extra gate to watch.

## The options, in plain words

A. A. Keep the setup checks in the files that already test init and the config, beside the rules' proofs (built).
B. B. Move the setup checks to test files of their own, so the proof files stay as they were.

## What I had to decide

Confirm the proofs of N-PRODUCT-13 (kit/bin/init.test.ts) and BR-PRODUCT-23 (kit/lib/config.test.ts) stand as they are, or ask for the setup checks to move to test files of their own.

## What I did meanwhile

The setup checks live beside the existing init and config tests, as the testing form allows (PRD 1739, s2-01); no existing check of either rule changed.

## What it costs to change later

Moving the new tests to separate files: a few dozen lines, no code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants proof files kept to their proof alone was settled once for PRD 1739 only (author).

```

<!-- /omni-outbox-settled: s1-03-setup-tests-beside-a-law-proof -->

<!-- omni-outbox-settled: s2-01-law-proof-guards-setup-words -->

## s2-01-law-proof-guards-setup-words — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-13T10:53:27Z
- Channel: feature pull request #1805
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1805#issuecomment-6143950989
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-15
- Raised: 2026-10-13
- Slice: s2
- Wave: 1
- Stays here: the setup guards sit beside the unchanged merge-law guards in one test file; a placement choice, not a product rule.

### The answer, as it was given

```text
A. A. Keep the new install-step checks in the shared test file, beside the unchanged merge checks.
```

### The item, as it was raised

```text
---
id: s2-01-law-proof-guards-setup-words
prd: 1804
slice: s2
rank: high
bears-on: N-PRODUCT-15
raised: 2026-10-13
wave: 1
---

## The question, in plain words

To check the new install step, this slice added checks to the test file that also proves that only a person merges. Is it fine to change that file this way?

## The decision, in plain words

The new checks only read the words about the install step. Every check that proves an agent never merges is kept exactly as it was.

## The intro, for fun

One file guards two promises, and we just taught it a new trick.

## The punchline, for fun

The old promise still stands; the file just learned to read one more line.

## The options, in plain words

A. A. Keep the new install-step checks in the shared test file, beside the unchanged merge checks.
B. B. Move the install-step checks into a test file of their own, leaving the merge law's proof file untouched.

## What I had to decide

Answer A to keep the new checks beside the merge checks in the same test file. Answer B to move them into a test file of their own, so the file that proves the merge law stays untouched.

## What I did meanwhile

The new checks sit in the same file as the merge checks; nothing about merging changed.

## What it costs to change later

Moving the new checks to another file later is a small test-only change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the coverage guard should treat additions to a law's proof file that leave its assertions unchanged as risky is not settled by the spec (author).

```

<!-- /omni-outbox-settled: s2-01-law-proof-guards-setup-words -->
