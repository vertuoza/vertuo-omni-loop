---
id: s2-01-production-is-vercel-production
prd: 1059
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The GitHub App must refuse to start in production when its webhook secret or its own identity is missing. How does it know it is running in production, and not on a preview of a pull request?

## The decision, in plain words

Only the live deployment counts as production. Previews of a pull request and local runs start without those secrets, as they do today, because the setup guide never says previews are given them.

## The intro, for fun

Every preview dresses like production; only one of them pays the rent.

## The punchline, for fun

So only the real one is asked for its keys at the door.

## The options, in plain words

A. A. Production is the hosting platform naming its live deployment: previews and local runs require none of the production secrets.
B. B. Production is the build mode saying production: every Vercel deployment, previews included, requires them.
C. C. As A, plus previews require them too, once the preview environment is confirmed to hold them.

## What I had to decide

Whether the app reads production from the hosting platform's own environment name (production only) or from the Node build mode, which is also set to production on every preview.

## What I did meanwhile

apps/omni-app/src/env.ts sets production to VERCEL_ENV === 'production'. A preview (VERCEL_ENV=preview), a development server and a test require neither GITHUB_WEBHOOK_SECRET nor GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY; the production deployment fails at start, naming them, when one is missing. A half-set or malformed group still fails everywhere.

## What it costs to change later

Answering B or C is one line in readEnv (the production flag) and its test: under an hour, no migration. B would make every preview deployment of the app fail at start unless its preview environment is given the three secrets.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'in the GitHub App in production' without saying which signal names production.
- (author) apps/omni-app/README.md lists the variables for the Vercel project and never says whether the preview environment holds them; whether previews of this project have them set today could not be checked from here.
