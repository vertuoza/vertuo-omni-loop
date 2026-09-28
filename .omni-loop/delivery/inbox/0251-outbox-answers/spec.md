---
prd: 251
title: Answer the outbox anywhere — at the end of yolo, beside the PRD in the app, or on the pull request
blocked-by: none
spec: file
---

# Answer the outbox anywhere: at the end of yolo, beside the PRD in the app, or on the pull request

**Date:** 2026-09-28 (revised; first written 2026-09-27) · **PRD:** #251 · **Touches:** `kit/` (the
switch, a command, the reply writer, the yolo skill, the outbox comment, `omni init`),
`apps/galaxy` (the reader, the Outbox tab, the send flow, the short address), `supabase/` (one
table), a decision record.

**Why revised.** The first build (#253, kept at the tag `archive/outbox-answers-v1`) merged five of
its six slices into its feature branch, then stalled on the live acceptance while `main` moved on.
Since then PRD 426 gave the PRD page an Outbox tab and made the galaxy read GitHub itself, as the
omni-loop App. PRD 359 made the App public and sign-in GitHub-only. So the App no longer needs to
carry the outbox to the page: the page reads it, the pending answers included. The relay, the
`issue_comment` event, `POST /api/outbox`, its signing secret and the `dossier_outboxes` table are
dropped. Everything else is ported from that branch onto today's `main`.

## Problem

`/omni:yolo` builds a PRD with nothing asked along the way. Every decision a coding agent took alone
is an **outbox item**: `human-action` and `high` items keep the outbox check red, and `medium` items
are adopted the moment they are raised (a merge ratifies them). A person then has to answer, and
there is exactly one place to do that: a reply on the feature pull request.

- **The Omni page shows the questions but cannot answer them.** PRD 426's Outbox tab lists the open
  items and the settled ones, then links to GitHub. Answers already typed on GitHub are not shown,
  so the tab cannot say what is still waiting.
- **The context is somewhere else.** Answering well needs the spec, the before/after page and the
  brainstorm's answers. They are other tabs of the same page, so the person answers from memory, or
  flips back and forth.
- **The end of a yolo is a dead end.** When the gate is red, `/omni:yolo` stops and says "answer on
  the pull request". The person sitting at that terminal has to leave it, answer on GitHub, come
  back and run `/omni:yolo-fix`.

## Solution

Three doors, one record. A question can be answered **in the terminal** at the end of
`/omni:yolo`, **on the Omni page** in the PRD's Outbox tab, or **on the pull request** as today.
Every door ends in the same thing: one reply on the feature pull request, written by the person, in
the grammar `omni replies` already reads. So `/omni:yolo-fix`, the ledger, the outbox check and the
omni-loop App do not change.

```
 terminal (end of /omni:yolo)       the Omni page (/prd/<id> · Outbox)     GitHub (the feature PR)
   AskUserQuestion                    pick options, Send                     type `1: A`
   omni answers post                  posted as you (GitHub authorisation)
        └──────────────────► one counted reply on the feature PR ◄──────────────────┘
                                           │
                    omni replies (/omni:yolo-fix) settles → settled.md   (unchanged)

 the Omni page reads the outbox, the comments and the pending answers from GitHub, as the App,
 through PRD 426's reader (60 s cache): no relay, no stored copy
```

### The switch

`.omni-loop/config.yml` takes `answers: { enabled: <boolean> }`.

- **The kit's default is `true`,** and `omni init` writes the key into every new config.
- **This repository does not write the key**: it takes the default. The deployed App parses the
  config with the kit it was built with, which refuses a key it does not know.
- **On:** `/omni:yolo` asks at the end (below), and the outbox comment points at the Omni page when
  `ask.url` is set.
- **Off:** `/omni:yolo` ends as it does today, and the comment carries no Omni page line. The Outbox
  tab still reads and sends: a person who opens it chose that door.

### The reply, written once

`kit/lib/outbox/answers.mjs` holds the one **reply writer**. It is pure, and the kit and the galaxy
both import it, so every door writes identical lines.

- **In:** the open numbering and a list of picks, each `{ number, pick, reason? }`. A pick is a
  letter the question offers, `done` or `not-done` for a `human-action` question, or `prose` with
  its text.
- **Out:** one line per pick, in the order of the numbers:

  | pick | line |
  |---|---|
  | `A`, no reason | `1: A` |
  | another letter, with a reason | `2: B because <reason>` |
  | `done` | `19: ok` |
  | `not-done`, with a reason | `19: no, because <reason>` |
  | `prose` | `5: <text>` |

  then an empty line and one line naming the door: `_answered in the terminal · PRD <n>_` or
  `_answered on the Omni page · PRD <n>_`.
- **It refuses** a number the numbering does not hold, a letter the question does not offer, a
  `done` on a decision or a letter on a `human-action` question, and `not-done` without a reason.
- **A reason or a prose answer becomes one line:** newlines become spaces, `<!--` and `-->` are
  removed, and it is cut to 500 characters. So no reply can carry an outbox marker or smuggle in a
  second answer line.
- **The contract with the reader is a test:** whatever the writer writes, `planReplies` reads back
  as the same answer, for every kind of pick.

### Door 1: the terminal, at the end of `/omni:yolo`

**`omni answers`**, a command with two verbs:

| verb | what it does | exit |
|---|---|---|
| `omni answers ask <prd> --pr <n> [--json]` | Reads the feature pull request's comments, takes the numbering from its outbox comment (the same numbers the pull request shows), and prints the open `human-action` and `high` questions in batches of at most four, `human-action` first, then by number. Each carries its number, its item id, a header (`Q19 · action`, `Q1 · high`), its text (the question and the decision, in plain words) and its options: `A · built` with its text, then `B`, `C`, `D`; or `Done` and `Not done`. | `0` printed · `1` nothing to ask, or the switch is off (one line says which) · `2` usage, or the kit is not installed here |
| `omni answers post --prd <n> --pr <n> --answers <file> [--print]` | Reads the picks from a JSON file, writes the reply with the reply writer, and posts it on the pull request through the client `omni replies` uses. Prints the comment's link. `--print` prints the reply and posts nothing. | `0` posted · `1` refused (the writer's reason) or the post failed, and the reply is printed so it can be pasted · `2` usage |

