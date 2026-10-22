---
id: s3-02-s3-repos-read-rounds
prd: 2401
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The spec said the new small read for a PRD's repository chips would not look at the questions, yet it must show the repositories the questions were asked in, and the live refresh needs the question counts. Is it fine that it reads that one PRD's questions?

## The decision, in plain words

The new read looks at the questions of the one PRD it is asked about, no other, so the chips show the same repositories as before and the live refresh still notices a new question; it no longer numbers every version of the PRD, which it never needed.

## The intro, for fun

A read promised to skip the questions, then found the chips were made of questions.

## The punchline, for fun

It reads one PRD's questions now, not the whole workspace's.

## The options, in plain words

A. Read the one PRD's questions, so the chips and the live refresh stay exactly as before.
B. Read no question: the chips show only the home repository and the planet's regions, and the live refresh watches versions only.

## What I had to decide

Keep the read as built (A), or drop the questions' repositories from the chips and the question counts from the live refresh (B).

## What I did meanwhile

`dossier_repos(p_dossier)` matches the one dossier's rounds as `dossier_list()` does and returns its repositories, its rounds asked and answered, and its version count per kind; `supabase/checks/dossier_reads.sql` proves it equals `dossier_list(p_dossier)` for every dossier.

## What it costs to change later

A: none. B: a follow-up migration, and the page would miss new questions until it is reloaded.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's "joins no rounds" cannot hold together with "returns the same repositories dossier_list(p_dossier) did": a dossier's other repositories are its rounds' sessions' (author).
