# Plan: Waiting-for-you notifications

PRD #499, with the spec beside this plan (`spec.md`). The feature branch `feat/waiting-notifications`
merges into `main` with `Closes #499`. Each slice is a sub-PR from
`feat/waiting-notifications--<slice>` into the feature branch, with `Part of #499`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every app-shell page holds the waiting list's Questions part (own sessions' open rounds and shared ones, de-duplicated), rendered by the server and re-read every 5 s while visible: the tab title carries `(N) `, **Questions** and **Shared with me** carry live counts, and `/ask` no longer sets `● (N) Claude asks`. The list's item type already holds the outbox kind, empty for now | `apps/galaxy/src/waiting/` `apps/galaxy/src/nav/AppShell` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/sidebar` `apps/galaxy/src/nav/viewer` `apps/galaxy/src/nav/AppBar.test.ts` `apps/galaxy/src/nav/UserMenu.test.ts` `apps/galaxy/src/ask/page/tabs` `apps/galaxy/src/ask/page/AskPage` `apps/galaxy/src/ask/page/AskQuestion` `apps/galaxy/src/ask/page/poll` `apps/galaxy/src/ask/page/render.test.ts` `apps/galaxy/app/app/layout.tsx` `apps/galaxy/app/ask/layout.tsx` `apps/galaxy/app/prd/layout.tsx` `apps/galaxy/app/knowledge/layout.tsx` | — | 1 |
| s2 | `GET /api/waiting/outbox` answers a signed-in person with the open `human-action` and `high` outbox items of the numbered dossiers they opened (at most 30, newest first) whose feature PR is open, plus how many could not be read; 401 signed out | `apps/galaxy/app/api/waiting/` `apps/galaxy/src/outbox-waiting/` | — | 1 |
| s3 | The waiting list gains its Outbox part, read from the route once after load and every 60 s while visible: **PRDs** carries its count, the title's count includes it, the tab icon shows the red dot while the count is above 0, and a failed read keeps the last items | `apps/galaxy/src/waiting/` `apps/galaxy/src/nav/Sidebar` `apps/galaxy/src/nav/sidebar` | s1, s2 | 2 |
| s4 | The top bar's bell, between Game mode and the avatar: its count badge and accessible name, and its panel listing the Questions and Outbox groups (links to `/ask/q/<round>` and `/prd/<id>?tab=outbox`), "Nothing waiting for you.", a part that could not be read, closing on Escape, outside click or choice, full width on a phone | `apps/galaxy/src/nav/Bell` `apps/galaxy/src/nav/bell` `apps/galaxy/src/nav/AppBar` `apps/galaxy/src/nav/app-bar` | s1 | 2 |
| s5 | Alerts for what is new: the Desktop alerts and Chime switches at the foot of the bell's panel (off by default, kept per browser), one desktop notification per new item tagged by its id, one chime per read across tabs, nothing for what waited at load | `apps/galaxy/src/waiting/` `apps/galaxy/src/nav/Bell` `apps/galaxy/src/nav/bell` | s3, s4 | 3 |

**Shared ground.**
- `apps/galaxy/src/waiting/` (the provider, the list, the title, the icon and the alerts) is declared
  by s1, s3 and s5, one per wave (1, 2, 3). s1 creates the provider and the Questions part, s3 adds
  the Outbox part and the icon, s5 adds the alerts.
- `src/nav/Sidebar` and `src/nav/sidebar` are s1's and s3's, in waves 1 and 2: s1 adds the Questions
  badge and makes Shared with me live, s3 adds the PRDs badge.
- `src/nav/Bell` and `src/nav/bell` are s4's and s5's, in waves 2 and 3: s4 draws the bell and its
  panel, s5 adds the switches to its foot.
- s3 and s4 share wave 2 and no prefix: s4 reads the list through the provider's hook, which s1
  ships with the outbox kind already in the item type, so the Outbox group renders from s4's own
  fixtures and fills once s3 merges.
- `src/nav/AppBar.test.ts` builds a viewer: s1 renames its `forMe` field in wave 1, s4 adds the bell's cases in wave 2.
- s2 owns its own folder, `src/outbox-waiting/`, so it shares nothing with s1 in wave 1.

## Per slice: done when

**s1: the Questions part, live on every page**
- A pure test pins the merge: own open rounds plus shared ones, one entry per round id, oldest
  first; the count is the number of entries.
- A pure test pins the title: `(N) ` prefixed to the page's title above 0, replaced when N changes,
  never doubled, removed at 0.
- `poll.test.ts` pins a 5 s interval with a fake clock, and a read at once when the tab shows again.
- `viewerLive()` returns `waiting` (the Questions part as rendered); `ViewerView.forMe` is gone and
  nothing reads it.
- Render tests of the sidebar: **Questions** shows the Questions count, **Shared with me** the shared
  count, no badge at 0, and `aria-label`s "Questions: N waiting".
- `tabsTitle` returns `Claude asks · OMNI LOOP` whatever the count, and `AskQuestion` sets no `● `.
- By hand: with `/prd` open, a question asked from a terminal with ask mode on shows `(1) ` and the
  Questions badge within 10 s, with no reload, and they clear within 10 s of answering.

**s2: the outbox route**
- The handler, called with a fake Supabase client and a stubbed `GithubReader`, gives:
  - signed out: 401;
  - no dossiers: `items: []`, `unread: 0`;
  - an open feature PR with a `human-action`, a `high` and a `medium` item: the first two only;
  - a merged or absent feature PR: no items;
  - 31 dossiers: 30 summaries asked, the newest;
  - one summary failing: `unread: 1`, the others' items kept;
  - no reader configured: `items: []`, `unread` equal to the dossiers listed.
- The dossiers are read as the signed-in person, filtered on `opened_by` and a PRD number; no
  service key is read.

**s3: the Outbox part, the PRDs count and the tab icon**
- A pure test pins the outbox part: read once after load, then every 60 s while visible, never
  twice within 60 s; a failed read keeps the last items and marks the part unreadable.
- The count and the title include the outbox items.
- A pure test pins the icon: the dotted data URL above 0, the crest's URL at 0.
- Render test of the sidebar: **PRDs** shows the outbox count, none at 0.
- By hand: the red dot shows on the tab while something waits, and leaves at 0.

**s4: the bell and its panel**
- Render tests of the bell with `renderToStaticMarkup`:
  - nothing waiting: no badge, "Nothing waiting for you", and that as its accessible name;
  - both groups: each question's session, first question and age, linking to `/ask/q/<round>`
    ("shared by <name>" on a shared one), each outbox item's PRD, title, question and rank, linking
    to `/prd/<id>?tab=outbox`;
  - one part unreadable: its line ("Outbox couldn't be read — retrying.") with the items it kept.
- The panel's open and close are pure state: Escape, outside click and choosing an item close it.
- By hand: the bell between Game mode and the avatar; the panel under it, the screen's width below
  900 px.

**s5: desktop alerts and the chime**
- A pure test pins what is new: the first read announces nothing, a later read announces only the
  ids it had not seen, an item that leaves and comes back is new again.
- A pure test pins the switches' storage: both off by default, kept after a change, both off when
  storage throws.
- A pure test pins the chime claim over a fake storage: the first tab to write the ids plays, the
  second does not, a throwing storage plays nothing.
- A test with a fake `Notification`: switching on asks permission once; a denied permission reads
  "Blocked by the browser"; each new item raises one notification tagged with its id and its text;
  with the switch off nothing is raised and nothing is asked.
- Render test: the two switches at the panel's foot, and the blocked state.
- By hand: with both on and two tabs open, a new question in the background raises one
  notification and one chime.
