# Access principles

## P-ACCESS-1

A job promised to run as an App never ends up running as a person, whatever changes to its key after it was sent.

Why: Otherwise removing an App would silently hand waiting work to whichever person's machine claimed it, with that person's identity and reach.
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s1-01-queued-jobs-stay-app-jobs, PRD #2433
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## P-ACCESS-2

Work an API key sends is always credited to the key, never passed off as the work of a person.

Why: People reading a pull request must be able to tell an agent's work from a person's, or trust in who did what breaks.
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s2-04-key-sender-own-variable, PRD #2433
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## P-ACCESS-3

Work done as the GitHub App is never finished by a person's account; when the App cannot act, the action waits rather than being taken in someone's name.

Why: An action taken by a person's account on the App's behalf misattributes it and breaks the promise that an App job never runs as a person.
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s3-02-an-app-job-with-no-token-left-is-released-as-nothing, PRD #2433
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## P-ACCESS-4

A credential sent by someone not allowed to attach it is never kept, logged or shown back, whatever checks it passed on the way.

Why: A private key held by the wrong person must not end up anywhere they or others could later read it.
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s4-01-pair-checked-before-owner, PRD #2433
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23

## P-ACCESS-5

A refusal to a runner always lets it tell a stop from a try-again, so a brief GitHub outage never ends a job that could go on.

Why: Runners end a job on a lasting refusal and retry on an outage; mixing the two fails jobs needlessly or retries hopeless ones.
Source: .omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md, entry s7-02-refresh-refusals-say-stop-or-try-again, PRD #2433
Merged: @nicojustdev, 2026-10-23, PR #2434
Proposed: harvest 2026-10-23
