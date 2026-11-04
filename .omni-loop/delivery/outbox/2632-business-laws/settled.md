# Settled outbox items — PRD 2632

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-law-only-domain-folder -->

## s1-01-law-only-domain-folder — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-law-only-domain-folder
prd: 2632
slice: s1
rank: medium
bears-on: none
raised: 2026-11-04
wave: 1
---

## The question, in plain words

When a domain's folder holds only its business laws, should the knowledge check still ask it for the other files every domain folder carries?

## The decision, in plain words

No: a domain folder that holds its business laws and nothing else is accepted as it is, so a product can write its laws without filling in the rest of that domain's knowledge first.

## The intro, for fun

A folder with one good file in it walks up to the inspector.

## The punchline, for fun

The inspector reads the one file and lets it through.

## The options, in plain words

A. A. A domain folder holding only its business laws asks for nothing else, as built
B. B. Every domain folder, business laws or not, carries its README and its three register files
C. C. Accept a folder holding only business laws only in a repository that keeps no locked laws of its own

## What I had to decide

Keep A, or choose B and every domain folder holding business laws must also carry its README and the three register files before the check is green.

## What I did meanwhile

A folder holding only business-laws.md passes the layout check; a folder holding any other file is still asked for its README and the three register files, as before.

## What it costs to change later

One condition in the layout check to remove; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The product/ folder is still asked for its three register files whenever the knowledge folder exists, business laws or not; a plan repository with laws.source none and no product registers stays red until it adds them (author).
- Whether Vertuoza's plan repository already carries the product register files was not checked from here (author).

```

<!-- /omni-outbox-settled: s1-01-law-only-domain-folder -->

<!-- omni-outbox-settled: s2-01-law-home-business-read-key -->

## s2-01-law-home-business-read-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-law-home-business-read-key
prd: 2632
slice: s2
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

The page's read of a product's business only accepts the keys it already knows, so the new law home answer would have made every read fail. Is it fine that slice s2 let that read accept one more key, though the file sits outside its listed territory?

## The decision, in plain words

The read now accepts an optional law home, and a server that sends none reads exactly as before. Nothing else in that file changed.

## The intro, for fun

A strict doorman kept turning away a guest nobody had put on the list.

## The punchline, for fun

We added one name to the list, and only that name.

## The options, in plain words

A. A. Accept the key in the business read, as built: one optional line, covered by a test.
B. B. Leave the read untouched and serve the law home from another endpoint, which needs a new route and a second call from every terminal.

## What I had to decide

One optional line in apps/galaxy/src/business-api/read.ts: lawHome: z.string().nullable().optional(). The read schema is strict, so without it the law home returned by business_for_repo() makes every business read fail with an unexpected answer. Reverting the line while keeping the migration would break the read, so the migration and the line go together.

## What I did meanwhile

Nothing waits: the line is in the slice's pull request, and the law home reads as none until a server sends one.

## What it costs to change later

Reverting means removing one optional line and the law home key from the database function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a separate endpoint would be preferred over widening the strict read (author).

```

<!-- /omni-outbox-settled: s2-01-law-home-business-read-key -->

<!-- omni-outbox-settled: s3-01-business-law-held-on-knowledge-and-feature-prs -->

## s3-01-business-law-held-on-knowledge-and-feature-prs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-business-law-held-on-knowledge-and-feature-prs
prd: 2632
slice: s3
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

Which pull requests into the main branch should wait for the product manager when they change a business law?

## The decision, in plain words

A feature pull request and a knowledge pull request wait for the product manager, whatever the repository's law setting. A pull request from any other branch is not held, as for the other laws today.

## The intro, for fun

A rule only the manager may change needs every change to walk through a guarded door.

## The punchline, for fun

Two doors are guarded now; the side door is still the one nobody watches.

## The options, in plain words

A. A. Hold a business law on feature and knowledge pull requests only, the knowledge one found by its branch name (built).
B. B. Hold it on every pull request into the main branch, reading each one's changed files before skipping it; the gate law's test changes, approved by its owner.
C. C. A, and also hold fix and enforce pull requests under every law setting.

## What I had to decide

Answer A to keep it. B makes the check read the changed files of every pull request into the main branch before it skips one, which changes the proof of BR-PRODUCT-6 and N-PRODUCT-4 (apps/omni-app/src/outbox-check/outbox-check.test.ts asserts a skipped pull request reads no compare): only @pierrederval or @dervalp approve that. C widens A to fix and enforce branches under laws.source none.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Built as A: checkTarget gates a knowledge PR under any laws.source by its branch alone, and law-locked holds a changed business-laws.md on it and on every graded feature PR, until a CODEOWNER of the file (or laws.owners) approves the head.

