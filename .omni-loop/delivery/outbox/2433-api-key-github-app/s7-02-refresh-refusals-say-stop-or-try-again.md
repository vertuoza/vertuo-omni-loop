---
id: s7-02-refresh-refusals-say-stop-or-try-again
prd: 2433
slice: s7
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

When a runner asks for a fresh GitHub token, the spec says who may ask and until when, but not what to answer when the API key or its App has stopped working, or when GitHub cannot be reached. What should the runner be told in each case?

## The decision, in plain words

A key or App that no longer works gets a conflict answer with the reason in words, and a GitHub that cannot be reached gets service unavailable, so the runner can tell a stop from a try-again.

## The intro, for fun

The runner knocked for a fresh token, and the answer could mean stop or try again.

## The punchline, for fun

Each knock now says which, in words, so nobody has to guess.

## The options, in plain words

A. Answer a conflict with the reason in words when the API key or its App no longer works, and service unavailable when GitHub cannot be reached, so the runner can tell a stop from a try-again.
B. Answer the same conflict for both, so the runner ends the job at once even when GitHub only had a brief outage.
C. Answer not found for both, giving the runner no words to put in the job's reason.

## What I had to decide

The slice settles who may ask (only the job's runner), when (while claimed or running, and for 10 minutes after the end: a conflict after, forbidden for another runner) and what comes back (the token and its expiry). It says nothing of a refresh that cannot mint. The kit's runner reads the words of any refusal below 500 except 401, and treats a 5xx as GitHub being out of reach, so a status had to be picked for each case.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

A key that was revoked or whose maker left, an App removed from the key, an App not installed on the repository, and an installation without write access each answer a conflict with the words that say why. A GitHub that throws, whatever the status it gave, answers service unavailable with the first line of its error, which never holds a key or a token. The words are cut to 150 characters. In the claim itself every one of these ends the job failed with 'github app: <why>'.

## What it costs to change later

Small: the statuses are a few lines in the service and its tests. A runner already built against the answers keeps working, because it only reads the words of a refusal and retries on a 5xx.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether a refusal from GitHub itself, such as an App deleted on GitHub, should stop the runner or let it try again; here every thrown GitHub error reads as try again until the token runs out
