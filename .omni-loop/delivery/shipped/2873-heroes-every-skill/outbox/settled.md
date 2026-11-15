# Settled outbox items — PRD 2873

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-02-ultra-refusal-words -->

## s1-02-ultra-refusal-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1
- Became: BR-ACCESS-9, P-ACCESS-6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-ultra-refusal-words
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

What should the Runners page say when someone sends a multi-repository build from a repository that has no plan repository to point to?

## The decision, in plain words

It says the build runs from a product's plan repository and that this repository is no product's plan repository. When the repository's product has a plan repository, it names it instead, and names each one when several products hold the repository.

## The intro, for fun

Sometimes there is no plan repository to send the person to.

## The punchline, for fun

No map, so the sign just says you are not at the harbour.

## The options, in plain words

A. A. Say the repository is no product's plan repository, and name every plan repository of the products that hold it (built).
B. B. Also tell the person where to set a product's plan repository, in Products › Repositories.
C. C. Name only the first plan repository when several products hold the repository.

## What I had to decide

The spec gives the words when the product has a plan repository (send it from that repository) but not when it has none, or when the repository is in no product, or in several products with different plan repositories. I also had to pick how the refusal is classed: I classed it with the other refused lines (a 400), as a repository's own skill it does not allow is.

## What I did meanwhile

Built the three cases: one plan repository named, several named with 'or' in name order, or the line saying the repository is no product's plan repository. Nothing is queued in any of them, from the page or from an API key.

## What it costs to change later

A constant: the words are one function in the service, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec gives the words for a product with a plan repository; the other cases follow them.

```

<!-- /omni-outbox-settled: s1-02-ultra-refusal-words -->

<!-- omni-outbox-settled: s1-03-fixed-names-kept-rows -->

## s1-03-fixed-names-kept-rows — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1
- Stays here: A one-off migration choice about leftover rows; a later migration can delete them in one statement, so nothing lasting needs keeping.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-fixed-names-kept-rows
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Should a repository's own runner skill that an owner allowed under a name the loop now uses for itself be removed?

## The decision, in plain words

No: such an allowance stays stored as it is. It can never run, since a line naming one of the loop's own skills without its prefix is refused on the server and on the runner.

## The intro, for fun

Seven names joined the loop's own list, and someone may have used one first.

## The punchline, for fun

The old key stays on the hook; it just opens nothing now.

## The options, in plain words

A. A. Keep the rows; they never run (built).
B. B. Delete them in the migration.

## What I had to decide

The database's list of the loop's own skills grew by seven names. A repository could have allowed a skill of its own under one of them before. The spec does not say whether those allowances are removed.

## What I did meanwhile

The migration changes the list and no row. Such a row can no longer be switched off from Settings, which refuses a name of the loop's own, so it stays until a migration removes it.

## What it costs to change later

A constant: a later migration could delete those rows in one statement.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any workspace holds such a row today (author): I could not read the production database from here.

```

<!-- /omni-outbox-settled: s1-03-fixed-names-kept-rows -->

<!-- omni-outbox-settled: s1-04-skills-proof-later-names -->

## s1-04-skills-proof-later-names — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-PRODUCT-140
- Raised: 2026-11-14
- Slice: s1
- Wave: 1
- Became: N-PRODUCT-21

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-skills-proof-later-names
prd: 2873
slice: s1
rank: medium
bears-on: BR-PRODUCT-140
raised: 2026-11-14
wave: 1
---

## The question, in plain words

May the test that proves a repository's own runner skills never take one of the loop's own names leave out the three new names, as it already leaves out the four added after it?

## The decision, in plain words

Yes: that test reads the first version of the database's list, which never held the new names, so it now leaves them out the way it leaves out the four added later. A new test holds the database's newest list equal to the app's whole list, the new names included.

## The intro, for fun

An old test checks an old list, and the list just grew again.

## The punchline, for fun

The first page of the guest book stays as it was signed.

## The options, in plain words

A. A. Leave the three new names out of the old test too, and check the newest list in a new test (built).
B. B. Rewrite the old test to read the newest migration itself, replacing the new test.

