---
prd: 251
title: Answer the outbox anywhere — at the end of yolo, beside the PRD in the app, or on the pull request
blocked-by: [216]
spec: file
---

# Answer the outbox anywhere: at the end of yolo, beside the PRD in the app, or on the pull request

**Date:** 2026-09-27 · **PRD:** #251 · **Touches:** `kit/` (the switch, a command, the reply
writer, the yolo skill, `omni init`), `apps/omni-app` (a new event, the relay), `apps/galaxy` (a
contract, the Outbox tab, the send flow, the redirect), `supabase/`, a decision record · **Blocked
by:** #216 (PRD dossiers). Its `/prd/<id>` page, its `dossiers` table and its brainstorm rounds are
what the Outbox tab stands on.

## Problem

`/omni:yolo` builds a PRD with nothing asked along the way. Every decision a coding agent took alone
is an **outbox item**: `human-action` and `high` items keep the outbox check red, and `medium` items
are adopted the moment they are raised (a merge ratifies them). A person then has to answer. Today
there is exactly one place to do that, and it is the least comfortable one.

- **Only the pull request takes answers.** The omni-loop App posts the questions as one comment on
  the feature pull request, and a person replies `1: A`, `2: B because …` or `go with
  recommendation`. There is no way to answer in the Omni page, and none in the terminal where the
  yolo just ended.
- **The context is somewhere else.** Answering well needs the spec, the before/after page and the
  answers the brainstorm gave. PRD 216 puts those on `/prd/<id>`, but the questions are not there:
  the person answers on GitHub from memory, or with three tabs open.
- **The end of a yolo is a dead end.** When the gate is red, `/omni:yolo` stops and says "answer on
  the pull request". The person who is sitting at that terminal then has to leave it, answer on
  GitHub, come back and run `/omni:yolo-fix`.

## Solution

Three doors, one record. A question can be answered **in the terminal** at the end of
`/omni:yolo`, **in the Omni page** on the PRD's dossier, or **on the pull request** as today. Every
door ends in the same thing: one reply on the feature pull request, written by the person, in the
grammar `omni replies` already reads. So `/omni:yolo-fix`, the ledger and the outbox check do not
change.

```
 terminal (end of /omni:yolo)       the Omni page (/prd/<id> · Outbox)     GitHub (the feature PR)
   AskUserQuestion                    pick options, Send                     type `1: A`
   omni answers post                  posted as you (GitHub authorisation)
        └──────────────────► one counted reply on the feature PR ◄──────────────────┘
                                           │
                    omni replies (/omni:yolo-fix) settles → settled.md   (unchanged)
                                           ▲
 omni-loop App: evaluates the outbox on every push and every new comment (as today, plus comments),
                and sends the Omni page what it evaluated, so the Outbox tab is always current
```

### The switch

`.omni-loop/config.yml` takes `answers: { enabled: <boolean> }`.

- **The kit's default is `true`,** and `omni init` writes the key into every new config.
- **This repository does not write the key**: it takes the default. The deployed App parses the
  config with the kit it was built with, which refuses a key it does not know, so writing it here
  before the App is redeployed would turn every pull request's outbox check red.
- **When it is on:** `/omni:yolo` asks at the end (below), and the App sends the outbox to the Omni
  page when the repository's `ask.url` is the page it is configured for.
- **When it is off:** `/omni:yolo` ends as it does today, and the App sends nothing. The pull
  request still takes replies, and every outbox the page already stored stays readable.

### The reply, written once

`kit/lib/outbox/answers.mjs` holds the one **reply writer**. It is pure, and the kit, the App and
the galaxy all import it, so every door writes identical lines.

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
  removed, and it is cut to 500 characters. So no reply can carry an outbox marker (which would make
  `omni replies` ignore it) or smuggle in a second answer line.
- **The contract with the reader is a test:** whatever the writer writes, `planReplies` reads back
  as the same answer, for every kind of pick.

### Door 1: the terminal, at the end of `/omni:yolo`

**`omni answers`**, a command with two verbs:

| verb | what it does | exit |
|---|---|---|
| `omni answers ask <prd> --pr <n> [--json]` | Reads the feature pull request's comments, takes the numbering from its outbox comment (the App's, or `omni comment`'s: the same numbers the pull request shows), and prints the open `human-action` and `high` questions in batches of at most four, `human-action` first, then by number. Each question carries its number, its item id, a header (`Q19 · action`, `Q1 · high`), its text (the question and the decision, in plain words) and its options: `A · built` with its text, then `B`, `C` and `D`; or `Done` and `Not done`. | `0` printed · `1` nothing to ask, or the switch is off (one line says which) · `2` usage, or the kit is not installed here |
| `omni answers post --prd <n> --pr <n> --answers <file> [--print]` | Reads the picks from a JSON file, writes the reply with the reply writer, and posts it on the pull request through the same client `omni replies` uses. Prints the comment's link. `--print` prints the reply and posts nothing. | `0` posted · `1` refused (the writer's reason) or the post failed, and the reply is printed so it can be pasted · `2` usage |

