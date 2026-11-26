# Bug 3337: the Supervisor never answers a message in an older finding's thread

## Triage

- **Domain:** the Supervisor's seat (`kit/lib/runner/supervisor.ts`, `waitingMessages`)
- **Risk:** medium — an owner who writes in an older notification's thread gets no answer, silently; the general chat still answers
- **Regression:** new bug — no evidence this ever worked (the seat shipped in #3284 with the cap)

## Reproduction

- **File:** `kit/lib/runner/supervisor.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [] to have a length of 1 but got +0`

## Fix

Each look read the threads of the 20 newest open findings only, so with 24 open findings an owner's message in the oldest one was never given to the model. A look now reads every open finding's thread.

## Guard

The reproduction is the guard: a unit test with 24 open findings and a message in the oldest one's thread, which fails on any cap that leaves an open thread unread.

## Mutation

mutation: no changed core file against origin/main (f899eef5): nothing to mutate
