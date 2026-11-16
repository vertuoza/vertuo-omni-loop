# Settled outbox items — PRD 2915

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-guide-paraphrases-key-whys -->

## s3-01-guide-paraphrases-key-whys — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-11-15
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-11-15
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-guide-paraphrases-key-whys
prd: 2915
slice: s3
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

Is it right that the user guide paraphrases two of the reasons a job of a key's App fails with, instead of quoting them word for word, because the guide's own check refuses the word "private" on every page?

## The decision, in plain words

Yes: the API guide says the server has no key to open the App's key, or that the App's key could not be opened, while the code keeps the spec's exact words, which say "private key". The guide's check (PRD 459) refuses "private" on every page, so that no page ever asks for read access to a private repository.

## The intro, for fun

The guide was told never to whisper a certain word, so it learned a synonym.

## The punchline, for fun

The server still says it in full; the guide just mumbles the middle.

## The options, in plain words

A. Keep the paraphrase (built).
B. Narrow the guide check to private repositories, and quote the two reasons word for word.

## What I had to decide

Answer A to keep the paraphrase. Answer B to let the guide quote the two reasons word for word: the guide check's pattern is narrowed so it refuses a private repository, not a private key, and the two rows quote the code.
Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

The guide paraphrases the two reasons; every other reason is quoted as the code writes it.

## What it costs to change later

Small: two table rows and one line of a test, no data to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the guide check's ban on "private" is meant for every use of the word, or only for asking for access to a private repository, is not written anywhere: PRD 459's test is the only record.

```

<!-- /omni-outbox-settled: s3-01-guide-paraphrases-key-whys -->

<!-- omni-outbox-settled: s1-01-key-app-proofs-follow -->

## s1-01-key-app-proofs-follow — agreed

- Verdict: agreed
- Approved by: nicojustdev
- Approved at: 2026-11-15T21:55:26Z
- Channel: feature pull request #2916
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2916#issuecomment-6901991878
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-ACCESS-8
- Raised: 2026-11-15
- Slice: s1
- Wave: 1
- Stays here: the person kept the tests as changed and BR-ACCESS-8's words as they are, so nothing new is written to the knowledge

### The answer, as it was given

```text
A. A. Keep the tests as changed (built).
```

### The item, as it was raised

```text
---
id: s1-01-key-app-proofs-follow
prd: 2915
slice: s1
rank: high
bears-on: BR-ACCESS-8
raised: 2026-11-15
wave: 1
---

## The question, in plain words

Is it right that two tests that prove how a runner's GitHub token is made were changed, so a job of an API key that holds its own GitHub App is proven to run as that App, and a job of a key with no App as the Omni App?

## The decision, in plain words

Yes: the tests now say whose App mints the token and whose bot signs, and how far the token reaches is unchanged. The rule's wording still names the Omni App's installation, which for a key that holds an App is now the key's App's installation.

## The intro, for fun

Two referees learned that a job can now wear its sender's own jersey.

## The punchline, for fun

The reach rule kept its whistle; only the jersey changed.

## The options, in plain words

A. A. Keep the tests as changed (built).
B. B. Keep the tests as changed, and amend the rule's wording to name the key's App's installation too.

## What I had to decide

Answer A to keep the tests as changed. If the rule's wording about the installation should name the key's App too, say so and a person amends it with the knowledge skill, which this slice never edits.
Decided by: Jev (hardToRevert 0.64) · agent said false

## What I did meanwhile

The tests stay as changed and the rule keeps its current words.

## What it costs to change later

Small: a reworded rule or a reverted test, no data to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the rule's words about the Omni App's installation should now also name the key's App was left to a person: this slice never edits a business law.

```

<!-- /omni-outbox-settled: s1-01-key-app-proofs-follow -->
