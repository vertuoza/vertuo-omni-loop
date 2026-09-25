---
id: s6-01-model-asked-three-times-in-four-minutes
prd: 72
slice: s6
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the retro goes out with the facts only once the model has failed after its retries, but the step that asks the model cannot fail without failing the whole retro. How often, and for how long, should the model be asked?

## The decision, in plain words

The model is asked up to three times, a few seconds apart, when it is busy or down, all within four minutes, and the part of the app that runs it may now run for five. After that the retro goes out with the facts only, saying the model was unavailable.

## The intro, for fun

Asking a busy model for words is like calling a bakery during the morning rush.

## The punchline, for fun

Three rings, a short wait between each, then the retro leaves with plain toast.

## The options, in plain words

A. Three tries within four minutes, in a part of the app that may run for five, the option built.
B. Let the step fail and be tried again by the job runner, which needs the retro's wiring changed so a failure still ends in a facts-only retro.
C. Ask once, and go out with the facts only on the first failure.

## What I had to decide

How the model call is retried, and how long it may take. The spec ("Failures") says that when "the model call fails after the step's retries" the retro goes out "Facts only: model unavailable (<status>)", and asks `vercel.json`'s `maxDuration` for `api/inngest.mjs` to be "raised above 60 seconds" without naming a value. The seam s2 wired calls `narrate` inside `step.run('narrate')` with no try/catch (`src/retro/retro.mjs`, outside this slice): a throw from `narrate` would fail the run after Inngest's retries and post "The retro could not run" instead of a facts-only retro.

## What I did meanwhile

`narrate` never throws. `MODEL_CALL` in `src/retro/narrate.mjs`: 3 tries in all on a network error, a 408, a 429 or a 5xx, 1 s then 4 s apart; a 401 or another 4xx is not tried again; every try and the one repair share a 240 s budget, enforced with `AbortSignal.timeout`. `vercel.json` names `api/inngest.mjs` at `maxDuration: 300` and `api/github.mjs` at the 60 it had, in place of the `api/*.mjs` glob. `retro.md`'s front matter names the model asked even when it was unavailable, beside "Facts only: model unavailable (500)". Tests pin the budget under `maxDuration`, every file under `api/` named, and a stubbed 500 through the real function giving facts only and no failure comment.

## What it costs to change later

Constants in one file and one number in `vercel.json`. Retrying through Inngest instead needs a try/catch around the step in `retro.mjs`, slice s8's ground in wave 4.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Vercel plan the app is deployed on: 300 seconds is the most a Hobby project gets with fluid compute, and a plan allowing less refuses the deploy.
- (author) How long Claude Opus 5.5 takes through OpenRouter to write a retro from 40,000 tokens of input.