## What I had to decide

The test of the first migration that made the database's list compares it with the app's list minus the skills added later. Runners now take three more skills, so without a change it fails, though nothing it guards changed. The file is one of the proofs of a proposed rule, so a change to it is a person's to answer.

Decided by: Jev (hardToRevert 0.64) · agent said true

## What I did meanwhile

Added the three ultra skills to the names that test leaves out, with a comment naming the migration that adds them. The new test in its own file checks the newest list whole, so the database's list cannot fall behind the app's again unseen.

## What it costs to change later

A constant: one list in a test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the rule's text is unchanged, and so is every other check of that test.

```

<!-- /omni-outbox-settled: s1-04-skills-proof-later-names -->

<!-- omni-outbox-settled: s1-05-guide-runner-lines -->

## s1-05-guide-runner-lines — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s1
- Wave: 1
- Stays here: A one-off coordination choice between two slices of one wave over a guide sentence; nothing lasting to keep beyond the existing docs test.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-guide-runner-lines
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

May this part of the work add the three new skills to the guide's list of what a runner takes, though the guide belongs to another part of the same feature?

## The decision, in plain words

Yes: the guide's one sentence listing what a runner takes now names the three new skills too. A test holds that sentence equal to the runner's own list, so without it this part could not go green.

## The intro, for fun

The guide keeps a list, and a test checks it word for word.

## The punchline, for fun

Three new names on the door, before the sign painter arrives.

## The options, in plain words

A. A. Add the three skills to the guide's sentence here, so this part is green on its own (built).
B. B. Leave the guide to slice s2 and let this part stay red until both are merged.

## What I had to decide

The plan gives the guide to slice s2, which says runners take the ultra skills. A test of the arcade's docs holds the guide's sentence on the Runners page equal to the runner's list of skills, so adding the skills to that list here turned the preflight red. Both slices run in the same wave.

## What I did meanwhile

Added the three skills at the end of that one sentence in docs/guide/runners.md, and changed nothing else of the guide. Slice s2 may write the same sentence: the wave meets the two when it merges them.

## What it costs to change later

A constant: one sentence of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether slice s2 rewrites that sentence its own way (author): the two slices run at the same time.

```

<!-- /omni-outbox-settled: s1-05-guide-runner-lines -->

<!-- omni-outbox-settled: s3-01-reviewer-limit -->

## s3-01-reviewer-limit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s3
- Wave: 2
- Stays here: This is the wording of one hero limit, a copy choice cheap to change, and it adds no lasting product guarantee beyond what the spec already asks.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-reviewer-limit
prd: 2873
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

Now that the Reviewer lists a review skill, what should its third limit say in place of the old line that it has no skill to run yet?

## The decision, in plain words

A new Reviewer starts with the line that it never approves a pull request, the same shape as the PM and the Architect. Reviewers made before keep the limits they have, as the spec asks.

## The intro, for fun

The Reviewer finally got a skill, so its old excuse no longer holds.

## The punchline, for fun

It can look at your pull request, but the approval stays yours.

## The options, in plain words

A. Never approves a pull request, as the PM never approves a PRD (built).
B. Keep the old line that it has no skill to run yet.
C. Drop the third limit: the Reviewer keeps only the two every hero has.

## What I had to decide

Keep the new line, or pick other words for the Reviewer's third limit; reviewers already made keep theirs either way.

## What I did meanwhile

Built A: kit/lib/virtual-fleet/roles.ts and virtual_hero_roles() in the s3 migration give a new Reviewer `It never approves a pull request.`; the migration leaves every stored hero's limits as they are.

## What it costs to change later

A constant: one sentence in roles.ts and in the migration's list, which a test holds equal. Stored heroes are not touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the Designer's limits but not the Reviewer's; the old line `It has no skill to run yet.` became untrue once the Reviewer lists tech-review.

