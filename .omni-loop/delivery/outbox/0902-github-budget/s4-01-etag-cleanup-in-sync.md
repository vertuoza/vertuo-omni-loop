---
id: s4-01-etag-cleanup-in-sync
prd: 902
slice: s4
rank: medium
bears-on: none
raised: 2026-10-05
wave: 3
---

## The question, in plain words

Old saved GitHub answers must be thrown away after a week of not being used. Should the shared GitHub helper learn to do that itself, or may the regular sync clean them up on its own?

## The decision, in plain words

The regular sync throws away saved answers nobody used for a week, by itself, without changing the shared GitHub helper that another part of the work owns.

## The intro, for fun

The fridge of saved GitHub answers was getting crowded.

## The punchline, for fun

The night cleaner now bins anything untouched for a week.

## The options, in plain words

A. A. Keep the cleanup in the sync; the shared GitHub helper stays as it was built.
B. B. Teach the shared GitHub helper to throw away old answers, and have the sync ask it to.
C. C. Leave the cleanup to a scheduled job in the database instead of the sync.

## What I had to decide

Whether the delete of idle ETag rows stays in the sync's own store or moves behind the GithubStore port in packages/github.

## What I did meanwhile

apps/galaxy/src/stages/sync/snapshots.ts deletes github_etags rows whose read_at is more than 7 days old, once per sync run, as the service role (the s1 migration already grants it delete and indexes read_at). The GithubStore port, memoryGithubStore and supabaseGithubStore are unchanged, so packages/github (s1's ground) is untouched.

## What it costs to change later

Moving it behind the port later is one method on GithubStore, its two stores and one call in the sync: an hour, no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether s1 meant supabaseGithubStore to be the only code that writes github_etags: the spec says only that the sync may delete rows unread for 7 days.
