# Ask mode — one page, a tab per terminal — plan

**PRD:** #142 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/ask-tabs` → `main`
(`Closes #142`) · **Sub-PRs:** `feat/ask-tabs--<slice>` → the feature branch (`Part of #142`).

Any decision taken without asking is an outbox item. The contract under `/api/ask/*` does not
change: the kit slice (s1) and the page slices (s2, s3) meet only through it and through the
database's existing rows. A slice that needs to change the contract raises an outbox item instead
of editing another slice's files.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Each terminal gets its own ask session and each question its own round. The kit's local state becomes `ask.json` `{ host }`, `ask/<session_id>.json` and `ask/rounds/<tool_use_id>.json`. `pre` opens the terminal's session lazily; `post` touches only its own round; `closed` clears only its own terminal; a new `end` hook (SessionEnd) closes its session. `on` writes the flag and prints `<ask.url>/ask`; `off` closes every session of the checkout. The `/omni:ask` skill, the kit README lines and the rebuilt bundle follow | `kit/lib/ask/hook` `kit/lib/ask/local-state` `kit/lib/ask/mode` `kit/bin/commands/ask.mjs` `kit/bin/ask.test.mjs` `kit/bin/ask-hook.test.mjs` `kit/test/fake-ask-server.mjs` `kit/plugin/hooks/` `kit/plugin/skills/ask/` `kit/README.md` `kit/dist/omni.mjs` | — | 1 |
| s2 | The person's page: `/ask` lists every open ask session they own as vertical tabs (title, latest header, needs you · age or working, a badge), sorted with the ones that need them first, and selects the first. `/ask/<id>` is the same page with that tab selected (a closed one read-only at the end). The browser title counts the tabs that need the person. The page never switches tabs by itself. The pane is PRD 71's, unchanged. An empty state names `/omni:ask on`. The demo plays several terminals | `apps/galaxy/app/ask/page.tsx` `apps/galaxy/app/ask/callback/` `apps/galaxy/app/ask/[session]/` `apps/galaxy/src/ask/page/` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/ask/theme-tokens.test.ts` | — | 1 |
| s3 | On a phone, below 720 px, the tab list folds into one row at the top ("Terminals (3) · 1 needs you"); opening it shows the list and picking a tab closes it. Then the live proof: two Claude Code terminals in one checkout, against the feature's preview deployment, each answered in its own tab | `apps/galaxy/src/ask/page/` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/ask/theme-tokens.test.ts` | s1, s2 | 2 |

**Shared ground.**
- `apps/galaxy/src/ask/page/`, `apps/galaxy/src/ask/ask.css` and
  `apps/galaxy/src/ask/theme-tokens.test.ts` are declared by s2 and s3, in waves 1 and 2. s3 folds
  the tab list s2 builds, so it goes after s2.
- Every other prefix is held by one slice. `kit/dist/omni.mjs` is s1's alone: no other slice
  changes kit code.

The ordering has reasons behind it:
- s3 needs s1 because the live proof needs the kit's per-terminal sessions.
- s3 needs s2 because it folds s2's tab list.
- PR #140 (the ask page's scroll fix) is a standalone PR into `main` that also touches `ask.css`.
  Whichever lands second merges `main` and keeps both rules.

## Per slice: done when

**s1**
- `.omni-loop/local/ask.json` holds `{ host }` after `omni ask on`. An `ask.json` in PRD 71's shape
  still reads as on.
- `omni ask on` prints `<ask.url>/ask` and makes no call that opens or closes a session. Run twice,
  it changes nothing. Without a sign-in it exits 1 naming `omni signin`, as today.
- Against `kit/test/fake-ask-server.mjs`:
  - two `pre` hooks with different `session_id`s and questions in flight together open two
    sessions, and each prints its own answer;
  - a second question from the same `session_id` reuses its session;
  - `post` for one `tool_use_id` never reads or deletes another's round file, and posts a terminal
    answer to its own round;
  - a `closed` wait deletes only that terminal's session file, the mode stays on, and the next
    question opens a new session;
  - `hook end` closes only its own terminal's session and deletes its file;
  - `pre` with no `session_id`, or one that is not a safe file name, prints nothing and opens
    nothing.
- `omni ask off` closes every session named under `ask/` and the PRD 71 session when `ask.json`
  holds one, deletes `ask.json` and `ask/`, and prints `off`. `status` prints `<ask.url>/ask` or
  `off`.
- `kit/plugin/hooks/hooks.json` registers `SessionEnd` running `omni ask hook end`.
- The `/omni:ask` skill and `kit/README.md` say the mode is per checkout, the page has a tab per
  terminal, and `on` no longer replaces anything.
- `pnpm test` is green, including `kit/test/dist.test.mjs` after `pnpm kit:build`.

**s2**
- A pure tab model (tested) gives, from the sessions and their newest rounds and the time:
  - each tab's title, header, state and age;
  - the order: needs you first, oldest question first, then most recently active;
  - the count for the browser title;
  - the tab `/ask` selects.
- A list reader (tested against a stubbed database) reads the signed-in person's sessions that are
  open and seen within 12 hours, with each one's newest round.
- `/ask` signed out shows the sign-in card, which comes back to `/ask`. Signed in with no open
  session, it shows the empty state naming `/omni:ask on`.
- `/ask/<id>` selects that tab. A PRD 71 link still opens. A closed session opens read-only as the
  last tab. Another person's session is not found.
- A question arriving in an unselected tab badges it and changes the browser title, never the
  selection (tested on the page's state).
- From 720 px, the tabs sit beside the pane (a layout rule in `theme-tokens.test.ts`), and the page
  scrolls.
- In development without a database, the demo shows three terminals, one needing the person.

**s3**
- Below 720 px, the tab list is one row showing the count and how many need the person. Opening it
  lists the tabs; picking one selects it and closes the list (tested on the page's state, and a
  layout rule in `theme-tokens.test.ts`).
- Live proof, recorded in the sub-PR:
  - two Claude Code terminals in one checkout with ask mode on, against the feature's preview
    deployment, both ask a question;
  - both show as tabs on `/ask`, and each answer reaches its own terminal;
  - closing one terminal removes its tab on the next poll.
- `pnpm test` is green.
