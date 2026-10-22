---
id: s1-02-resume-stays-the-keys
prd: 2425
slice: s1
rank: high
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When a person answers, on the page, a question that a key's job asked, whose job is the resumed one: the key's, or the person's who answered?

## The decision, in plain words

The resumed job stays the key's: it is sent by the same key and by the person who made it, and the answer records who gave it. The whole thread stays in one place for the key's owner.

## The intro, for fun

Someone else answered, but the thread knows who started it.

## The punchline, for fun

The answer has a name on it; the job keeps its owner.

## The options, in plain words

A. The resumed job stays the key's, sent by its key and its maker, and the answer records who gave it.
B. The resumed job is sent by the person who answered, with no key: the thread breaks, as it does today.

## What I had to decide

The spec says the resume of a key's job is sent by the same key and keeps `continues` and `notify_url`, whoever answered; it does not say who `sent_by` is. `sent_by` already means the key's maker for a key's job (20261210090000_api_keys.sql), so the resume keeps the original job's `sent_by` and `sent_by_key`, and the answerer is stored on the round (`closed_by` for a person, `closed_by_key` for a key). A job a person sent resumes as before, sent by the one who answered.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

Built runner_job_answer so the resume copies `sent_by`, `sent_by_key` and `notify_url` from the asked job when a key sent it, and proved it for an answer by a person and by another key.

## What it costs to change later

Changing it later means changing one function, and the resumes already stored keep the sender they were given: a backfill if the old ones must change too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the maker should see, in the key's own thread, that someone else answered: the round records it, nothing shows it yet.
