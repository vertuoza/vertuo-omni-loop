---
id: s3-02-log-lines-travel-with-evidence
prd: 72
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The model is to see the end of each failed log beside the problem it explains, but nothing says where those lines are kept for it. Where should they go?

## The decision, in plain words

Each link to a failed run carries that run's last lines, so the model gets them with the problem they explain. The retro page shows only the links, while its data file keeps the lines.

## The intro, for fun

Every log line wanted a seat right next to the problem it could explain.

## The punchline, for fun

It got one, tucked behind each link, where the page never shows it.

## The options, in plain words

A. Each link to a failed run carries its last lines, the option built.
B. Keep the lines only in the checks part of the data file, and have the model's step look them up there.
C. Keep a separate list of excerpts on each problem, apart from its links.

## What I had to decide

Where the failed jobs' log tails live in the fact sheet, so that `narrate` (slice s6, built at the same time) can send them. `narrate` receives only `{ sheet, prd }` (its contract in `apps/omni-app/src/retro/narrate.mjs`); the spec says the model gets "per finding its id, its facts and its evidence excerpts (failed-job log tails of about 200 lines…)"; the registry in `kinds/index.mjs` types evidence as `{ label, url }`.

## What I did meanwhile

Every evidence item of a `repeated-red`, `flaky` or `failing-test` finding that points at a red job whose log was read carries `excerpt`: that log's last lines, cleaned. `render` writes only `[label](url)`, so `retro.md` shows no log line (tested); `retro.json` keeps them, once per finding citing the run, so a run cited by a repeated-red and a failing-test finding is kept twice. The kind's facts keep a log's lines themselves only when no reporter was read (`kinds.ci.redRuns[].excerpt`), as the spec's "any other format keeps its excerpt" asks. Nothing is masked here: `narrate` masks token-shaped strings before sending.

## What it costs to change later

A few lines in `kinds/ci.mjs` and its tests if `narrate` looks elsewhere. Before any retro is merged, nothing else; after, the `retro.json` files already merged keep the excerpts where they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Where s6's `narrate` and `guard` look for evidence excerpts; they were built at the same time, without this.
- (author) How large `retro.json` grows for a delivery with many red runs; each excerpt is at most 200 lines, and nothing caps how many.
