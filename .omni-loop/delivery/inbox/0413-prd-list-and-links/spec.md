---
prd: 413
title: Find every PRD in the app, and its link in every answer
blocked-by: none
spec: file
---

# Find every PRD in the app, and its link in every answer

**Date:** 2026-09-28 · **PRD:** #413 · **Touches:** `apps/galaxy` (the top bar's menu, the dashboard's
section cards, the `/prd` list, a lookup route under `app/api/dossiers/`), `kit` (`omni dossier
link`, the briefing form, the skills' hand-offs) · **Builds on:** #216 (dossiers), #328 (dashboard),
#346 (top bar)

## Problem

A person who opened PRDs cannot find them again, and Claude's answers about a PRD never say where
its page is.

- The list of every PRD already exists at `/prd` (PRD 216). No link reaches it from outside a dossier,
  though:
  - the top bar's menu (`apps/galaxy/src/nav/menu.ts`) holds only Release notes and Docs;
  - the `/app` dashboard's section cards (`apps/galaxy/src/switch/switch.ts`, `SECTIONS`) hold
    Questions, For me, History and Knowledge map;
  - the only link is "All PRDs" in `app/prd/layout.tsx`, which shows only on `/prd*` pages.
- `/prd` lists every dossier of the person's workspaces, with no way to see only their own.
  `dossier_list()` already returns `opened_by`.
- A PRD's page is `/prd/<uuid>`, never its number. No `omni` command prints it on demand:
  - `omni dossier open` and `omni dossier push` print it only as a side effect;
  - the only number-to-link record is `.omni-loop/local/dossiers.json`, and it exists only on the
    machine that opened or pushed the dossier.
- `/omni:plan`'s hand-off, `/omni:wave`, `/omni:yolo`, `/omni:yolo-fix`, `/omni:status` and free-form
  answers name a PRD without its link.

## Solution

```
app bar (every page):   OMNI LOOP · <sub>      … PRDs · Release notes · Docs · ☀ · Game mode
/app dashboard cards:   My PRDs · Questions · For me · History · Knowledge map
/prd:                   [ Mine | All ]  repo ▾  state ▾  search…      (Mine by default)

terminal:  omni dossier link 413  ──GET /api/dossiers?repo=<owner/name>&prd=413──▶  {id, url}
           prints  https://…/prd/<uuid>        (exit 1 + one line when there is none or no reach)
```

## Decisions

1. **"PRDs" in the top bar's menu.** A new first `MENU` item, `{ id: 'prds', label: 'PRDs', path:
   '/prd' }`, shown on every page of the app, at the top right with the rest of the menu. On `/prd`
   pages it carries `aria-current="page"`. The "All PRDs" extra in `app/prd/layout.tsx` goes, because
   the menu item replaces it.
2. **"My PRDs" on the dashboard.** A new first entry of `SECTIONS`: `{ title: 'My PRDs', path:
   '/prd', line: 'The PRDs you opened, drafts included' }`.
3. **Mine / All on `/prd`.** A new filter, `who`, read from the address:
   - `who=all` shows every dossier of the person's workspaces (today's list);
   - anything else, including no `who` at all, is Mine: the dossiers whose `opened_by` is the
     signed-in person, drafts and numbered PRDs alike.
   - Mine is the default. The toggle is two links at the head of the filters, and switching keeps the
     other filters (`repo`, `state`, `q`).
   - `who` is not counted by "clear the filters". Clearing keeps it.
   - A dossier the GitHub fallback created has no `opened_by`, so it shows only under All.
4. **An empty Mine** reads "You have not opened a PRD yet." with a link to the same address with
   `who=all`. The demo history marks some rows as the demo viewer's, so Mine has something to show
   there.
5. **The lookup:** `GET /api/dossiers?repo=<owner/name>&prd=<n>`.
   - It uses the same sign-in as `POST /api/dossiers`, a bearer token checked by `authenticate`.
   - It reads `public.dossiers` as the caller, where `home_repo` is the repository lower-cased and
     `prd` is n, so row-level security decides.
   - Its replies:

     | Case | Reply |
     |---|---|
     | Found | `200 {id, url}`; `url` is built the way open and push build it (`linkTo`) |
     | No dossier for that repository and number | `404` |
     | Bad `repo` or `prd` | `400` |
     | Not signed in | `401` |
     | No database | `503` |

   - If two of the caller's workspaces hold one for the same repository and number, the one numbered
     most recently is returned.
   - No migration is needed.
6. **`omni dossier link <n>`.**
   - It prints PRD n's link, one line, exit 0.
   - When the app answers 404, it prints `none` on stderr, exit 1.
   - Otherwise it follows the command's contract: `off`, `no sign-in (omni signin)`, `unreachable`
     or `refused (<status>)`, exit 1. Exit 2 means the kit is not installed or the arguments are bad.
   - It asks the app first. When the app cannot be reached, it falls back to a numbered entry for n
     in `.omni-loop/local/dossiers.json`, printed as usual.
   - It writes nothing, and it has the same 5-second limit and one token refresh as `open` and
     `push`.
   - `omni dossier status` is unchanged.
7. **The rule, where every session reads it.** The briefing form gains an optional section, `links`,
   whose kit default reads:

   > Any answer that names a PRD gives its page on the Omni app: run `omni dossier link <n>` and
   > print the link beside the number. When it prints `none` or cannot reach the app, say that the
   > PRD has no page yet and give its GitHub issue instead.

   This repository leaves the section at the kit default. The briefing already opens every session
   (the `SessionStart` hook), so free-form answers are covered.
8. **Every hand-off prints it.** Each skill that reports on a PRD prints the link from `omni dossier
   link <n>` beside the PRD's number, or the issue when there is none:
   - `/omni:plan`'s hand-off;
   - `/omni:wave`'s report;
   - `/omni:yolo`'s green and red hand-offs;
   - `/omni:yolo-fix`'s report;
   - `/omni:status`'s summary of a PRD;
   - `/omni:brainstorm`'s "What is next?" (its dossier line then always has a link to show).

   `/omni:help` explains the command.

## User stories

1. From any page of the app, I click **PRDs** at the top right and see the PRDs I opened, drafts
   included.
2. On my dashboard, I click **My PRDs** and land on the same list.
3. On the list, I click **All** and see every PRD of my workspace, then **Mine** to go back, and the
   repository filter I had set stays.
4. I ask Claude about PRD 400 in the terminal, and the answer gives me its page's link.
5. At the end of `/omni:yolo 413`, the hand-off gives me the PRD's page beside the feature PR.
6. On a laptop that never opened PRD 216's dossier, `omni dossier link 216` still prints its link.

## Scope

**In:**

- `menu.ts`, `switch.ts` and the "All PRDs" extra in `app/prd/layout.tsx`.
- In `history.ts`, `who` and the Mine filter, taking the viewer's id.
- In `DossierHistory`, the toggle and the empty Mine.
- `app/prd/page.tsx`, which passes the viewer's id.
- The demo history's rows for the demo viewer.
- `GET` in `app/api/dossiers/route.ts`, a `findDossier` in `src/dossier/api.ts`, and the store's
  read by repository and number.
- The kit: the `dossier link` verb and its usage line; the client's lookup call; the `links` section
  of the briefing form, with its kit default; and the skills and help named in Decision 8.

**Out:**

- A page by number, such as `/prd/413`.
- A status or stage column on dossiers.
- Listing PRDs that never had a dossier.
- Creating a dossier from `link`, since `push` does that.
- Any change to `dossier_list()` or the dossier tables.

## Test seams

Tests sit beside the code, as `*.test.ts` under `apps/galaxy/src/` and `*.test.mjs` under `kit/`. They
run with `pnpm test`, and never call Supabase or GitHub.

- **The menu and cards** (`src/nav/TopBar.test.ts`, the switch's tests):
  - PRDs is the first menu item and opens `/prd`.
  - My PRDs is the first section card.
  - No "All PRDs" extra is left in the `/prd` layout.
- **The filter** (`src/dossier/page/history.test.ts`):
  - `readHistoryFilters` reads `who=all`. A missing, empty or unknown `who` is Mine.
  - `historyItems` with Mine keeps only rows whose `opened_by` is the viewer, drafts and numbered
    alike, and drops `opened_by = null`.
  - All keeps them all.
  - `who` combines with `repo`, `state` and `q`, and "clear the filters" keeps it.
- **The list's states:** Mine with rows, an empty Mine with its link to All, and All.
- **The lookup** (`src/dossier/api.test.ts`, stubbed client):
  - found → 200 `{id, url}`, with the forwarded host in the url;
  - none → 404;
  - `repo` missing or malformed, and `prd` of 0, negative, not a number or past 2³¹−1 → 400;
  - no token → 401;
  - no database → 503;
  - two rows → the most recently numbered one;
  - the repository compared lower-cased.
- **The command** (`kit/bin/commands/dossier.test.mjs`, stubbed fetch):
  - 200 prints the url, exit 0;
  - 404 → `none`, exit 1;
  - unreachable with a local numbered entry prints it, exit 0; unreachable without one →
    `unreachable`, exit 1;
  - `off`, `no sign-in` and `refused (500)`;
  - bad arguments → exit 2 with the usage line;
  - nothing written under `.omni-loop/local/`.
- **The briefing:** `omni kb show briefing` prints a `links` section at its kit default
  (`kit/lib/playbook/forms.test.mjs`).
- **The skills:** a text check that each skill named in Decision 8 runs `omni dossier link`.

## Risks

A merge to `main` publishes:

- **The kit:** `kit/dist/omni.mjs` and the plugin, with the new verb, the briefing section and the
  skills' wording.
- **The app's pages and route:** the menu item, the card, the default Mine and the lookup.

Nothing touches the database. The lookup only reads, as the caller, under row-level security, so it
shows a person nothing the `/prd` list does not already show them.

Risks:

- **Defaulting to Mine can surprise someone used to seeing everything.** One click on All undoes it,
  and the empty state points there.
- **The briefing rule makes every answer about a PRD call the app, with a limit of 5 seconds.** A
  failure costs one line ("no page yet", or the issue) and never blocks the answer.

Rollback is reverting the feature PR's merge commit. The release after it hands out the kit without
the verb, and a skill that still names it gets exit 2 and falls back to the issue link.

## Acceptance criteria

1. Every page of the app shows **PRDs** in the top bar's menu, and it opens `/prd`.
2. `/app` shows a **My PRDs** card first among its sections, and it opens `/prd`.
3. `/prd` with no `who` lists only the dossiers the signed-in person opened, drafts included. `/prd?who=all` lists every dossier of their workspaces.
4. Switching between Mine and All keeps the repository, state and search filters.
5. With no dossier of their own, Mine says so and links to All.
6. `GET /api/dossiers?repo=<owner/name>&prd=<n>` answers 200 `{id, url}` for a dossier the caller can read. It answers 404 when there is none, 400 on bad input, 401 without a sign-in and 503 without a database.
7. `omni dossier link <n>` prints the PRD's link on a machine that never opened or pushed it, prints `none` with exit 1 when it has no dossier, and writes no file.
8. `omni kb show briefing` prints the `links` rule.
9. The hand-offs of plan, wave, yolo, yolo-fix, status and brainstorm each print the PRD's link, or its issue when it has no page.
10. `pnpm test` is green.
