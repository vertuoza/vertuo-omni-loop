# Bug 1851: every GitHub read writes the budget and the ETag store, full bodies included

## Triage

- **Domain:** the shared GitHub client's budget and ETag store (`packages/github`, PRD 902): `client.ts` decides what is written, `supabase-store.ts` writes it
- **Risk:** high — every page and job shares a database that spends a sixth of its time, and most of its write-ahead log, on bookkeeping writes after GitHub reads, which slows every member's pages and grows storage; nothing fails outright, and there is no workaround. (Jev, 0.66)
- **Regression:** new bug — no evidence this ever worked: the client has written the budget after every answer and every 200's body since PRD 902 s1

## Reproduction

- **File:** `packages/github/src/client.test.ts`
- **Red:** AssertionError: expected 10 to be 1 // Object.is equality

## Fix

The client upserted `github_budget` after every answer (1,965,365 upserts, 7,559 s of database time on
production), marked an ETag read on every 304 (896,039 updates), and stored every 200's body with its
ETag, up to 2.7 MB for `pulls` list pages that change on every pull request update (1,006,838 upserts).
Now the budget is written only when the answer says something the budget read before the call does not:
none stored, another window or limit, another resource, a stored one a minute old, remaining moved by 2%
of the limit, or within 2% of the 20% background floor, where the refusal turns on it. A 304 marks its
ETag read once a day at most (the sync drops ETags idle for 7 days), and a body over 512 kB is not stored.

## Guard

The reproduction, three tests red on main: ten reads in one window write the budget once, not ten
times; five 304s within a day write no `read_at`; a 2 MB list page is not stored. Beside them, the
writes that must still happen: the 2% step and the minute (59,999 ms no, 60,000 ms yes), every answer
near the floor so a background call is still refused on time, a new window, limit or resource, a body of
512 kB exactly, and a 304 a day after the last read.

## Mutation

mutation: no changed core file against origin/main (c7b6b086): nothing to mutate