```

<!-- /omni-outbox-settled: s3-01-reviewer-limit -->

<!-- omni-outbox-settled: s3-02-fleet-render-test -->

## s3-02-fleet-render-test — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s3
- Wave: 2
- Stays here: A one-off choice about which test file to touch during this slice; it sets no lasting product rule or build decision worth recording.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-fleet-render-test
prd: 2873
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

May this slice change a test of the Fleet page that sits outside its ground, when that test still expects the old words on the Heroes tab?

## The decision, in plain words

Yes, the least it takes: two of that test's checks now expect the count line, each skill's mark and the sixth role. The new checks of every role's skills sit in a test file of the slice's own.

## The intro, for fun

An old test was still waiting for words this PRD retires.

## The punchline, for fun

It got two lines of news and kept everything else it knew.

## The options, in plain words

A. Edit the two checks in place (built).
B. Move every Heroes tab check from the Fleet page's test into the slice's own test file.

## What I had to decide

Keep the two edited checks, or move the Heroes tab's checks out of the Fleet page's test into the slice's own file.

## What I did meanwhile

Built A: apps/galaxy/src/dashboard/fleet/heroes.render.test.ts has two checks updated (the Engineer and PM lines, and the roles that fill a fleet); apps/galaxy/src/virtual-fleets/heroes/heroes.render.test.ts holds the new checks.

## What it costs to change later

A constant: two test lines, no product code outside the slice's ground.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s3 names apps/galaxy/src/virtual-fleets/ but not the Fleet page's test of the Heroes tab, which would fail otherwise.

```

<!-- /omni-outbox-settled: s3-02-fleet-render-test -->

<!-- omni-outbox-settled: s3-03-count-line-one-skill -->

## s3-03-count-line-one-skill — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-14
- Slice: s3
- Wave: 2
- Stays here: This is a wording choice about exact copy, a matter of look and taste; no role lists a single skill today, so it stays in the ledger.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-count-line-one-skill
prd: 2873
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

When a hero lists a single skill and it runs alone, should its count line say one skill or one skills?

## The decision, in plain words

It says skill for one and skills for more, so it reads as plain English. No role lists a single skill today, so every hero on screen reads as the spec writes it.

## The intro, for fun

A hero with one skill would have read like a typo.

## The punchline, for fun

One skill, one word, no extra letter.

## The options, in plain words

A. Skill for one, skills for more (built).
B. Always skills, as the spec's pattern reads.

## What I had to decide

Keep the singular for one skill, or always write skills as the spec's pattern does.

## What I did meanwhile

Built A: roleLine() in kit/lib/virtual-fleet/roles.ts writes `Runs 1 of 1 skill alone` for a hero that lists one skill, and `Runs <k> of <n> skills alone` otherwise.

## What it costs to change later

A constant: one condition in roleLine() and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec writes the line as `Runs <k> of <n> skills alone` and gives no case of a single skill.

```

<!-- /omni-outbox-settled: s3-03-count-line-one-skill -->

<!-- omni-outbox-settled: s3-04-virtual-fleet-proofs -->

## s3-04-virtual-fleet-proofs — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-14
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: BR-GAME-2
- Raised: 2026-11-14
- Slice: s3
- Wave: 2
- Became: BR-GAME-3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-virtual-fleet-proofs
prd: 2873
slice: s3
rank: medium
bears-on: BR-GAME-2
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The checks that prove three rules of virtual fleets had to follow the sixth role: is it right that they now count six heroes and name the Designer, with every rule still checked as before?

## The decision, in plain words

Yes: the checks now make a fleet of six heroes, expect the Engineer's full list of skills and use a made-up role where they used the Designer as the unknown one. What each rule asks is checked exactly as before.

## The intro, for fun

The rules about virtual fleets did not change, but the fleets got one more seat.

## The punchline, for fun

Same referee, same rules, one more player on the bench.

## The options, in plain words

A. Keep the checks as updated for six roles (built).
B. Leave the Designer out of the checks and keep the old counts, proving the sixth role elsewhere.

## What I had to decide

Approve the updated checks, or ask for the old counts back with the Designer left out of the checks.

## What I did meanwhile

Built A: supabase/checks/virtual_fleets.sql (BR-GAME-1, BR-GAME-2, BR-GAME-3) and apps/galaxy/src/virtual-fleets/virtual-fleets.controller.test.ts (BR-GAME-2) follow the six roles; the name, cap, owner-only, one-hero-per-role, last-hero and no-player checks are unchanged. The check also runs the s3 migration again and proves the rewrite of stored heroes.

## What it costs to change later

A constant: the counts and role lists in two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The three rules are proposed, not locked; the coverage guard still names their proofs as a law change, which only a person's answer clears.

```