Mediums are never asked here: they are already adopted, and anyone who objects does so on the Omni
page or on the pull request.

**`/omni:yolo`, when its gate ends red and `answers.enabled` is on.** It first does everything it
does today on that path: the outbox comment, the draft pull request, the status comment. Nothing is
lost if the person walks away. Then it asks **one opening question**:

> *3 questions keep the outbox red.* — **Answer here now** · **Answered on the Omni page or on the
> pull request — carry on** · **Later — stop here**

- **Answer here now:** it runs `omni answers ask`, asks each batch through `AskUserQuestion`
  (`Other` takes a reason or a free answer, recorded as `prose`), posts with `omni answers post`,
  then carries on.
- **Carry on:** it goes straight on.
- **Later:** it stops, as today.
- **Carrying on** means following `/omni:yolo-fix` steps 2 to 7 in the same run, on the same
  feature pull request: adopt leftovers, read the replies and settle them, rework what drifted, then
  gate and ship before ready. When a reply was not enough, the next outbox round is posted, the
  gate stays red, and the pull request stays draft, exactly as `/omni:yolo-fix` ends today.
- **When `omni answers post` fails,** the skill prints the reply to paste on the pull request and
  stops at the red-gate report. Where the session has no `gh`, it posts the `--print` output with
  the session's own GitHub tools, as the person.
- **With ask mode on,** these questions go to the ask page like any other.
- The changes to the skill are recorded in its porting note (`kit/porting/plugin--yolo.md`).

### Door 2: the Omni page

#### The page reads the pending answers

PRD 426's reader (`apps/galaxy/src/dossier/github/reader.ts`) already reads, as the App, the
feature branch's outbox items, `settled.md` and the feature pull request's comments (to find the
outbox comment). It now also keeps, from the same comments:

- **The numbering:** the outbox comment's numbers, so the tab shows `Q1`, `Q19` exactly as the pull
  request does, and a send writes the same numbers.
