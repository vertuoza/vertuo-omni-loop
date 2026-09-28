# ADR-0051 — Every answer door ends as the person's own reply on the feature PR, and the Omni page reads the outbox from GitHub

**Status:** accepted · **Date:** 2026-09-28 · **PRD:** #251

## Context

A person answers the outbox by replying on the feature pull request, and only there. PRD 251 opens
two more doors: the terminal, at the end of a `/omni:yolo` whose gate is red, and the Omni page, in
the PRD's Outbox tab (`/prd/<id>?tab=outbox`, beside the before/after page, the spec and the
brainstorm). Three questions had to be settled before either door was built: where an answer is
recorded, how the page learns what is open and what was already answered, and whose name an answer
from the page carries.

The loop already has one reader of answers, `omni replies` (`planReplies`), which `/omni:yolo-fix`,
the ledger and the outbox check all rely on. It counts only replies whose author GitHub lists as
`OWNER`, `MEMBER` or `COLLABORATOR`. PRD 426 already made the galaxy read GitHub itself, as the
omni-loop App (`apps/galaxy/src/dossier/github/reader.ts`): the feature branch's outbox items,
`settled.md` and the feature pull request's comments, cached 60 seconds per dossier.

The first build of PRD 251 (kept at the tag `archive/outbox-answers-v1`) had the App relay each
evaluated outbox to the page (`POST /api/outbox`, signed with a shared secret, stored in
`dossier_outboxes`). That build was never merged; this record replaces its decision 2.

## Decision

1. **The pull request stays the one record.** Every door ends as a person's reply on the feature
   pull request, written by one reply writer in the kit (`kit/lib/outbox/answers.mjs`) in the
   grammar `planReplies` reads, and proven against it by a test. The kit (`omni answers post`) and
   the galaxy (`POST /api/outbox/send`) both import it. `omni replies`, the ledger,
   `/omni:yolo-fix` and the outbox check change in nothing.
2. **The page reads the outbox from GitHub, and keeps no copy.** The reader it already has keeps,
   from the comments it already fetches, the outbox comment's numbering and the pending answers
   (`planReplies` run on them: the text, who, when, the link, whether the author counts). The
   omni-loop App does not change: no relay, no `issue_comment` event, no `POST /api/outbox`, no
   shared secret, no stored outbox in Supabase. Send checks its picks against a fresh read, not the
   cache.
3. **An answer from the page posts as the person,** through a user authorisation of the omni-loop
   App (`GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`), with a nonce the callback
   (`/prd/github/callback`) checks. The code is traded for a user token that is used once to post
   the reply and then dropped: never stored, logged or sent to the browser. Each send is a row of
   `outbox_sends` only its owner reads, and its outcome is recorded once. A reply by the App's bot
   would not count, and making the kit trust the bot would let anyone holding the App's key answer
   for anyone.

## Consequences

- A person's answer always carries that person's name, on GitHub and in the ledger, whichever door
  it came through; the gate stays red until a person answers (P-PRODUCT-3), and no agent or bot
  answers for them.
- An answer typed on GitHub shows on the tab within the reader's 60-second cache, not at once. A
  send clears its dossier's cached summary, so an answer sent from the page shows at once.
- When GitHub cannot be read, the tab says so and the other tabs are unchanged; the pull request
  still takes replies: the page is a view, never the record.
- The galaxy gains two server-only variables, `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`,
  and one table, `outbox_sends`, with `outbox_send_done()`. Without the two variables, the tab reads
  and Send says sending is not open here.
- A person must change the App's settings before the page can send: list
  `<galaxy>/prd/github/callback` as a callback URL. GitHub brings the person back only to a listed
  host, so a preview deployment cannot send.
- A person GitHub does not list as `OWNER`, `MEMBER` or `COLLABORATOR` can send from the page, but
  `omni replies` does not count the reply; the tab says so.
- Rollback: `answers.enabled: false` stops the terminal question and the comment's Omni page line at
  once; reverting the galaxy takes Send away; a follow-up migration drops `outbox_sends` and
  `outbox_send_done()`.
