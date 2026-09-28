# Plan: find every PRD in the app, and its link in every answer

PRD #413, with its spec beside this plan (`spec.md`). The feature branch `feat/prd-list-and-links`
merges into `main` through the feature PR, whose body says `Closes #413`. Each slice is a sub-PR from
`feat/prd-list-and-links--<slice>` into the feature branch, whose body says `Part of #413`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Every page of the app reaches the PRD list. Covers: **PRDs** as the first item of the top bar's menu, opening `/prd` and marked current on `/prd` pages; **My PRDs** as the first section card on `/app` ("The PRDs you opened, drafts included"); the "All PRDs" extra dropped from the `/prd` layout | `apps/galaxy/src/nav/` `apps/galaxy/src/switch/` `apps/galaxy/app/prd/layout.tsx` | — | 1 |
| s2 | The PRD list starts on the PRDs you opened. Covers: the `who` filter (`who=all` is All, anything else is Mine) in `readHistoryFilters` and `historyItems`, taking the viewer's id; Mine keeping only rows the viewer opened, drafts and numbered alike; the Mine / All toggle keeping `repo`, `state` and `q`; "clear the filters" keeping `who`; an empty Mine with its link to All; `app/prd/page.tsx` passing the signed-in person's id; the demo history's rows for the demo viewer | `apps/galaxy/src/dossier/page/` `apps/galaxy/app/prd/page.tsx` | — | 1 |
| s3 | The app answers a PRD's link by its number. Covers: `GET /api/dossiers?repo=<owner/name>&prd=<n>` in `app/api/dossiers/route.ts`; `findDossier` in `src/dossier/api.ts` (same sign-in as open and push, 200 `{id, url}` built by `linkTo`, 404, 400, 401, 503); the store's read of `public.dossiers` by lower-cased `home_repo` and `prd`, as the caller, the most recently numbered first | `apps/galaxy/app/api/dossiers/route.ts` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/store` | — | 1 |
| s4 | `omni dossier link <n>` prints a PRD's link on any machine. Covers: the `link` verb and the usage line; the client's lookup call; exit 0 with the url, `none` on 404, `off`, `no sign-in (omni signin)`, `unreachable`, `refused (<status>)`, exit 2 on bad arguments; the fallback to a numbered entry in `.omni-loop/local/dossiers.json` when the app cannot be reached; nothing written; the rebuilt bundle | `kit/bin/commands/dossier` `kit/lib/ask/client` `kit/lib/dossier/` `kit/dist/omni.mjs` | — | 1 |
| s5 | Every answer about a PRD carries its link. Covers: the briefing form's optional `links` section and its kit default (the spec's Decision 7 wording); the hand-offs of `/omni:plan`, `/omni:wave`, `/omni:yolo` (green and red), `/omni:yolo-fix`, `/omni:status` and `/omni:brainstorm`'s "What is next?" printing the link from `omni dossier link <n>`, or the issue when it has none; `/omni:help` naming the command; the text check over those skills; the rebuilt bundle | `kit/lib/playbook/forms` `kit/templates/playbook/briefing.md` `kit/plugin/skills/` `kit/test/skills-dossier-link` `kit/dist/omni.mjs` | s4 | 2 |

**Shared ground.** One prefix is declared by more than one slice: `kit/dist/omni.mjs`, the bundle
that `pnpm kit:build` rebuilds whenever kit source changes. s4 rebuilds it in wave 1 and s5 in
wave 2, so the two never merge side by side.

- s1, s2 and s3 own disjoint files in `apps/galaxy`: the navigation, the list page, and the API
  route with its store.
- s4 owns only kit files.
- So wave 1 runs s1 to s4 together.

s4 needs nothing of s3's code: it is tested against a stubbed fetch that follows the spec's
contract, and the feature branch brings the two together before it ships. s5 follows s4 because the
skills and the briefing name a command s4 creates, and because of the bundle.

## Per slice: done when

**s1**

- `MENU`'s first item is `{ id: 'prds', label: 'PRDs', path: '/prd' }`, and every page with the
  shared top bar shows it at the top right. The `/prd` pages pass `current="prds"`, so it carries
  `aria-current="page"` there.
- `SECTIONS`' first entry is My PRDs, opening `/prd`, and the dashboard renders it first among its
  cards.
- `app/prd/layout.tsx` no longer passes an "All PRDs" extra.
- The TopBar and switch tests cover each of these, and `pnpm test` is green.

**s2**

- `readHistoryFilters({})`, `{who: ''}` and `{who: 'x'}` each give Mine. `{who: 'all'}` gives All.
- `historyItems` with Mine and a viewer id keeps only the viewer's rows, drafts and numbered alike,
  and drops `opened_by = null`. All keeps every row. `who` combines with `repo`, `state` and `q`.
- The toggle's two links keep the other filters. "Clear the filters" keeps `who`, and `filtered()`
  does not count it.
- An empty Mine reads "You have not opened a PRD yet." with a link to the same address plus
  `who=all`.
- `/prd` passes the signed-in person's id. The demo history shows some rows under Mine.
- Tests cover each state, and `pnpm test` is green.

**s3**

- `GET /api/dossiers?repo=acme/widgets&prd=7`, for a row the caller can read, gives 200
  `{id, url}`. The url uses the forwarded host and is `/prd/<id>`.
- It gives 404 when there is no row, and 400 for a missing or malformed `repo` and for a `prd` that
  is 0, negative, not a number or past 2³¹−1. It gives 401 without a token and 503 without a
  database.
- With two rows, it returns the most recently numbered one. The repository is compared lower-cased.
- There are no writes and no migration. `pnpm test` is green, with a stubbed Supabase client.

**s4**

- `omni dossier link 7` against a stubbed 200 prints the url on one line and exits 0.
- A 404 prints `none` on stderr and exits 1. `off`, `no sign-in (omni signin)`, `unreachable` and
  `refused (500)` behave as they do for `push`.
- Unreachable, with a numbered entry for 7 in the local record, prints that url and exits 0.
  Without one, it prints `unreachable` and exits 1.
- `omni dossier link` and `omni dossier link x` exit 2 with the usage line, which names `link`.
- No file under `.omni-loop/local/` is written or changed.
- `kit/dist/omni.mjs` is rebuilt, so the dist test passes, and `pnpm test` is green.

**s5**

- `omni kb show briefing`, in a repository that leaves `links` blank, prints a `links` section at
  its kit default with the spec's Decision 7 wording. The forms test covers it.
- Each of plan, wave, yolo, yolo-fix, status and brainstorm says, in its hand-off or report, to run
  `omni dossier link <n>` and print the link beside the PRD's number, or the issue when it prints
  `none` or cannot reach the app. Help lists the verb.
- A kit test fails when one of those six skills stops naming `omni dossier link`.
- The no-literals test still passes. `kit/dist/omni.mjs` is rebuilt, and `pnpm test` is green.