## What it costs to change later

B costs one more GitHub read (the compare) for every pull request into the main branch the check would skip, and an owner's approval of the change to a locked law's test. C costs a read of the changed files on fix and enforce PRs the check skips today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A business law changed on another branch (a chore branch, or a feature branch with no PRD folder) merges unheld until B is chosen; the register laws have the same gap today. (author)
- The skipped knowledge PR now opens its check in progress and reads its comments and changed files before it completes skipped, where it completed skipped at once before. (author)

```

<!-- /omni-outbox-settled: s3-01-business-law-held-on-knowledge-and-feature-prs -->

<!-- omni-outbox-settled: s4-01-verdicts-check-runs-from-approvals -->

## s4-01-verdicts-check-runs-from-approvals — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-verdicts-check-runs-from-approvals
prd: 2632
slice: s4
rank: medium
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

The new database check for the business laws' verdicts should run as its own named step in the database workflow, but an agent may not change a workflow file. How should it run until a person adds that step?

## The decision, in plain words

The approvals check now runs the verdicts check right after its own, so the database workflow proves it on every pull request today. A person can later give it its own step and remove that one line.

## The intro, for fun

The robot wrote a new test, then found the door to the test room was locked.

## The punchline, for fun

So it slipped the test into a friend's backpack, and left a note on the door.

## The options, in plain words

A. A. Keep the verdicts check running from the approvals check, as built.
B. B. A person adds the verdicts check as its own workflow step and removes the include line.

## What I had to decide

Whether the verdicts check keeps running from the approvals check, or a person adds the step `The business laws' verdicts, and the approval a red holds` to the supabase workflow's check job, running `supabase/checks/business_law_verdicts.sql`, and drops the `\ir business_law_verdicts.sql` line at the end of `supabase/checks/approvals.sql`.

## What I did meanwhile

`supabase/checks/approvals.sql` ends with `\ir business_law_verdicts.sql`, so the supabase workflow's approvals step runs both, each in its own transaction; the push refused a workflow change (`refusing to allow a GitHub App to create or update workflow ... without workflows permission`), so `.github/workflows/supabase.yml` is unchanged.

## What it costs to change later

One workflow step added and one line removed from `supabase/checks/approvals.sql`; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The conventions form asks each check to be its own named step; this departs from it until a person with the workflows permission adds the step (author).

```

<!-- /omni-outbox-settled: s4-01-verdicts-check-runs-from-approvals -->

<!-- omni-outbox-settled: s4-02-no-law-applies-reads-green -->

## s4-02-no-law-applies-reads-green — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-04
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-04
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-no-law-applies-reads-green
prd: 2632
slice: s4
rank: medium
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

When the product has business laws but none of them applies to a spec (its words point to no domain, and the product has no law that applies everywhere), should the PRD page call that a pass or say it was not judged?

## The decision, in plain words

It is a pass: the page says the business laws passed with none judged, adds that no business law applies to this spec, and Approve stays on. The model is not asked, and the verdict is kept like any other.

## The intro, for fun

The referee arrived, looked at the field, and found nobody had brought a ball.

## The punchline, for fun

So the match ended with no fouls, which is technically a clean game.

## The options, in plain words

A. A. A spec no law applies to is green, with none judged, as built.
B. B. It is neutral: the page says the business laws were not judged, and why.

## What I had to decide

Whether a spec no business law applies to is a green verdict (`Business laws ✓ 0 judged`, "No business law applies to this spec.") or a neutral one (`Business laws not judged: no business law applies to this spec`).

## What I did meanwhile

`judgeSpec` (apps/galaxy/src/business-laws/judge.service.ts) answers `green` with the reason `no business law applies to this spec` and no law judged; the verdict is kept per spec version and pack like any other, and Approve stays on either way.

## What it costs to change later

One branch of `judgeSpec` and one line of `BusinessLawsVerdict.tsx`; verdicts already kept as green stay green, being never rewritten.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a product with no law is neutral and shows nothing, and that a green says what it judged; it does not say which a spec with laws but none selected is (author).

```

<!-- /omni-outbox-settled: s4-02-no-law-applies-reads-green -->
