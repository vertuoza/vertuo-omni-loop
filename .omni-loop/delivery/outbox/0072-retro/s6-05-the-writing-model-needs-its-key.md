---
id: s6-05-the-writing-model-needs-its-key
prd: 72
slice: s6
rank: human-action
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The retro asks a writing model for its summary and its lessons, and that needs a key that only a person can create and store in the app's hosting settings. Will someone add it?

## The decision, in plain words

Until the key is set, every retro goes out with the counted facts only, says so on its first line, and proposes no lessons.

## The intro, for fun

The writer showed up for work, but nobody handed over the key to the office.

## The punchline, for fun

Until then, the retro reads out the facts in a flat voice and skips the lessons.

## What a person must do

1. Create an OpenRouter key for the team.
2. In the omni-loop Vercel project (the app, not the galaxy), add it as `OPENROUTER_API_KEY` for Production.
3. Check that OpenRouter serves `anthropic/claude-opus-5.5`; if it does not, also set `OPENROUTER_MODEL` to a model it does serve.
4. If the key is set after this pull request merges, redeploy the omni-loop project once.

The same steps are in issue #93.

## What I had to decide

`narrate` reads `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`) from the Vercel function's environment. The code cannot create or store a secret. Issue #93 holds the steps.

## What I did meanwhile

Without the variable, `narrate` returns `no model key` and the retro publishes "Facts only: no model key". Nothing fails.

## What it costs to change later

None in code: setting the key later changes only the retros after it; earlier ones can be replayed from Inngest.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether OpenRouter serves `anthropic/claude-opus-5.5` was not checked live (author).
