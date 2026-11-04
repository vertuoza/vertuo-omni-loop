# Bug 2656: Runner jobs fail at start: GitHub answers 403 to the Omni server's lookup of the App's bot

## Triage

- **Domain:** runners
- **Risk:** medium — anyone sending a job to a runner: while GitHub refuses the server's tokenless lookup of the App's bot, each job ends `Failed` as it is claimed; the workaround is to run the skill in a terminal, or try again later (Jev, 0.46)
- **Regression:** yes — b9283a6b4 (#2574, PRD 2573): every runner job now runs as the Omni App, so every job needs the bot's id, read with no token since #2547

## Reproduction

- **File:** `apps/galaxy/src/runners/runners.github.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected null to match object { github: { …(3) } }

## Fix

A job a runner claims needs the Omni App's bot, and the server read its id from GitHub with no token, which GitHub limits to 60 calls an hour per address. When GitHub answered 403 the job ended failed, though it already held a token. The server now asks with the token it just minted for the job, and with no token only when that is refused. Why GitHub answered 403 in production stays unconfirmed: the Vercel logs were not read, and no live installation token was tried here.

## Guard

The reproduction: a job claimed while the bot's route refuses a call with no token. It fails on the default branch's lookup and passes here.

## Mutation

mutation: no changed core file against origin/main (07ed9924): nothing to mutate