<!-- /omni-outbox-settled: s3-04-virtual-fleet-proofs -->

<!-- omni-outbox-settled: s1-01-plan-product-reach -->

## s1-01-plan-product-reach — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T06:48:34Z
- Channel: feature pull request #2876
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2876#issuecomment-6890579854
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-63
- Raised: 2026-11-14
- Slice: s1
- Wave: 1
- Became: BR-ACCESS-8

### The answer, as it was given

```text
A. A. Reach the products that list the repository and those whose plan repository it is (built).
```

### The item, as it was raised

```text
---
id: s1-01-plan-product-reach
prd: 2873
slice: s1
rank: high
bears-on: BR-PRODUCT-63
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Should a build sent from a product's plan repository reach that product's repositories even when the product does not list the plan repository among its own?

## The decision, in plain words

Yes: the build reaches the repositories of every product that names it as its plan repository, as well as those of the products that list it. It still reaches only repositories of the same workspace, that the key allows and that the Omni App is installed on.

## The intro, for fun

A plan repository can lead a product without being one of its listed repositories.

## The punchline, for fun

The captain gets the keys to the ship, even if not on the crew list.

## The options, in plain words

A. A. Reach the products that list the repository and those whose plan repository it is (built).
B. B. Reach only the products that list the repository, as a mega bug fix did: an owner must list the plan repository in its product.
C. C. Like A, but for the ultra skills only, leaving the mega bug fix as it was.

## What I had to decide

The spec says an ultra job's token covers the product's repositories, the way a mega bug fix's does. A mega bug fix finds its product by the product's list of repositories only. A product names its plan repository in a field of its own, and nothing makes it list that repository too, so an ultra job from such a plan repository would get a token for itself alone and stop at its first clone. I added the products whose plan repository is the job's repository to what the token reaches, for every skill that spans the product, the mega bug fix included.

## What I did meanwhile

Built it: the token covers the repositories of the products that list the job's repository and of those whose plan repository it is, once each, within the key's allow-list, and only those the App's installation holds. A test covers a plan repository its product does not list, an archived product and a product whose plan repository is another.

## What it costs to change later

A constant: dropping the second source is one line in the service and its tests. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether every plan repository in use today is also listed in its product (author): I could not read the production database from here.

```

<!-- /omni-outbox-settled: s1-01-plan-product-reach -->

<!-- omni-outbox-settled: s1-06-plan-reach-becomes-rule -->

## s1-06-plan-reach-becomes-rule — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T08:22:41Z
- Channel: feature pull request #2876
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2876#issuecomment-6891634340
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-ACCESS-8
- Raised: 2026-11-15
- Slice: s1
- Wave: 3
- Became: BR-ACCESS-8

### The answer, as it was given

```text
A. A. Keep the new rule as written (built).
```

### The item, as it was raised

```text
---
id: s1-06-plan-reach-becomes-rule
prd: 2873
slice: s1
rank: high
bears-on: BR-ACCESS-8
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Should your answer to question 1 become a written rule of the product: a build sent from a product's plan repository reaches that product's repositories, even when the product does not list the plan repository among its own?

## The decision, in plain words

Yes: your answer is written down as a rule of the access area, proved by the two runner tests that check what a build's token reaches.

## The intro, for fun

An answer given once now has a home of its own.

## The punchline, for fun

It moved from a comment into the rule book.

## The options, in plain words

A. A. Keep the new rule as written (built).
B. B. Drop the rule and keep the answer in the settled ledger only.

## What I had to decide

The settle step writes an agreed answer back as knowledge; s1-01's answer became the new rule BR-ACCESS-8 in .omni-loop/knowledge/domains/access/rules.md, enforced by apps/galaxy/src/runners/runners.github-repositories.test.ts and apps/galaxy/src/runners/runners.ultra.test.ts.

## What I did meanwhile

The rule is in the access register on the feature branch, and its two tests are green.

## What it costs to change later

Removing the rule is one paragraph in the register; the code keeps working as built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether every agreed answer should become a rule, or only some (author)

```

