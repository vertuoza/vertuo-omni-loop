---
id: s5-02-chain-holds-claims-on-the-runner
prd: 2809
slice: s5
rank: high
bears-on: BR-PRODUCT-4
raised: 2026-11-13
wave: 4
---

## The question, in plain words

When a job is lost and another runner picks up its work, how do we keep a third job from grabbing the same slices in between?

## The decision, in plain words

The lost job's runner no longer frees the slices that job was building, and the job that picks up the work is told they are its own to take over. Nothing on the server checks it.

## The intro, for fun

Someone left their towel on the sun lounger and went for a very long swim.

## The punchline, for fun

Only their twin is allowed to move the towel, and the twin has the note to prove it.

## The options, in plain words

A. The lost job's runner releases nothing, the resume's note tells its session to take the claims over, and the resume releases what is left (built)
B. The server records which chain holds a claim, and the claim check refuses any other job
C. Release the lost job's claims as before, and let the resume take them back as any stale claim

## What I had to decide

Keep A, or choose B: the server also records which chain holds each claimed slice, and the claim check refuses any other job's takeover, a larger change to the claim check and the skills.

## What I did meanwhile

runner.ts marks a job lost when the app refuses its report with `failed, runner lost` (api.ts carries the 409's words), and then releases none of its claims when its skill resumes and it was not the third attempt (chainCarriesOn in resume.ts); the sweep does the same for a stranded job, by the chain kept in ~/logs/job-<id>.chain.json. The resume note names the chain's earlier jobs and tells the session to take over a claim naming one of them. A job of a chain that ends releases its own claims and those of the earlier jobs.

## What it costs to change later

B is a new stored shape (a claim's chain on the server) and a change to the claim check and the claim mode of the pull request skill: a migration and three files outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A claim left unreleased reads as held, so another job may still take it over once it has been quiet past the stale-claim limit, before the resume starts: one to five minutes, against an hour today.
- (author) A job whose cancel was asked while its runner was silent ends lost on the app; its claims stay held until the stale-claim limit, since no resume is queued for it.
