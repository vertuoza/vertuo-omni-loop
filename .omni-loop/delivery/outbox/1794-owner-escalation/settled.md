# Settled outbox items — PRD 1794

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-delegate-entry-shape -->

## s1-01-delegate-entry-shape — adopted

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
id: s1-01-delegate-entry-shape
prd: 1794
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

When an owner gets a stand-in, may that owner be a team, and must every entry with a stand-in spell out both names?

## The decision, in plain words

An owner with a stand-in must be one person, and both names are required; a team stays a plain owner with no stand-in. The settings are read back exactly as written.

## The intro, for fun

A team asking for a stand-in is like a choir asking for an understudy.

## The punchline, for fun

One person, one stand-in, both names on the card.

## The options, in plain words

A. A. An owner with a stand-in is one person's login; both names are required; a team stays a plain owner.
B. B. Also allow a team as the owner of an entry with a stand-in.

## What I had to decide

Answer A to keep it, or B to allow a team owner with a person as its stand-in.

## What I did meanwhile

A team can still own the laws as a plain entry; it just cannot name a stand-in.

## What it costs to change later

Allowing it later is a one-line change to the settings check; nobody's settings break either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the key `login` but does not say whether a team may hold it (author).

```

<!-- /omni-outbox-settled: s1-01-delegate-entry-shape -->

<!-- omni-outbox-settled: s5-01-escalation-record-read -->

## s5-01-escalation-record-read — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s5
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-escalation-record-read
prd: 1794
slice: s5
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

To learn who is asked about a waiting question, the Omni page reads the note the GitHub App keeps on the feature pull request. Should it read that note on its own, or as part of the pull request summary it already reads?

## The decision, in plain words

The page reads the note on its own, one extra GitHub read per open feature pull request each time it recounts. When that read fails, the page keeps what it showed before, as it already does when the summary cannot be read.

## The intro, for fun

Two readers knock on the same pull request door, a few seconds apart.

## The punchline, for fun

One could carry both letters, but the second one stays within its own fence.

## The options, in plain words

A. A. A read of its own, inside the slice's territory: one more background GitHub call per open feature PR per recount; the stored dossier snapshot is unchanged.
B. B. Read the record from the comments the dossier's GitHub summary already fetches: no extra call, but the summary and its stored snapshot gain a field, outside this slice's territory.

## What I had to decide

Whether the record keeps its own read in apps/galaxy/src/stages/sync/github.ts (escalationReader), or moves into the dossier's GitHub summary (apps/galaxy/src/dossier/github/reader.ts, summary.ts, and the snapshot schema), which already lists the feature PR's comments.

## What I did meanwhile

Each recount of a PRD at building or outbox with an open feature PR makes one more background GitHub read (the PR's first 100 comments), on the installation's budget. A PRD with no open feature PR costs nothing more. A failed record read keeps the PRD's stored counts until the next recount.

## What it costs to change later

Moving the read into the summary later is a few lines in four files outside this slice and an optional field in the stored snapshot: no migration, and the stored asked field stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many open feature PRs a busy workspace holds at once, and so what the extra read costs on its budget, is not measured (author).

```

<!-- /omni-outbox-settled: s5-01-escalation-record-read -->

<!-- omni-outbox-settled: s3-01-record-keeps-the-sweeps-step -->

## s3-01-record-keeps-the-sweeps-step — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-record-keeps-the-sweeps-step
prd: 1794
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When the check rewrites the waiting list on a pull request, should it work out each thing's step itself from the clock, or keep the step the hourly reminder last reached?

## The decision, in plain words

The check only adds new waiting things and drops answered ones; it keeps each existing line exactly as the hourly reminder left it, so the list never claims more people were asked than were really told.

## The intro, for fun

Two clocks on one wall never agree for long.

## The punchline, for fun

So only one of them is allowed to move the hands.

## The options, in plain words

A. The check keeps each listed thing's step as the hourly reminder left it, and only adds or drops things.
B. Every check run works out each thing's step from the clock and rewrites it, and the hourly reminder only posts what is not yet posted.

## What I had to decide

Answer A to keep the step owned by the hourly reminder alone, or B to let every check run move the step from the clock.

## What I did meanwhile

A thing seen for the first time starts at step 0 with nobody new asked; a thing already listed keeps its first-held time, step, people asked and next due time until the hourly reminder moves it.

## What it costs to change later

Changing it later is a few lines in the record keeper; no stored shape changes, and the comment's text stays the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the sweep moves each due thing and the record keeps first-held time, but not whether the check may also move a step (author).

