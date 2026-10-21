# Settled outbox items — PRD 2305

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-baseline-skips-names-only -->

## s1-01-baseline-skips-names-only — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-baseline-skips-names-only
prd: 2305
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

While the old files are being cleaned, should the list of files still waiting for their cleanup also excuse them from the secret check, or only from the internal-names check?

## The decision, in plain words

A file on that waiting list is excused from the internal-names and real-email checks only. It is still checked for secrets, like every other file.

## The intro, for fun

A waiting list is a fine place to wait, not to hide a key.

## The punchline, for fun

The names get a grace period; the secrets never did.

## The options, in plain words

A. A. The waiting list excuses the internal-names and real-email checks only; secrets are checked everywhere (built).
B. B. The waiting list excuses a file from every check, secrets included, as the plan's words read.

## What I had to decide

Keep A unless a waiting file needs to hold a secret-shaped value that cannot go on the allowlist; then B, by dropping the secret rule's baseline check in the guard's scan step (one line).

## What I did meanwhile

Every file the guard reads is checked for secrets; the visible fakes in today's tests are on the allowlist with their reasons, so the guard is green on the feature branch.

## What it costs to change later

A constant: one condition in the guard's scan. The waiting list goes away with the last slice either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's done-when says a listed file is not judged at all; this reads it as not judged for internal names, the thing the list was made for (author).

```

<!-- /omni-outbox-settled: s1-01-baseline-skips-names-only -->

<!-- omni-outbox-settled: s1-02-guard-runs-in-security-workflow -->

## s1-02-guard-runs-in-security-workflow — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-guard-runs-in-security-workflow
prd: 2305
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

Which automatic check on a pull request should run the new open-source guard: the security check that also runs the secret scanner, or the main test check?

## The decision, in plain words

The guard runs as its own job in the security check, beside the secret scanner, on every pull request: drafts, slices and ready ones alike. It is also run by the whole test suite, so the main test check catches it too.

## The intro, for fun

Two new guards needed a post, so they share one sentry box.

## The punchline, for fun

Same box, two lamps, every pull request walks past.

## The options, in plain words

A. A. Its own job in the security workflow, on every pull request, beside gitleaks (built).
B. B. A step of the main checks of a ready pull request and of the quick check of drafts and slices.

## What I had to decide

Keep A unless the team wants the guard listed under the main checks of a ready pull request; then B moves the job's one step into that workflow and its quick sibling.

## What I did meanwhile

Every pull request shows an open-source job and a gitleaks job under the security workflow; the full test run also fails on a finding, through the guard's own test of every tracked file.

## What it costs to change later

A constant: one job moved between two workflow files, and their shape tests updated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan says the CI workflow runs it without naming which; the security workflow was the one place that already speaks for secrets and needs no install (author).
- If main's branch protection later requires named checks, the security workflow's two jobs must be listed there by a person (author).

```

<!-- /omni-outbox-settled: s1-02-guard-runs-in-security-workflow -->

<!-- omni-outbox-settled: s1-03-ci-form-names-new-jobs -->

## s1-03-ci-form-names-new-jobs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-ci-form-names-new-jobs
prd: 2305
slice: s1
rank: medium
bears-on: none
raised: 2026-10-21
wave: 1
---

## The question, in plain words

The team's written guide to the automatic checks still says the security check runs only once a day, and that the push hook only typechecks and lints. Who updates it to name the two new jobs and the hook's new first step?

## The decision, in plain words

This slice left the guide as it is, because the guide sits outside the files it may change. It suggests the slice that cleans the loop's knowledge folder adds the lines, or a person does.

## The intro, for fun

The guards are on duty; the duty roster has not heard yet.

## The punchline, for fun

Nobody reads a roster that is one shift behind.

## The options, in plain words

A. A. Leave the guide to the slice that owns the knowledge folder, or to a person (built).
B. B. Update the guide now, outside this slice's files.

## What I had to decide

Keep A unless the guide should change in this PRD's first wave; then B, a short docs change outside this slice, by a person or the history slice.

## What I did meanwhile

The guide's workflows table says the security workflow runs on a schedule or by hand, and its hooks paragraph names only the typecheck and lint of what changed.

## What it costs to change later

Three lines in the CI form of the playbook, whenever they land.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The CI form's workflows table needs a row for the security workflow's open-source and gitleaks jobs on every pull request (author).
- Its hooks paragraph needs the open-source guard as the pre-push hook's first step (author).

```

<!-- /omni-outbox-settled: s1-03-ci-form-names-new-jobs -->
