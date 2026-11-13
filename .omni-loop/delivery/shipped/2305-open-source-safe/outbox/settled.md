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
- Stays here: It governs a temporary waiting list that disappears with the last slice, so nothing lasting remains beyond this feature's ledger.

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
- Became: ADR-0123

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
- Stays here: A one-off docs follow-up about who edits three lines of the CI guide; nothing lasting about the product or code to keep.

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

<!-- omni-outbox-settled: s6-01-checks-own-workspace-initech -->

## s6-01-checks-own-workspace-initech — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s6
- Wave: 2
- Became: ADR-0124

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-checks-own-workspace-initech
prd: 2305
slice: s6
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The database checks used to lean on the company's own workspace, which a fresh install no longer creates. What should the checks' own made-up workspace be called, and should every check share one copy of it?

## The decision, in plain words

The checks share one made-up workspace called Initech, with its own GitHub organisation, instead of the demo-org name the plan suggests, because the demo world already owns demo-org and two workspaces of one organisation would make the checks read the demo world's data.

## The intro, for fun

Every test needs a company to pretend to be, and the demo world had already taken the nice name.

## The punchline, for fun

So the checks moved into Initech, where the printers jam but the tests pass.

## The options, in plain words

A. One shared fixture, Initech with organisation initech, included by each check (built).
B. The same shared fixture, renamed to a name the reviewer prefers.
C. Inline the fixture in every check that needs it, with no shared file.

## What I had to decide

Whether the checks' fixture workspace is Initech (organisation initech), shared through supabase/checks/fixtures/initech.sql that each check includes after its begin, or whether it should be renamed or inlined.

## What I did meanwhile

Every check that needed a playing workspace includes the shared fixture and passes locally against a fresh database; the open-source guard is green with the supabase baseline deleted.

## What it costs to change later

Renaming the fixture is a find-and-replace over supabase/checks; inlining it copies about forty lines into each of thirty-three checks. No migration, no production data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The conventions form says each file under supabase/checks is a CI step; the fixture sits in a subfolder and is no check of its own (author).

```

<!-- /omni-outbox-settled: s6-01-checks-own-workspace-initech -->

<!-- omni-outbox-settled: s6-02-old-migration-keeps-its-file-name -->

## s6-02-old-migration-keeps-its-file-name — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s6
- Wave: 2
- Stays here: A one-off choice about one file's name during the open-source clean-up; nothing lasting for the product or code to guarantee.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-old-migration-keeps-its-file-name
prd: 2305
slice: s6
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

One old database step now does nothing, but its file name still carries the company's name. Should the file be renamed, or kept as it is?

## The decision, in plain words

The file keeps its name. Its content no longer names the company or does anything, and renaming a step the live database already ran is a risk the plan never asked to take.

## The intro, for fun

The step was emptied out, but its name tag is still sewn into the collar.

## The punchline, for fun

A label on an empty box is history, not a secret.

## The options, in plain words

A. Keep the file name; only its content changed (built).
B. Rename it to a neutral name with the same version, after checking the deploy job accepts it.

## What I had to decide

Whether supabase/migrations/20260926160000_vertuoza_sectors.sql keeps its name (built), or is renamed with its version unchanged, once someone confirms the deploy job treats a renamed applied migration as already applied.

## What I did meanwhile

The file holds a comment and `select 1;` only; a fresh install applies it and creates nothing. The open-source guard reads contents, not file names, so it passes.

## What it costs to change later

Renaming later is one git mv, after checking supabase db push against production's migration history; keeping it costs nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether supabase db push --include-all compares a migration's name as well as its version was not checked against production (author).

```

<!-- /omni-outbox-settled: s6-02-old-migration-keeps-its-file-name -->

<!-- omni-outbox-settled: s8-01-open-source-green-line-keeps-baseline-wording -->

## s8-01-open-source-green-line-keeps-baseline-wording — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-21
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-21
- Slice: s8
- Wave: 3
- Stays here: A temporary wording choice about one output line; nothing lasting about behaviour to keep in the knowledge base.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s8-01-open-source-green-line-keeps-baseline-wording
prd: 2305
slice: s8
rank: medium
bears-on: none
raised: 2026-10-21
wave: 3
---

