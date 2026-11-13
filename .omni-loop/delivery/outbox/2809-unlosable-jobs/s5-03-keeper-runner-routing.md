---
id: s5-03-keeper-runner-routing
prd: 2809
slice: s5
rank: medium
bears-on: none
raised: 2026-11-13
wave: 4
---

## The question, in plain words

When a lost job's saved work could only be kept on the machine that lost it, and that machine is back online but busy, should the job that picks up the work wait for it?

## The decision, in plain words

It waits for that machine while the machine is online and allowed to take the job, even when all its slots are busy. Once the machine has been silent for a minute and a half, any machine takes the job and is told what stayed behind.

## The intro, for fun

The only person with the house keys is home, but on the phone.

## The punchline, for fun

We wait by the door rather than climb in through the window.

## The options, in plain words

A. The resume waits for its online keeper, busy or not (built)
B. A busy keeper does not hold it: any free runner takes it, and its note says what stayed behind
C. The keeper holds it for a set time only, then any runner takes it

## What I had to decide

Keep A, or choose B: a busy keeper does not hold the resume, which then goes to any free runner, its note saying what stayed on the keeper.

## What I did meanwhile

runner_claim() in supabase/migrations/20270120110000_runner_claim_resume.sql skips, for every runner but the keeper, a resume whose chain's newest local save (not deleted, still kept) is kept by a runner seen in the last 90 s, of the workspace, an App runner, holding the job's repository and its target. Free slots are not read; supabase/checks/runner_resume.sql proves the online, offline and expired cases.

## What it costs to change later

One condition in runner_claim(), changed by a follow-up migration: no row moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How long a busy keeper may hold a resume is not bounded: a keeper whose slots stay full holds it until one frees.
