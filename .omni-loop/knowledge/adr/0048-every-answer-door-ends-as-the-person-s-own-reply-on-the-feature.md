# ADR-0048 — Every answer door ends as the person's own reply on the feature PR, and the App carries the outbox to the Omni page

**Status:** accepted · **Date:** 2026-09-27 · **PRD:** #251

## Context

A person answers the outbox by replying on the feature pull request, and only there. PRD 251 opens
two more doors: the terminal, at the end of a `/omni:yolo` whose gate is red, and the Omni page, on
the PRD's dossier (`/prd/<id>`, an Outbox tab beside the before/after page, the spec and the
brainstorm). Three questions had to be settled before either door was built: where an answer is
recorded, how the page learns what is open, and whose name an answer from the page carries.

The loop already has one reader of answers, `omni replies` (`planReplies`), which `/omni:yolo-fix`,
the ledger and the outbox check all rely on. It counts only replies whose author GitHub lists as
`OWNER`, `MEMBER` or `COLLABORATOR`. The omni-loop App (ADR-0001) already evaluates every feature
pull request with the base branch's config, the head's delivery folder and the comments.

## Decision

1. **The pull request stays the one record.** Every door ends as a person's reply on the feature
   pull request, written by one reply writer in the kit (`kit/lib/outbox/answers.mjs`) in the grammar
   `planReplies` reads, and proven against it by a test. `omni replies`, the ledger,
   `/omni:yolo-fix` and the outbox check change in nothing.
2. **The App carries the outbox to the page.** After it publishes the check and the comment, the
   `outbox-check` function takes one more step, `relay`: it sends `POST <OMNI_PAGE_URL>/api/outbox`
   what it evaluated (open, adopted, pending, settled), signed with `OMNI_OUTBOX_SECRET`, when the base
   config has `answers.enabled` on and `ask.url` is on the App's `OMNI_PAGE_URL` host. It re-checks on
   every `issue_comment` on a pull request too, and sends once more when the pull request closes. The
   page keeps only the latest outbox per PRD, needs no sign-in to receive it, and reads nothing from
   GitHub.
3. **An answer from the page posts as the person,** through a user authorisation of the omni-loop
   App, traded for a token that is used once to post the reply and then dropped: never stored,
   logged or sent to the browser. A reply by the App's bot would not count, and making the kit trust
   the bot would let anyone holding the App's key answer for anyone.

## Consequences

- A person's answer always carries that person's name, on GitHub and in the ledger, whichever door
  it came through; the gate stays red until a person answers (P-PRODUCT-3), and no agent or bot
  answers for them.
- The App gains one event (`issue_comment`) and two variables (`OMNI_PAGE_URL`, `OMNI_OUTBOX_SECRET`);
  the galaxy gains a server-only service key (`SUPABASE_SERVICE_ROLE_KEY`) for `dossier_outbox_put()`
  alone, the shared secret, and the App's `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`.
- A person must change the App's settings before the page can send: list each galaxy host's
  `/prd/github/callback` as a callback URL, allow user authorisation, and accept the `issue_comment`
  event on each installation. Until then the page shows questions only after a push, and Send fails
  with GitHub's reason. A host not listed as a callback URL (a preview deployment) cannot send.
- A person GitHub does not list as `OWNER`, `MEMBER` or `COLLABORATOR` can send from the page, but
  `omni replies` does not count the reply; the tab says so.
- When the App is down, or `answers.enabled` is off, the page shows its last stored outbox and the
  pull request still takes replies: the page is a view, never the record.
- Rollback: `answers.enabled: false` stops the terminal question and the App's sends at once; a
  follow-up migration drops the page's two tables.
