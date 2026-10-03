---
id: s4-01-readme-variable-list-is-a-marked-section
prd: 1059
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

The check that keeps the setup guides honest must know which part of each guide is its list of settings. How does it find that list?

## The decision, in plain words

Each guide carries one list of settings between two invisible markers, and the check reads only the setting names inside it. A setting named anywhere else in the guide is ordinary prose and is not checked.

## The intro, for fun

A guide that mentions a setting on every page is not the same as a guide that lists it.

## The punchline, for fun

So each guide now has one list, fenced in, and the check reads only that.

## The options, in plain words

A. A. One marked section per README, read between two hidden markers; names elsewhere are prose.
B. B. A heading named Environment variables in each README, and every name under it up to the next heading.
C. C. Every backticked setting name anywhere in the README, compared with what the code reads.

## What I had to decide

How a README's variable list is recognised by the docs check: a marked section, a heading, or every backticked name in the file.

## What I did meanwhile

scripts/env-docs.test.ts reads the backticked names between <!-- omni:env-variables --> and <!-- /omni:env-variables --> (exactly one section per README, else it fails) and compares them both ways with the runtime's VARIABLES: README.md with the kit's, game/README.md with the game's groups (workspace and Supabase), apps/omni-app/README.md with its groups plus SDK_VARIABLES (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, and INNGEST_DEV, now listed as local only), apps/galaxy/README.md with the arcade's. apps/galaxy/.env.example is read as every NAME= line. Platform values (PLATFORM_VARIABLES) are listed nowhere. README.md and game/README.md gained a short list; omni-app's setup list gained OPENROUTER_MODEL, STAGE_EVENT_SECRET, GALAXY_URL and INNGEST_DEV; galaxy's Vercel step gained the full list.

## What it costs to change later

Answering B or C is a change to readmeNames in scripts/env-docs.test.ts and the markers in four READMEs: under an hour, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every README variable list must match the schemas but does not say how a list is told apart from prose that names a variable.
- (author) The root README listed no kit variable before; whether it is the right home for the kit's list, rather than a kit page, is not settled anywhere.