Mediums are never asked here: they are already adopted, and anyone who objects does so in the Omni
page or on the pull request.

**`/omni:yolo`, when its gate ends red and `answers.enabled` is on.** It first does everything it
does today on that path: the outbox comment, the draft pull request, the status comment. Nothing is
lost if the person walks away. Then it asks **one opening question**:

> *3 questions keep the outbox red.* — **Answer here now** · **Answered in the Omni page or on the
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
- **With ask mode on,** these questions go to the ask page like any other, and PRD 216's delivery
  rule shows them on the dossier's Questions tab.
- The changes to the skill are recorded in its porting note (`kit/porting/plugin--yolo.md`).

### Door 2: the Omni page

#### The App sends the outbox

- **A new event.** The App also subscribes to `issue_comment` (`created`, `edited`, `deleted`). A
  comment on a pull request re-runs the outbox check exactly as a push does. A comment on an issue,
  and one the App wrote itself, does nothing. This is what shows the page an answer typed on
  GitHub.
- **After it publishes** the check and the comment, the `outbox-check` function takes one more step,
  `relay`. When the base branch's config has `answers.enabled` on, and `ask.url`'s host is the host
  of the App's `OMNI_PAGE_URL`, it sends `POST <OMNI_PAGE_URL>/api/outbox`:
  - **Signed:** `X-Omni-Signature: sha256=<HMAC-SHA256 of the raw body>`, keyed with
    `OMNI_OUTBOX_SECRET`, which the App and the galaxy share.
  - **The body:** `{ repo, prd, pr: { number, url, headSha, state }, evaluatedAt, numbering,
    open, adopted, pending, settled }`:
    - `open`: every open item, its number and its file's text verbatim.
    - `adopted`: every adopted item that has a number, with its item's text, so a person can object.
    - `pending`: what the replies say that nobody has settled yet, one per number: the text, who
      wrote it, when, and the comment's link. It is `planReplies`, run on the comments the check
      already read.
    - `settled`: every settled entry, with its verdict, who approved it, when, its channel and its
      answer.
- **A merged or closed pull request** gets one last send with `state` `merged` or `closed`, from the
  `pull_request.closed` delivery the App already receives.
- **The relay never changes the check.** Its conclusion and the comment are published before it
  runs. A failed send is retried as an Inngest step, then logged. The page keeps the last outbox it
  had.

#### The page keeps the latest outbox

`POST /api/outbox`, on the galaxy:

- **It checks first:** the signature in constant time, then the body's shape (Zod), with a cap of
  2 MiB. A bad signature is 401, a malformed body 400, a larger one 413.
- **It finds or creates the PRD's dossier** by PRD 216's key: the workspace whose `github_org` owns
  the repository, the repository, and the PRD number. No such workspace is 404, and the App logs it.
  A dossier made this way has no artifacts until the kit or PRD 216's fallback pushes them.
- **It keeps only the latest outbox:** an `evaluatedAt` older than the stored one changes nothing
  and answers 200 with `stale: true`.
- **It answers** `200 { id, url }`, where `url` is the dossier's Outbox tab.

**Data.** One migration, after PRD 216's:

```sql
create table public.dossier_outboxes (
  dossier_id    uuid primary key references public.dossiers on delete cascade,
  pr_number     integer not null check (pr_number > 0),
  pr_url        text not null,
  head_sha      text not null,
  state         text not null check (state in ('open', 'merged', 'closed')),
  outbox        jsonb not null,           -- numbering, open, adopted, pending, settled, as sent
  evaluated_at  timestamptz not null,
  received_at   timestamptz not null default now()
);
```

- **Writes** go only through the security-definer function `dossier_outbox_put()`, which finds or
  creates the dossier, applies the newer-only rule, and upserts, all under a lock on the dossier.
  The route calls it with a server-only key, `SUPABASE_SERVICE_ROLE_KEY`, which is new on the
  galaxy's project and never reaches a browser.
- **Reads:** a member of the dossier's workspace reads its outbox (`is_member(workspace_id)`), and
  anyone else reads nothing. There is no other write, update or delete.