- **The pending answers:** `planReplies` (the kit's own) run on the comments, one per number: the
  text, who wrote it, when, the comment's link, and whether GitHub lists the author as someone the
  kit counts (`OWNER`, `MEMBER`, `COLLABORATOR`).

It reads at most the last 100 comments, as today. Nothing is stored: the summary stays cached 60
seconds per dossier, and a send clears that cache for its dossier so the answer shows at once.

#### The Outbox tab

PRD 426's tab (`?tab=outbox`, `n open` in its label) becomes the place to answer.

- **Wide:** the questions on the left and a **context rail** on the right. The rail switches
  between **Before/after** (the sandboxed frame the page already shows), **Spec** (rendered, raw
  HTML off) and **Brainstorm** (the dossier's brainstorm rounds, each question with its answer). It
  stays where it is while the person moves through the questions. **Tall:** the rail becomes a
  Context disclosure above the questions, with the same three switches.
- **A decision card** shows the number and the rank, the question and the decision in plain words,
  the options as a radio group (A marked `built · recommended`), an optional reason, the `bears-on`
  entries as chips linking to `/knowledge`, and one disclosure for *What I had to decide*, *What I
  did meanwhile*, *What it costs to change later* and *What I could not know*. Item text is
  rendered with the page's markdown renderer, raw HTML off.
- **A human-action card** shows its steps, then **Done** or **Not done**. Not done needs a reason.
- **An answered card** shows its pending answer: what it said, who, where (the Omni page, the
  terminal or GitHub, read from the reply's door line) and when. It can be answered again: the
  latest reply wins, as `omni replies` already rules.
- **Adopted mediums** sit in one collapsed group, *Adopted unless you object · n*. Each has
  **Object**, which opens its other options and a reason.
- **Settled** sits in another collapsed group: each entry's verdict and its answer.
- **The toolbar:** **Select every recommendation** picks A on every open decision and nothing else:
  it never marks a human-action done, and the person still sends. **Send n answers** posts them.
  Picks survive a reload (the browser's storage, a convenience only).
- **The states:**

  | state | the tab shows |
  |---|---|
  | no outbox yet | PRD 426's words: *No decision yet: the outbox fills while the PRD is built.* |
  | nothing open | *Nothing is waiting on you*, then Adopted and Settled |
  | shipped or closed | read-only, with *The feature pull request merged on <date>: what was still open was adopted.* (or *closed*) |
  | GitHub out of reach | PRD 426's unread words, and the other tabs unchanged |
  | signed out, or not a member of the workspace | the questions, read-only, and *Sign in with GitHub to answer here* |
  | demo | a demo outbox, with Send off and saying so |

- **`/prd`** shows `n open` on each row whose outbox has open items, and a **Needs an answer**
  filter. The count comes from the same cached reader, so a row the reader has not seen in the last
  minute is read when the list is.
- **A short address** for the kit: `/prd/at/<owner>/<repo>/<n>` redirects to the dossier's Outbox
  tab, or to not found. The outbox comment gets one line under its header: *Answer here, or on the
  Omni page: `<ask.url>/prd/at/<owner>/<repo>/<n>`*, written by `formatOutboxPrComment` only when
  `answers.enabled` is on and `ask.url` is set. The kit still never names the galaxy.

#### Send posts the reply as you

1. **Send** calls `POST /api/outbox/send` with the picks, as the signed-in person, who must be a
   member of the dossier's workspace. The server reads the outbox fresh (not from the cache),
   checks each pick against it, drops a pick whose question is no longer open or adopted (*settled
   meanwhile*), and writes the reply with the reply writer. It records the reply as a **send**: one
   row of `outbox_sends` (below), which only its owner reads.
2. It answers with the address of GitHub's authorisation of the omni-loop App
   (`GITHUB_APP_CLIENT_ID`). Its `state` names the send and carries a nonce that is also kept in a
   short-lived, http-only cookie. A person who authorised the App before comes straight back, with
   no prompt.
3. `/prd/github/callback` checks the nonce against the cookie, and that the send is the caller's and
   not yet posted. It trades the code for a user token (`GITHUB_APP_CLIENT_SECRET`), posts the reply
   on the feature pull request with it, drops the token, and records on the send the comment's link
   and author, or the error. The token is never stored, logged or sent to the browser, and a send is
   posted at most once.
4. The comment is the person's own, marked "with omni-loop" by GitHub, so `omni replies` counts it
   like any other: the ledger names that person, and the comment's link is its channel URL.
5. **Back on the tab:** *Sent as @login*, the comment's link, and the next step,
   `/omni:yolo-fix <n>`, with a copy button. The just-sent answers show as pending at once.
6. **When GitHub lists the person as someone whose reply the kit does not count** (the comment's
   `author_association` is not `OWNER`, `MEMBER` or `COLLABORATOR`), the tab says so, and that
   `/omni:yolo-fix` will not read the reply.
7. **When anything fails** (the authorisation refused, `state` wrong, GitHub down, no access, the
   pull request gone), no comment is posted, the picks stay, and the tab names why and offers to
   try again.

**Data.** One migration:

```sql
create table public.outbox_sends (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  owner        uuid not null default auth.uid() references auth.users on delete cascade,
  pr_number    integer not null check (pr_number > 0),
  reply        text not null check (length(reply) between 1 and 16384),
  nonce_hash   text not null,
  created_at   timestamptz not null default now(),
  posted_at    timestamptz,
  comment_url  text,
  login        text,                      -- the GitHub account the reply was posted as
  counted      boolean,                   -- its author_association is one omni replies counts
  error        text
);
```

- **Only its owner** inserts a send (a member of the dossier's workspace), reads it, and records its
  outcome, once, through `outbox_send_done()`. Nobody else reads it, and nobody deletes it.

### Door 3: the pull request

Unchanged: a reply typed on the pull request works as it does today, and the tab shows it as
pending within a minute.

## Decisions

1. **The pull request stays the one record.** Every door ends as a person's reply on the feature
   pull request, so `omni replies`, the ledger, `/omni:yolo-fix` and the outbox check change in
   nothing.
2. **The page reads the outbox from GitHub, it keeps no copy.** PRD 426's reader already reads the
   outbox and the comments as the App; running `planReplies` on those comments gives the pending
   answers. The App does not change, and no outbox is stored in Supabase. The cost: an answer typed
   on GitHub shows within the reader's 60-second cache, not at once. (This replaces the first
   build's App relay.)
3. **An answer from the page posts as the person,** through a user authorisation of the omni-loop
   App, which is used once and never stored. A reply from the App's bot would not count, and making
   the kit trust the bot would let anyone holding the App's key answer for anyone.
4. **One switch, `answers.enabled`, on by default,** written by `omni init`. This repository takes
   the default rather than writing the key, until the App runs a kit that knows it.
5. **The terminal asks at the end of `/omni:yolo`, never along the way,** and only once it has
   finished everything else: one opening question, then the `human-action` and `high` questions.
   Mediums are never asked there.
6. **Answering carries on into the yolo-fix steps in the same run,** so one command goes from a PRD
   to a pull request ready for review, when the person is there to answer.
7. **One reply writer, in the kit,** imported by the galaxy, and proven against `planReplies` by a
   test. A reason is one line of at most 500 characters, with no marker.
8. **The Outbox tab shows the PRD beside the questions:** a context rail with the before/after page,
   the spec and the brainstorm, not a reminder to open other tabs.
9. **Select every recommendation only pre-selects,** and never marks a human-action done: a
   person's check is never ticked for them.
10. **The code is ported, not merged.** The first build's branch is kept at a tag; its slices are
    carried onto a fresh branch from today's `main`, so no stale conflict resolution lands.

## User stories

- As a PM, my yolo ends red at the terminal. It asks me the three questions that block it, I answer
  them there, and the same run settles them, reworks the one I disagreed with, and leaves the pull
  request ready.
- As a PM on my phone, I open the link in the outbox comment, read the before/after page beside
  question 1, choose B with a reason, and press Send. The reply appears on the pull request under my
  name.
- As a PM whose yolo is waiting at its opening question, I answer on the Omni page, go back to the
  terminal and choose *carry on*.
- As a product owner, I object to an adopted medium from the Outbox tab, with the spec open beside
  it.
- As an engineer, I reply `2: A` on GitHub as always, and the Outbox tab shows my answer as pending
  within a minute.
- As a repository owner, I set `answers.enabled: false`, and yolo ends as before.

## Scope

**In:**
- The switch, and `omni init` writing it (`kit/lib/init/config-text.mjs`).
- The reply writer and `omni answers ask` / `post`.
- `/omni:yolo`'s opening question and carrying on into the yolo-fix steps, and its porting note.
- The outbox comment's line pointing at the Omni page, and its porting note
  (`kit/porting/outbox--comment.md`).
- The reader keeping the numbering and the pending answers.
- The Outbox tab's cards, groups, toolbar, states and context rail; the `/prd` badge and filter;
  `/prd/at/…`.
- Send, through the omni-loop App's user authorisation, and the `outbox_sends` migration.
- A decision record for Decisions 1 to 3, and the kit and galaxy READMEs' lines.

**Out:**
- Any change to the omni-loop App (`apps/omni-app`): no new event, no relay.
- Storing the outbox in Supabase.
- Starting `/omni:yolo` or `/omni:yolo-fix` from the Omni page.
- The arcade: no planet tab, no scene.
- Asking mediums in the terminal.
- Keeping a person's GitHub authorisation between sends.
- Answering on the PRD issue from the Omni page.
- A reply by the App's bot on a person's behalf.
- Writing `answers:` into this repository's config.
- Notifications (Slack, e-mail) when a question is raised.

## Test seams

No test calls GitHub, Supabase or the network, apart from the `supabase` workflow's local stack
(`omni kb show testing`).

- **The reply writer** (`kit/lib/outbox/answers.test.mjs`):
  - Each pick's line, in number order, with the door's line after an empty line.
  - Each refusal: an unknown number, a letter not offered, `done` on a decision, a letter on a
    human-action, `not-done` with no reason.
  - A reason with newlines, `<!--`, `-->` and 600 characters becomes one clean line of 500.
  - Written, then read by `planReplies`: the same verdict and text for every kind of pick, and a
    reply that answers several numbers answers each of them.
- **The switch** (`kit/lib/config.test.mjs`, the init tests): `answers.enabled` defaults to `true`,
  a non-boolean is refused, and `omni init` writes `answers: { enabled: true }`.
- **The command** (`kit/bin/answers.test.mjs`, through `main()` on a fixture repository, with a fake
  comment client):
  - `ask` takes the numbers from the outbox comment's marker, batches at most four, puts
    human-action first, leaves mediums out, and exits 1 with one line when nothing is open or the
    switch is off.
  - `post` posts once and prints the link. `--print` posts nothing. A refused pick exits 1 and
    posts nothing. A failed post exits 1 and prints the reply.
- **The comment** (`kit/lib/outbox/comment.test.mjs`): the Omni page line is there with the switch
  on and `ask.url` set, and absent otherwise.
- **The skill** (`kit/test/plugin.test.mjs`): `/omni:yolo` names `omni answers`, the opening
  question's three choices and the yolo-fix steps it follows, and `no-game-words` and `no-literals`
  stay green.
- **The reader** (`apps/galaxy/src/dossier/github/reader.test.ts`, a fake GitHub): the numbering
  comes from the outbox comment; pending answers come from `planReplies`, with who, when, the link
  and whether the author counts; the latest reply per number wins; a comments read that fails
  leaves the outbox shown and the pending answers `UNREAD`.
- **The access rules** (`supabase/checks/outbox_sends.sql`, in the `supabase` workflow): a send is
  read only by its owner, only a member of the dossier's workspace inserts one, and
  `outbox_send_done()` records an outcome once, for its owner only.
- **Send** (`apps/galaxy/src/outbox/send.test.ts`, a fake GitHub): the reply is built from checked
  picks; a pick settled meanwhile is dropped; a non-member is refused; a wrong nonce, or another
  person's send, posts nothing; a replayed callback posts nothing a second time; the token is never
  written to a cookie, a row or a log; an uncounted `author_association` is reported; each failure
  keeps the picks and records the error; a posted send clears the dossier's cached summary.
- **The pages** (component tests): the Outbox tab in each state of the table, wide and tall; a
  decision card, a human-action card, an answered card, the Adopted and Settled groups; Select every
  recommendation never marks a human-action; the `/prd` badge and filter; `/prd/at/…` redirects or
  answers not found.

## Risks

- **What merging publishes** (`omni kb show releasing`):
  - A migration on the production Supabase project (`outbox_sends` and one function), through the
    `supabase` workflow's `deploy` job.
  - The kit, through `kit/dist/omni.mjs`, the release and the plugin marketplace: the yolo skill now
    asks at the end when its gate is red.
  - The galaxy's tab, send flow and short address, with two new server-only environment variables:
    the App's `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`. `SUPABASE_SERVICE_ROLE_KEY` and
    the App's key are already set (PRD 359).
- **A person must change the omni-loop App's settings** before the page can send: add the callback
  URL `<galaxy>/prd/github/callback`. The App already has `issues: write` and `pull_requests:
  write`. Until then, the tab reads and Send fails with GitHub's reason.
- **The kit's default turns the terminal question on in every repository** that upgrades the kit.
  An unattended yolo now waits at its opening question instead of ending. Everything it had to write
  is written before it asks, and `answers.enabled: false` restores today's ending.
- **The config key and the App.** A repository that writes `answers:` needs an App built from a kit
  that knows the key. `omni init` writes it for new installs; the App deploys from `main` with the
  kit, so it knows the key once this merges.
- **More GitHub reads.** The reader keeps what it already fetches; the `/prd` count reads each
  listed PRD's summary through the same 60-second cache.
- **P-PRODUCT-3** says the gate stays red until a person answers and no agent overrides it on
  anyone's behalf. The terminal door posts only what the person picked, under their own GitHub
  account, and Select every recommendation never sends by itself.
- **Rollback:** `answers.enabled: false` stops the terminal question and the comment's line at once.
  Reverting the galaxy takes Send away; the migration only adds a table and a function, and a
  follow-up migration drops them.

## Acceptance criteria

No acceptance harness in this repository (`acceptance.enabled` is false). Each criterion becomes an
ordinary test, or a manual step recorded with screenshots in the last slice's sub-PR.

1. With the switch on, `/omni:yolo` ending red asks the opening question with its three choices
   after the draft pull request, the outbox comment and the status comment are written.
2. Answering here asks only the `human-action` and `high` questions, at most four at a time, and
   posts one reply on the feature pull request under the person's account, in the numbering the
   pull request shows.
3. After that reply, the same run settles it: `settled.md` names the person as approver and the
   reply's link as channel URL, a drifted answer is reworked, and a green gate leaves the pull
   request ready.
4. *Carry on* after answering on the Omni page settles those answers the same way. *Later* stops as
   today.
5. With the switch off, `/omni:yolo` ends as today, and the outbox comment has no Omni page line.
6. The Outbox tab shows the open questions in the pull request's numbering, the adopted ones, the
   pending answers (with who, where and when) and the settled entries, within a minute of a push or
   a comment.
7. The Outbox tab shows the before/after page, the spec and the brainstorm answers beside the
   questions on a wide screen, and behind a Context disclosure on a tall one.
8. Send posts one reply on the feature pull request as the person, with no prompt after the first
   authorisation, and `/omni:yolo-fix` settles it like a reply typed on GitHub.
9. A reply typed on GitHub shows as pending on the tab, and the latest answer wins.
10. An objection to an adopted medium sent from the tab is appended by `/omni:yolo-fix` as a
    `drifted` entry for that item.
11. A pick whose question was settled meanwhile is dropped before posting, and the tab says so.
12. A reason cannot add a marker or a second answer line to the reply.
13. A person who is not a member of the dossier's workspace cannot send; a signed-out visitor sees
    the questions read-only.
14. `/prd` shows `n open` on each PRD with open questions, and *Needs an answer* keeps only those.
15. The outbox comment links the Omni page with the switch on and `ask.url` set.
