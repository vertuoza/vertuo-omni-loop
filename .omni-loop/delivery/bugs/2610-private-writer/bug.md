# Bug 2610: omni replies ignores the answers of a writer whose organisation membership is private

## Triage

- **Domain:** outbox replies (`kit/lib/outbox/replies.ts`, `omni replies`)
- **Risk:** medium — A person's answers on a feature PR are ignored when `omni replies` runs as a runner job's GitHub App and their organisation membership is private, so `/omni:yolo-fix` on a runner settles nothing; workaround: run it from a laptop signed in as a member. (Jev, 0.94)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/outbox/replies.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected [] to deeply equal [ [ 1, 'agreed' ] ]`

## Fix

The role GitHub shows on a comment depends on who reads it: to a GitHub App, a member with private membership is a `CONTRIBUTOR`, so `omni replies` dropped their answers. Now a reply the role leaves out is checked against the person's real access to the repository, once per login: admin or write counts. A bot is never asked, and anyone with less than write stays out.

## Guard

The tests beside the reproduction in `kit/lib/outbox/replies.test.ts` and `kit/bin/github.test.ts` hold the edges: a bot never counts even with write access, a person without write stays ignored, a 404 reads as no, and any other GitHub failure stops the command rather than dropping the answer.

## Mutation

mutation: 154 killed, 75 survived in kit/lib/outbox/replies.ts; none of the survivors is on a line this fix changed