## The question, in plain words

The guard still prints '0 still in the baseline' although no baseline is left. Should its wording change now?

## The decision, in plain words

The printed lines stay as they were, because a pre-push hook test reads the green line word for word.

## The intro, for fun

A tiny line of text is asking for a tiny edit.

## The punchline, for fun

Nobody has tripped over it yet, so it stays put for now.

## The options, in plain words

A. A. Keep the printed lines as they are (built).
B. B. Change both lines and the hook test in one slice.

## What I had to decide

Pick A to keep the wording until the hook test is updated, or B to change the line and that test in one slice.

## What I did meanwhile

The guard prints the old green and red lines, with a count of 0 that is always true now.

## What it costs to change later

Low: one misleading word in one output line until a later slice rewrites it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The owner of the hook test is not checked by this slice.

```

<!-- /omni-outbox-settled: s8-01-open-source-green-line-keeps-baseline-wording -->

<!-- omni-outbox-settled: s6-03-law-proofs-renamed-fixtures -->

## s6-03-law-proofs-renamed-fixtures — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-21T13:58:46Z
- Channel: feature pull request #2307
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2307#issuecomment-6317920919
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: N-PRODUCT-16
- Raised: 2026-10-21
- Slice: s6
- Wave: 2
- Stays here: the lasting rule (fixtures use fictional names) is the open-source guard itself, scripts/open-source.ts; this answer only approves renamed law proofs

### The answer, as it was given

```text
A. The renamed proofs stand as they are (built).
```

### The item, as it was raised

```text
---
id: s6-03-law-proofs-renamed-fixtures
prd: 2305
slice: s6
rank: high
bears-on: N-PRODUCT-16
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Four database checks that prove product rules, one of them the locked rule that the game's history is only ever added to, had their made-up names changed and now build their own workspace. Do they still prove what they proved before?

## The decision, in plain words

Only the names and the workspace they run in changed: every assertion about the rules is the same, and all four pass against a fresh database. The locked rule's check gained one proof, that a fresh install creates no workspace but the demo one.

## The intro, for fun

The witnesses changed their names, but they still saw the same thing.

## The punchline, for fun

Same testimony, new badges, and the history book still only grows.

## The options, in plain words

A. The renamed proofs stand as they are (built).
B. Restore a proof the reviewer finds weakened, inside the same fixture.

## What I had to decide

Whether the renamed proofs in supabase/checks/access.sql (N-PRODUCT-16), roadmaps.sql (BR-PRODUCT-81), agent_tokens.sql (BR-PRODUCT-110, BR-PRODUCT-111) and knowledge_graphs.sql (BR-PRODUCT-120) still prove their rules; the locked one needs an approving review from its owner on the feature pull request.

## What I did meanwhile

Each check includes supabase/checks/fixtures/initech.sql instead of reading the workspace the migrations used to seed; names follow PRD 2305's rule. access.sql's first block now proves a fresh install holds only the demo seed's nimbus workspace and no repository, where it used to check the seeded workspace's fleets and sectors.

## What it costs to change later

Reverting is a revert of this slice's check commit; no production data or schema is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The four checks were run against a local fresh database only; the supabase workflow on the pull request is the first CI run (author).

```

<!-- /omni-outbox-settled: s6-03-law-proofs-renamed-fixtures -->

<!-- omni-outbox-settled: s4-01-kit-law-proof-fixtures-renamed -->

## s4-01-kit-law-proof-fixtures-renamed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-21T13:58:46Z
- Channel: feature pull request #2307
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2307#issuecomment-6317920919
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-21
- Slice: s4
- Wave: 2
- Stays here: the lasting rule (fixtures use fictional names) is the open-source guard itself, scripts/open-source.ts; this answer only approves renamed law proofs

### The answer, as it was given

```text
A. A. Keep the fictional names in the six tests, as built.
```

### The item, as it was raised

```text
---
id: s4-01-kit-law-proof-fixtures-renamed
prd: 2305
slice: s4
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Six tests that prove the loop's rules used the maintainer's repository names in their sample data. Do you approve renaming that sample data to fictional names?

## The decision, in plain words

