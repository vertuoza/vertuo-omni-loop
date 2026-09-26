---
id: s4-01-model-client-answer-shape
prd: 82
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The shared model client had to say how a call went. Should it keep the retro's own wording for each failure, or give a short kind of failure plus a sentence that each caller turns into its own words?

## The decision, in plain words

It gives a short kind of failure (no key, model unavailable, reply refused) and a sentence saying why. The retro keeps its own wording by translating those kinds when it moves onto the shared client.

## The intro, for fun

Two callers, one model, and a disagreement about how to say no.

## The punchline, for fun

So the client says it plainly, and each caller says it nicely.

## The options, in plain words

A. A failure kind plus a sentence; each caller words it (built).
B. The client returns the retro's exact reason strings, and the harvest reuses them.

## What I had to decide

Whether the shared model client reports failures as a kind plus a sentence, leaving each caller to word them, or reports them in the retro's exact words.

## What I did meanwhile

The client returns ok, a failure kind (no-key, unavailable, refused), the model asked, the reply and a reason. Replies are not streamed unless the caller asks, and the reply check may be a function or a zod schema.

## What it costs to change later

Low: the client is new and only the retro and the harvest call it. Changing the answer shape is an edit to one module and its two callers, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say how the shared client reports a failure; the retro wording it replaces lives in the app (author)