<!-- /omni-outbox-settled: s1-06-plan-reach-becomes-rule -->

<!-- omni-outbox-settled: s1-07-runner-skills-proof-follows -->

## s1-07-runner-skills-proof-follows — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T08:22:41Z
- Channel: feature pull request #2876
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2876#issuecomment-6891634340
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-140
- Raised: 2026-11-15
- Slice: s1
- Wave: 3
- Stays here: it confirms an edit to a proof; the rule it proves is unchanged

### The answer, as it was given

```text
A. A. Keep the test as changed (built).
```

### The item, as it was raised

```text
---
id: s1-07-runner-skills-proof-follows
prd: 2873
slice: s1
rank: high
bears-on: BR-PRODUCT-140
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Is it right that the test proving which skills a repository's Runner skills block lists was changed, so it also names the three new ultra skills runners now take?

## The decision, in plain words

Yes: the test now reads the database's fixed list with the three ultra skills and the four it lacked; the rule it proves is unchanged.

## The intro, for fun

A list grew by seven, and its referee had to learn the new names.

## The punchline, for fun

The rule stayed put; only its roll call got longer.

## The options, in plain words

A. A. Keep the test as changed (built).
B. B. Restore the old test and prove the new list in a test of its own.

## What I had to decide

s1 replaced the database's fixed runner-skill list (migration 20270122120000_runner_ultra_skills.sql) and edited apps/galaxy/src/runners/runners.skills.migration.test.ts, which proves BR-PRODUCT-140, so it reads the new list. Item s1-04 recorded it as medium.

## What I did meanwhile

The test is green on the feature branch, and every check it held before is still checked.

## What it costs to change later

Reverting the test edit means reverting the migration with it; nothing else depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants the proof kept apart from the new list's own test (author)

```

<!-- /omni-outbox-settled: s1-07-runner-skills-proof-follows -->

<!-- omni-outbox-settled: s3-05-fleet-rules-proofs-follow -->

## s3-05-fleet-rules-proofs-follow — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-11-15T08:22:41Z
- Channel: feature pull request #2876
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2876#issuecomment-6891634340
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-GAME-1
- Raised: 2026-11-15
- Slice: s3
- Wave: 3
- Stays here: it confirms an edit to three proofs; the rules they prove are unchanged

### The answer, as it was given

```text
A. A. Keep the tests as changed (built).
```

### The item, as it was raised

```text
---
id: s3-05-fleet-rules-proofs-follow
prd: 2873
slice: s3
rank: high
bears-on: BR-GAME-1
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Is it right that the tests proving three fleet rules (what a new fleet's key is, what its mascot may be, and how many fleets a workspace keeps) were changed to count six heroes instead of five?

## The decision, in plain words

Yes: the tests now expect six roles, the Designer among them; every rule they prove is checked as before.

## The intro, for fun

A sixth hero walked in, and the head count had to be redone.

## The punchline, for fun

Same rules, one more chair at the table.

## The options, in plain words

A. A. Keep the tests as changed (built).
B. B. Move the role count out of these proofs into a test of its own.

## What I had to decide

s3 added the Designer role, so supabase/checks/virtual_fleets.sql and apps/galaxy/src/virtual-fleets/virtual-fleets.controller.test.ts, which prove BR-GAME-1, BR-GAME-2 and BR-GAME-3, now count six roles and name them. Item s3-04 recorded it as medium.

## What I did meanwhile

Both proofs are green on the feature branch, on a local database with every migration applied.

## What it costs to change later

Reverting means going back to five roles across the migration, the kit and the screens.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the role count belongs in the fleet rules' proofs at all (author)

```

<!-- /omni-outbox-settled: s3-05-fleet-rules-proofs-follow -->