```

<!-- /omni-outbox-settled: s3-01-record-keeps-the-sweeps-step -->

<!-- omni-outbox-settled: s4-01-route-test-lists-the-sweep -->

## s4-01-route-test-lists-the-sweep — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-15
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-route-test-lists-the-sweep
prd: 1794
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

Serving the new hourly reminder means the test that lists every background job of the app has to name it too, and that test sits outside the files this step was given. May it be updated here?

## The decision, in plain words

I updated that one test so it expects the new reminder job beside the others, and changed nothing else outside this step's files.

## The intro, for fun

A new job joined the roster, and the roll call had to learn its name.

## The punchline, for fun

One more name on the list, nothing else moved.

## The options, in plain words

A. A. Keep the route test updated in this step, so the new job is served and checked together.
B. B. Leave the route test to a separate change, and accept a red test until it lands.

## What I had to decide

Answer A to keep the test as updated here, or B to move that change into a follow-up of its own.

## What I did meanwhile

The test now expects eleven jobs instead of ten; every other line of it is unchanged.

## What it costs to change later

Moving the change elsewhere later is a copy of a few lines; nothing is stored and nothing a person sees changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's file list for this step names the job list's own test file but not the route test that also counts the jobs.

```

<!-- /omni-outbox-settled: s4-01-route-test-lists-the-sweep -->

<!-- omni-outbox-settled: s1-02-name-delegate-and-leadership -->

## s1-02-name-delegate-and-leadership — drifted

- Verdict: drifted
- Approved by: pierrederval
- Approved at: 2026-10-16T06:42:17Z
- Channel: feature pull request #1983
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1983#issuecomment-6209727495
- Basis: contradiction-marker — the answer says "no", which reads as a change to the recorded choice
- Closed: no — the build and the decision disagree until a rework sub-PR brings them back in line (/omni:yolo-fix)
- Rank: human-action
- Bears on: none
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Stays here: who leads this repository is configuration, not a product rule: laws.leadership in .omni-loop/config.yml and the CODEOWNERS block omni kb owners writes now hold it.

### The answer, as it was given

```text
ok, with this answer: for omni-loop, product leadership is me. Set `laws.leadership: [pierrederval]` in `.omni-loop/config.yml`, and name no delegate (`laws.owners` stays `pierrederval` with no `delegate`), then run `omni kb owners`.
```

### The item, as it was raised

```text
---
id: s1-02-name-delegate-and-leadership
prd: 1794
slice: s1
rank: human-action
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

Who stands in for @pierrederval when he does not answer about a law or an open question, and who is product leadership for this repository?

## The decision, in plain words

Nobody is named yet: the setting can now hold a stand-in and a leadership list, but only @pierrederval can say who they are, so this repository's settings were left as they are.

## The intro, for fun

Even the keeper of the laws takes a holiday now and then.

## The punchline, for fun

Until someone is named, the pull request just waits by the door.

## What a person must do

1. Choose one person who may approve a change to a law in your place, and the people who are product leadership.
2. In a pull request of your own, write laws.owners in .omni-loop/config.yml as `- login: pierrederval` with `delegate: <their login>`, and laws.leadership as `[<login>, ...]`.
3. Run `node .omni-loop/bin/omni.mjs kb owners` and commit the CODEOWNERS change with it.
4. Answer this item on the feature PR once that pull request is open.

## What I had to decide

@pierrederval names one delegate (a person's GitHub login) and the product leadership logins, then opens a pull request that adds them to laws.owners and laws.leadership in .omni-loop/config.yml and runs omni kb owners.

## What I did meanwhile

The repository behaves exactly as before: with no delegate and no leadership, nobody more is ever asked, and a law change still waits on @pierrederval alone.

## What it costs to change later

One small pull request: two lines of config and the CODEOWNERS block omni kb owners rewrites.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Who the delegate and the leaders are is @pierrederval's to say (author).

```

<!-- /omni-outbox-settled: s1-02-name-delegate-and-leadership -->

<!-- omni-outbox-settled: s1-03-config-proof-file-gains-tests -->

## s1-03-config-proof-file-gains-tests — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-16T06:42:17Z
- Channel: feature pull request #1983
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1983#issuecomment-6209727495
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-23
- Raised: 2026-10-15
- Slice: s1
- Wave: 1
- Stays here: the testing form already lets a proof file gain tests of other behaviour; the answer keeps what was built and changes no rule.

### The answer, as it was given

```text
A. A. Keep the new settings' tests in the settings test file, beside the unchanged signature checks.
```

### The item, as it was raised

```text
---
id: s1-03-config-proof-file-gains-tests
prd: 1794
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The test file that proves the settings refuse a bad signature also gained the tests of the new stand-in and leadership settings. Is that acceptable, with the signature checks themselves left exactly as they were?

## The decision, in plain words

The new settings are tested in the same file as every other setting, beside the signature checks, which were not changed. The testing rules allow a proof file to gain tests of other behaviour this way.

## The intro, for fun

The settings' test file got a few new roommates.

## The punchline, for fun

The old tenant, the signature check, kept its room exactly as it was.

## The options, in plain words

A. A. Keep the new settings' tests in the settings test file, beside the unchanged signature checks.
B. B. Move the new tests into a test file of their own, so the proof file is left untouched.

## What I had to decide

Answer A to keep the new tests where they are, or B to move them into a test file of their own.

## What I did meanwhile

The signature rule is proven by the same checks as before; only tests of other settings were added beside them.

## What it costs to change later

Moving the new tests to their own file later is a cut and paste, with no change to any code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The coverage guard counts any change to a proof file as a change to the rule, so it asks for this item (author).

```

<!-- /omni-outbox-settled: s1-03-config-proof-file-gains-tests -->
