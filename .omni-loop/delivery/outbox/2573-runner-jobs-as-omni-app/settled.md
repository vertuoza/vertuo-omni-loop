# Settled outbox items — PRD 2573

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-public-api-fake-runs-as-omni-app -->

## s1-01-public-api-fake-runs-as-omni-app — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-public-api-fake-runs-as-omni-app
prd: 2573
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

Once every job needs the Omni App's token, the test double of the public interface for API keys would fail every job it claims and its tests would hang. Should this slice fix that test file, though it lies outside the files it was given?

## The decision, in plain words

I changed one line of that test double so it hands the runner service the same pretend GitHub the runner tests use. No product code outside the slice changed.

## The intro, for fun

A test double kept running jobs the old way.

## The punchline, for fun

It now pretends to be the Omni App too, like everyone else.

## The options, in plain words

A. A. Keep the one-line change in the public interface's test double, which reuses the runner tests' pretend GitHub.
B. B. Give the public interface's test double a pretend GitHub of its own, in its own folder.
C. C. Move the change to a slice of its own whose territory holds the public-api fixtures.

## What I had to decide

Whether the public interface's test double may take the runner tests' pretend GitHub, a change outside the slice's territory.
Decided by: Jev (hardToRevert 0.70) · agent said false

## What I did meanwhile

apps/galaxy/src/public-api/fixtures/public-api.fake.ts passes stubGithub().deps to runnersService, so its claims are answered with the Omni App's grant; the 971 tests of public-api and rewind are green.

## What it costs to change later

A constant: one argument of one test fake. Undoing it means giving that fake its own GitHub stub instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant the public-api fixture to stay untouched, or simply did not foresee it.

```

<!-- /omni-outbox-settled: s1-01-public-api-fake-runs-as-omni-app -->

<!-- omni-outbox-settled: s1-02-key-last-token-label-stops -->

## s1-02-key-last-token-label-stops — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-key-last-token-label-stops
prd: 2573
slice: s1
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

An API key that holds its own GitHub App shows in Settings when that App last made a token for a job. Now that every job runs as the Omni App, should that date keep moving?

## The decision, in plain words

It stops moving: the key's own App makes no token any more, so its last date stays the last time it really did. The App, its form and its stored rows stay as they are.

## The intro, for fun

A date in Settings used to tick with every job.

## The punchline, for fun

Now it remembers the last time the key's App really worked.

## The options, in plain words

A. A. The key's last token date stops moving, since the key's App makes no token.
B. B. Keep moving it for every job the key sends, though the Omni App made the token.
C. C. Hide the key's App section in Settings until a later PRD decides its fate.

## What I had to decide

Whether the key's last token date in Settings should keep moving for jobs that now run as the Omni App.

## What I did meanwhile

The runner service no longer calls api_key_github_app_minted(): the key's last_token_at keeps its last value. The repository method stays, unused, with the rest of the key's App.

## What it costs to change later

A constant: one call in the service. Restoring it means calling the record again after each Omni App mint for a key's job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the person wants the label hidden or reworded while the key's App is unused; this slice leaves the Settings screen untouched.

```

<!-- /omni-outbox-settled: s1-02-key-last-token-label-stops -->

<!-- omni-outbox-settled: s3-01-runner-command-test-grants -->

## s3-01-runner-command-test-grants — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-28
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-28
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-runner-command-test-grants
prd: 2573
slice: s3
rank: medium
bears-on: none
raised: 2026-10-28
wave: 1
---

## The question, in plain words

The runner command's own tests also start jobs with no GitHub App, which the runner now refuses. Should this slice have fixed them, though they sit outside its listed files?

## The decision, in plain words

I gave the fake server in the runner command's tests an App grant for every job, and rewrote the two tests that expected a job with no App to run, so they now expect it to fail.

## The intro, for fun

A new bouncer at the door meant the old guest list had to change.

## The punchline, for fun

Every fake job now arrives with a badge, except the one meant to be turned away.

## The options, in plain words

A. A. Fix the command's tests in this slice (built).
B. B. Leave them red and widen the plan's territory in a follow-up slice.

## What I had to decide

The command's test file is outside the slice's territory, but the slice's change turns 32 of its tests red, so leaving it would fail the preflight. I changed only its fake server and the tests that assumed a job with no App runs.

## What I did meanwhile

Nothing changes for users; only tests are touched.

## What it costs to change later

A later slice that owns that file would merge on top of this edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant that file to be in this slice's territory (author)