- `dossier_list()` (PRD 216) gains `open_questions`: the number of open items in the dossier's
  outbox, 0 when it has none.

The same migration adds the sends the Omni page posts:

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

#### The Outbox tab

`/prd/<id>` gets a fifth tab, after Questions: **Outbox**, with `n open` in its label
(`?tab=outbox`). The page's first tab stays Before/after.

- **Wide:** the questions on the left and a **context rail** on the right. The rail switches
  between **Before/after** (the sandboxed frame of PRD 216), **Spec** (rendered, raw HTML off) and
  **Brainstorm** (the dossier's brainstorm rounds, each question with its answer). It stays where it
  is while the person moves through the questions. **Tall:** the rail becomes a Context disclosure
  above the questions, with the same three switches.
- **A decision card** shows the number and the rank, the intro and the punchline when the item has
  them, the question and the decision in plain words, the options as a radio group (A marked
  `built · recommended`), an optional reason, the `bears-on` entries as chips linking to
  `/knowledge`, and one disclosure for *What I had to decide*, *What I did meanwhile*, *What it
  costs to change later* and *What I could not know*. Item text is rendered with PRD 216's
  markdown renderer, raw HTML off.
- **A human-action card** shows its steps, then **Done** or **Not done**. Not done needs a reason.
- **An answered card** shows its pending answer: what it said, who, where (the Omni page, the
  terminal, or GitHub) and when. It can be answered again: the latest reply wins, as `omni replies`
  already rules.
- **Adopted mediums** sit in one collapsed group, *Adopted unless you object · n*. Each has
  **Object**, which opens its other options and a reason.
- **Settled** sits in another collapsed group: each entry's verdict, who approved it, and its
  answer.
- **The toolbar:** **Select every recommendation** picks A on every open decision and nothing else:
  it never marks a human-action done, and the person still sends. **Send n answers** posts them.
  Picks survive a reload (the browser's storage, a convenience only).
- **The states:**

  | state | the tab shows |
  |---|---|
  | no outbox stored | *No outbox yet. It appears once the feature pull request opens and the omni-loop App has checked it.* |
  | nothing open | *Nothing is waiting on you*, then Adopted and Settled |
  | merged or closed | read-only, with *The feature pull request merged on <date>: what was still open was adopted.* (or *closed*) |
  | the read failed | *The outbox is out of reach*, and the other tabs are unchanged |
  | demo | a demo outbox, with Send off and saying so |

- **`/prd`** shows `n open` on each row whose outbox has open items, and a **Needs an answer**
  filter.
- **A short address** for the kit and the App: `/prd/at/<owner>/<repo>/<n>` redirects to the
  dossier's Outbox tab, or to not found. The outbox comment gets one line under its header:
  *Answer here, or on the Omni page: `<ask.url>/prd/at/<owner>/<repo>/<n>`*, written by
  `formatOutboxPrComment` only when `answers.enabled` is on and `ask.url` is set. The kit still
  never names the galaxy.

#### Send posts the reply as you

1. **Send** calls `POST /api/outbox/send` with the picks, as the signed-in person. The server
   checks each pick against the stored outbox, drops a pick whose question is no longer open or
   adopted (*settled meanwhile*), and writes the reply with the reply writer. It records the reply
   as a **send**: one row of `outbox_sends` (below), which only its owner reads.
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
   `/omni:yolo-fix <n>`, with a copy button. The just-sent answers show as pending at once, until
   the App's next outbox, a few seconds later, replaces them.
6. **When GitHub lists the person as someone whose reply the kit does not count** (the comment's
   `author_association` is not `OWNER`, `MEMBER` or `COLLABORATOR`), the tab says so, and that
   `/omni:yolo-fix` will not read the reply.
7. **When anything fails** (the authorisation refused, `state` wrong, GitHub down, no access, the
   pull request gone), no comment is posted, the picks stay, and the tab names why and offers to
   try again.

### Door 3: the pull request

Unchanged: a reply typed on the pull request works as it does today. The App now re-checks on it, so
the page shows it as pending within seconds.

## Decisions

1. **The pull request stays the one record.** Every door ends as a person's reply on the feature
   pull request, so `omni replies`, the ledger, `/omni:yolo-fix` and the outbox check change in
   nothing.
2. **The App carries the outbox to the page.** It already evaluates every feature pull request with
   the base config, the head's delivery folder and the comments. So the page is current after every
   push and every comment, from a laptop or a cloud session, with no sign-in and no GitHub read in
   the galaxy.
3. **An answer from the page posts as the person,** through a user authorisation of the omni-loop
   App, which is used once and never stored. A reply from the App's bot would not count, and making
   the kit trust the bot would let anyone holding the App's key answer for anyone.
4. **One switch, `answers.enabled`, on by default,** and written by `omni init`. This repository takes
   the default rather than writing the key, until the App runs a kit that knows it.
5. **The terminal asks at the end of `/omni:yolo`, never along the way,** and only once it has
   finished everything else: one opening question, then the `human-action` and `high` questions.
   Mediums are never asked there.
6. **Answering carries on into the yolo-fix steps in the same run,** so one command goes from a PRD
   to a pull request ready for review, when the person is there to answer.
7. **The page keeps only the latest outbox per PRD.** The ledger on the branch is the history; the
   page shows its settled entries.
8. **One reply writer, in the kit,** imported by the App and the galaxy, and proven against
   `planReplies` by a test. A reason is one line of at most 500 characters, with no marker.
9. **The Outbox tab shows the PRD beside the questions:** a context rail with the before/after page,
   the spec and the brainstorm, not a reminder to open other tabs.
10. **Select every recommendation only pre-selects,** and never marks a human-action done: a
    person's check is never ticked for them.

## User stories

- As a PM, my yolo ends red at the terminal. It asks me the three questions that block it, I answer
  them there, and the same run settles them, reworks the one I disagreed with, and leaves the pull
  request ready.
- As a PM on my phone, I open the link in the outbox comment, read the before/after page beside
  question 1, choose B with a reason, and press Send. The reply appears on the pull request under my
  name.
- As a PM whose yolo is waiting at its opening question, I answer in the Omni page, go back to the
  terminal and choose *carry on*.
- As a product owner, I object to an adopted medium from the Outbox tab, with the spec open beside
  it.
- As an engineer, I reply `2: A` on GitHub as always, and the Omni page shows my answer as pending a
  few seconds later.
- As a repository owner, I set `answers.enabled: false`, and yolo ends as before and nothing is
  sent to the Omni page.

## Scope

**In:**
- The switch, and `omni init` writing it (`kit/lib/init/config-text.mjs`).
- The reply writer and `omni answers ask` / `post`.
- `/omni:yolo`'s opening question and carrying on into the yolo-fix steps, and its porting note.
- The outbox comment's line pointing at the Omni page, and its porting note
  (`kit/porting/outbox--comment.md`).
- The App's `issue_comment` event, its `relay` step, and its last send on close.
- `POST /api/outbox`, the migration (`dossier_outboxes`, `dossier_outbox_put()`, `outbox_sends`,
  `outbox_send_done()`), and `dossier_list()`'s open count.
- The Outbox tab with its context rail, the `/prd` badge and filter, and `/prd/at/…`.
- Send, through the omni-loop App's user authorisation.
- A decision record for Decisions 1 to 3, and the kit, galaxy and App READMEs' lines.

**Out:**
- Starting `/omni:yolo` or `/omni:yolo-fix` from the Omni page.
- The arcade: no planet tab, no scene.
- Asking mediums in the terminal.
- Keeping every outbox the App sends: only the latest is kept.
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
  - `ask` takes the numbers from the App's comment marker, batches at most four, puts human-action
    first, leaves mediums out, and exits 1 with one line when nothing is open or the switch is off.
  - `post` posts once and prints the link. `--print` posts nothing. A refused pick exits 1 and
    posts nothing. A failed post exits 1 and prints the reply.
- **The comment** (`kit/lib/outbox/comment.test.mjs`): the Omni page line is there with the switch
  on and `ask.url` set, and absent otherwise.
- **The skill** (`kit/test/plugin.test.mjs`): `/omni:yolo` names `omni answers`, the opening
  question's three choices and the yolo-fix steps it follows, and `no-game-words` and `no-literals`
  stay green.
- **The App** (`apps/omni-app`, against a stubbed GitHub and a stubbed page):
  - `issue_comment` on a pull request triggers the check; on an issue, or written by the App, it
    does not.
  - The relay body is built from what the check evaluated: open, adopted, pending (from
    `planReplies`) and settled, and it is signed with the secret.
  - It sends nothing with the switch off or `ask.url` on another host. A failed send never changes
    the check's conclusion or the comment. A merged pull request gets its last send with `merged`.
  - `test/app-yml.test.mjs` lists `issue_comment` and nothing else new.
- **The route** (`apps/galaxy/src/outbox/api.test.ts`, fake store, the `world()` pattern): a good
  body is stored and answers the Outbox address; a bad signature 401; a malformed body 400; 2 MiB
  413; an older `evaluatedAt` changes nothing; no workspace for the owner 404; the dossier is found
  or created by its key.
- **The access rules** (`supabase/checks/dossier_outboxes.sql`, in the `supabase` workflow):
  - A member reads an outbox, a member of another workspace reads nothing, nobody writes the table
    directly, and `dossier_outbox_put()` refuses an older evaluation.
  - A send is read only by its owner, only a member of the dossier's workspace inserts one, and
    `outbox_send_done()` records an outcome once, for its owner only.
- **Send** (`apps/galaxy/src/outbox/send.test.ts`, a fake GitHub): the reply is built from checked
  picks; a pick settled meanwhile is dropped; a wrong nonce, or another person's send, posts
  nothing; a replayed callback posts nothing a second time; the token is never written to a
  cookie, a row or a log; an uncounted `author_association` is reported; each failure keeps the
  picks and records the error.
- **The pages** (component tests): the Outbox tab in each state of the table, wide and tall; a
  decision card, a human-action card, an answered card, the Adopted and Settled groups; Select every
  recommendation never marks a human-action; the `/prd` badge and filter; `/prd/at/…` redirects or
  answers not found.

## Risks

- **What merging publishes** (`omni kb show releasing`):
  - A migration on the production Supabase project, through the `supabase` workflow's `deploy` job.
  - The kit, through `kit/dist/omni.mjs` and the plugin marketplace: the yolo skill now asks at the
    end when its gate is red.
  - The galaxy's route, tab and send flow, with four new server-only environment variables on its
    project: `SUPABASE_SERVICE_ROLE_KEY`, `OMNI_OUTBOX_SECRET`, and the App's `GITHUB_APP_CLIENT_ID`
    and `GITHUB_APP_CLIENT_SECRET`.
  - The App, with a new event and two environment variables (`OMNI_PAGE_URL`, `OMNI_OUTBOX_SECRET`).
- **A person must change the omni-loop App's settings** before the page can send: add the callback
  URL `<galaxy>/prd/github/callback`, allow user authorisation, and accept the `issue_comment`
  event on each installation. Until then, the page shows questions only after a push, and Send
  fails with GitHub's reason.
- **The kit's default turns the terminal question on in every repository** that upgrades the kit.
  An unattended yolo now waits at its opening question instead of ending. Everything it had to write
  is written before it asks, and `answers.enabled: false` restores today's ending.
- **The config key and the App.** A repository that writes `answers:` needs an App built from a kit
  that knows the key. `omni init` writes it only for new installs.
- **P-PRODUCT-3** says the gate stays red until a person answers and no agent overrides it on
  anyone's behalf. The terminal door posts only what the person picked, under their own GitHub
  account, and Select every recommendation never sends by itself.
- **The page holds a service key** for one function. It is server-only, and the route is the only
  code that uses it.
- **Blocked by PRD 216.** The tab, the dossier key and the brainstorm rounds are its. This PRD is
  built on the default branch once #219 has merged.
- **Rollback:** `answers.enabled: false` stops the terminal question and the App's sends at once.
  The migration only adds a table and a function; a follow-up migration drops them. An App without
  the relay sends nothing, and the page shows its last outbox.

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
4. *Carry on* after answering in the Omni page settles those answers the same way. *Later* stops as
   today.
5. With the switch off, `/omni:yolo` ends as today, and the App sends nothing.
6. Within a minute of a push or a comment on the feature pull request, its PRD's Outbox tab shows the
   open questions, the adopted ones, the pending answers (with who, where and when) and the settled
   entries.
7. The Outbox tab shows the before/after page, the spec and the brainstorm answers beside the
   questions on a wide screen, and behind a Context disclosure on a tall one.
8. Send posts one reply on the feature pull request as the person, with no prompt after the first
   authorisation, and `/omni:yolo-fix` settles it like a reply typed on GitHub.
9. A reply typed on GitHub shows as pending on the tab, and the latest answer wins.
10. An objection to an adopted medium sent from the tab is appended by `/omni:yolo-fix` as a
    `drifted` entry for that item.
11. A pick whose question was settled meanwhile is dropped before posting, and the tab says so.
12. A reason cannot add a marker or a second answer line to the reply.
13. A member of another workspace gets not found on the tab, and the outbox route refuses a body
    whose signature does not match.
14. `/prd` shows `n open` on each PRD with open questions, and *Needs an answer* keeps only those.
15. The outbox comment links the Omni page with the switch on and `ask.url` set.