The sample names in those tests now read as made-up ones, and each test still checks the same rule with the same steps.

## The intro, for fun

Six tests changed their costumes but kept their jobs.

## The punchline, for fun

Please check the badge, not the outfit.

## The options, in plain words

A. A. Keep the fictional names in the six tests, as built.
B. B. Put the original names back in those six tests and exclude them from the guard.

## What I had to decide

Law-proof tests changed: kit/bin/roadmap.test.ts, kit/lib/config.test.ts, kit/lib/knowledge/check-knowledge.test.ts, kit/lib/policy/phase-0.test.ts, kit/lib/roadmap/grade.test.ts, kit/lib/roadmap/parse.test.ts. Only fixture names changed (the maintainer's repositories to demo-org/nimbus-*); no assertion was weakened. The owner of the laws they prove approves the feature PR.

## What I did meanwhile

The tests stay green with the new names and keep proving their laws.

## What it costs to change later

Undoing it means renaming the sample data back, a mechanical edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which law each of the six tests proves was read from the register, not re-judged (author)

```

<!-- /omni-outbox-settled: s4-01-kit-law-proof-fixtures-renamed -->

<!-- omni-outbox-settled: s2-01-s2-law-proof-fixtures-renamed -->

## s2-01-s2-law-proof-fixtures-renamed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-21T13:58:46Z
- Channel: feature pull request #2307
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2307#issuecomment-6317920919
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-21
- Slice: s2
- Wave: 2
- Stays here: the lasting rule (fixtures use fictional names) is the open-source guard itself, scripts/open-source.ts; this answer only approves renamed law proofs

### The answer, as it was given

```text
A. A. Keep the renamed tests, as built.
```

### The item, as it was raised

```text
---
id: s2-01-s2-law-proof-fixtures-renamed
prd: 2305
slice: s2
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Twenty-six arcade tests that prove locked rules had fictional names swapped in for the maintainer's real repository names and email domain. Is that rename fine to keep?

## The decision, in plain words

I renamed the sample repositories, organisation and email addresses inside those tests, and the assertions that read them, and changed nothing else about what they check.

## The intro, for fun

Twenty-six tests changed their name tags, and none of them changed their minds.

## The punchline, for fun

The rules still get the same checks, only the guests list now reads like a fiction.

## The options, in plain words

A. A. Keep the renamed tests, as built.
B. B. Revert those tests to the old names and leave them on the guard's baseline until a person renames them.

## What I had to decide

Approve the feature PR on GitHub as the law's owner once you have read the renamed tests; the rename is mechanical (a name or an address, never an expected value's meaning).

## What I did meanwhile

The tests are green with the new names and prove the same behaviour.

## What it costs to change later

A reviewer reads twenty-six test files whose only change is a name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which of the locked rules each renamed test proves was not traced one by one (author)

```

<!-- /omni-outbox-settled: s2-01-s2-law-proof-fixtures-renamed -->

<!-- omni-outbox-settled: s3-01-s3-law-proof-fixtures-renamed -->

## s3-01-s3-law-proof-fixtures-renamed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-21T13:58:46Z
- Channel: feature pull request #2307
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2307#issuecomment-6317920919
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-21
- Slice: s3
- Wave: 2
- Stays here: the lasting rule (fixtures use fictional names) is the open-source guard itself, scripts/open-source.ts; this answer only approves renamed law proofs

### The answer, as it was given

```text
A. A. Keep the renamed fixtures, as the PRD's rule says.
```

### The item, as it was raised

```text
---
id: s3-01-s3-law-proof-fixtures-renamed
prd: 2305
slice: s3
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Six tests that prove locked rules of the GitHub App now use the fictional example names in their fixtures. Do you approve the renamed proofs?

## The decision, in plain words

Only the fixture names changed in those tests; no assertion, rule or expected result was edited, and the whole GitHub App test run stays green.

## The intro, for fun

Six tests got a costume change, and they swear the plot stayed the same.

## The punchline, for fun

Please check that the actors still say their lines.

## The options, in plain words

A. A. Keep the renamed fixtures, as the PRD's rule says.
B. B. Keep the old fixture names in these six tests and list them as an exception, which the PRD ruled out.