```

<!-- /omni-outbox-settled: s3-01-runner-command-test-grants -->

<!-- omni-outbox-settled: s2-01-s2-fixtures-outside-territory -->

## s2-01-s2-fixtures-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-02
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-s2-fixtures-outside-territory
prd: 2573
slice: s2
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

Making a runner without the App claim nothing broke a few existing tests and the demo page's runners, which sit outside this slice's folders. Should I have left them for another slice?

## The decision, in plain words

I made the smallest fixes in files outside the slice's list so the suite stays green: the demo page's runners now register the App, the old-kit tests expect no job, and one registration test registers the App.

## The intro, for fun

One rule changed, and four tests noticed.

## The punchline, for fun

A small fix beside the territory beats a red suite.

## The options, in plain words

A. A. Keep the small fixes in this sub-PR, as built.
B. B. Move them to a slice of their own, and leave the suite red until it merges.
C. C. Make the demo runners and tests register the App in the territory of wave 1's slice instead.

## What I had to decide

Edited apps/galaxy/src/runners/page/demo.ts, runners.github-app.test.ts and runners.service.test.ts (one registration gets githubApp: true); the store fake's default runner now registers the App.

## What I did meanwhile

Each edit only adapts a runner to the new rule that a runner without the App claims nothing; no assertion was weakened.

## What it costs to change later

A few lines per file, easy to move into another slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the owner would rather have these fixtures in an earlier slice.

```

<!-- /omni-outbox-settled: s2-01-s2-fixtures-outside-territory -->

<!-- omni-outbox-settled: s1-03-br-access-1-proof-as-omni-app -->

## s1-03-br-access-1-proof-as-omni-app — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-02T09:57:06Z
- Channel: feature pull request #2574
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2574#issuecomment-6574220097
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-ACCESS-1
- Raised: 2026-10-28
- Slice: s1
- Wave: 1
- Stays here: The answer leaves BR-ACCESS-1's new wording to its owner, @nicojustdev, in their own words; no agent rewrites a person's rule.

### The answer, as it was given

```text
A. A. Keep the amended proof, and let the owner reword the rule to name the Omni App.
```

### The item, as it was raised

```text
---
id: s1-03-br-access-1-proof-as-omni-app
prd: 2573
slice: s1
rank: high
bears-on: BR-ACCESS-1
raised: 2026-10-28
wave: 1
---

## The question, in plain words

The rule on which repositories a key's job token may reach says the job runs as the key's own GitHub App, and that is no longer true: every job now runs as the Omni App. Should its proof follow the Omni App, with the rule's wording updated by its owner, @nicojustdev?

## The decision, in plain words

The token still reaches only the repositories the key may reach, so the rule's substance holds. I kept every check of that limit, dropped two that only made sense for the key's App, and added checks for jobs sent from the page; the rule's own words are left for its owner.

## The intro, for fun

A rule still names the old App in its first line.

## The punchline, for fun

Same fence, new gatekeeper: the owner picks the new words.

## The options, in plain words

A. A. Keep the amended proof, and let the owner reword the rule to name the Omni App.
B. B. Keep the amended proof and the rule's words as they are, the rule read as about the key's limit only.
C. C. Split the rule in two: one for a key's job, one for a job sent from the page.

## What I had to decide

Whether BR-ACCESS-1's proof may follow the Omni App, and how its owner rewords the rule. A suggested rewording, for the owner to adopt in their own words: When a job an API key sends runs on a runner, its Omni App token reaches only repositories the key may reach: the job's repository and, for a mega bug fix, the other repositories its product names, each only when it is in the key's allowed repositories and the App's installation holds it.
Decided by: Jev (hardToRevert 0.46) · agent said true

## What I did meanwhile

apps/galaxy/src/runners/runners.github-repositories.test.ts keeps every allow-list case (the job's own repository outside the list fails, the product's repositories are cut to the list, at a claim and at a refresh); it no longer checks that the key's sealed key was not opened or that the key's mint was recorded, since neither happens now; it gains page-sent mega bug fix cases and the product-repositories read.

## What it costs to change later

A constant: the proof's assertions. Going back means restoring PRD 2433's key-App path, which this PRD removes on purpose.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether @nicojustdev wants the rule to also say how far a job sent from the page reaches, which has no key and so no allow-list.

```

<!-- /omni-outbox-settled: s1-03-br-access-1-proof-as-omni-app -->
