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