## What I had to decide

Approve the renamed fixtures in the six law-proof test files, or ask for them to be renamed another way.

## What I did meanwhile

The renamed tests run in the full preflight and stay green; nothing else waits on this answer.

## What it costs to change later

A different answer costs a re-rename of fixture strings in six test files, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the law's owner wants fixture names in a law proof left untouched (author)

```

<!-- /omni-outbox-settled: s3-01-s3-law-proof-fixtures-renamed -->

<!-- omni-outbox-settled: s5-01-packages-law-proof-fixtures-renamed -->

## s5-01-packages-law-proof-fixtures-renamed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-21T13:58:46Z
- Channel: feature pull request #2307
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2307#issuecomment-6317920919
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-10-21
- Slice: s5
- Wave: 2
- Stays here: the lasting rule (fixtures use fictional names) is the open-source guard itself, scripts/open-source.ts; this answer only approves renamed law proofs

### The answer, as it was given

```text
A. A. Keep the fictional names in the four tests, as built.
```

### The item, as it was raised

```text
---
id: s5-01-packages-law-proof-fixtures-renamed
prd: 2305
slice: s5
rank: high
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Four tests in the game and the shared packages that prove the product's rules used the maintainer's repository names in their sample data. Do you approve renaming that sample data to fictional names?

## The decision, in plain words

The sample names in those tests now read as made-up ones, and each test still checks the same rule with the same steps.

## The intro, for fun

Four more tests swapped costumes and kept their jobs.

## The punchline, for fun

Same badge, new outfit.

## The options, in plain words

A. A. Keep the fictional names in the four tests, as built.
B. B. Put the original names back in those four tests and exclude them from the guard.

## What I had to decide

Law-proof tests changed: game/cli/scripts.test.ts, game/sources/parsers.test.ts, game/sources/supabase.test.ts, packages/design/src/mascots.test.ts. Only fixture names changed (the maintainer's repositories to demo-org/nimbus-*, a colleague's login to jane.doe); no assertion was weakened. The owner of the rules they prove approves the feature PR.

## What I did meanwhile

The tests stay green with the new names and keep proving their rules.

## What it costs to change later

Undoing it means renaming the sample data back, a mechanical edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which rule each of the four tests proves was read from the register, not re-judged (author)

```

<!-- /omni-outbox-settled: s5-01-packages-law-proof-fixtures-renamed -->

<!-- omni-outbox-settled: s7-01-s7-adr-names-renamed -->

## s7-01-s7-adr-names-renamed — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-21T14:37:28Z
- Channel: feature pull request #2307
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2307#issuecomment-6318708211
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0058
- Raised: 2026-10-21
- Slice: s7
- Wave: 2
- Stays here: the lasting rule (no maintainer names in tracked files) is the open-source guard itself; this answer only approves five renamed decision records

### The answer, as it was given

```text
A. A. Keep the renamed decision records, as built.
```

### The item, as it was raised

```text
---
id: s7-01-s7-adr-names-renamed
prd: 2305
slice: s7
rank: high
bears-on: ADR-0058
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Five decision records named the maintainer's real repositories when saying where an idea came from; they now name the fictional ones. Do you approve the renamed records?

## The decision, in plain words

Only the repository names in those five records changed; what each record decided is the same, and one of them now matches the real package name.

## The intro, for fun

Five old decisions got new name tags, and none of them changed its mind.

## The punchline, for fun

The history still says what was decided, just not where the idea was born.

## The options, in plain words

A. A. Keep the renamed decision records, as built.
B. B. Restore the original names in those five records and list them as an exception to the guard.

## What I had to decide

Approve the renamed names in decision records 0012, 0019, 0058, 0095 and 0116, or have them restored as an exception. Raised at the finish by the orchestrator: slice s7 renamed them without an item.

## What I did meanwhile

The records are renamed on the feature branch; the guard and every check are green.

## What it costs to change later

Restoring them is a mechanical edit of five records plus one allowlist entry each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a decision record should keep naming where its idea came from, even as a fictional name (author)

```

<!-- /omni-outbox-settled: s7-01-s7-adr-names-renamed -->
