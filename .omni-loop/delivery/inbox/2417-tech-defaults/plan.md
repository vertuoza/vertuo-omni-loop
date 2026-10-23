# Plan: Tech defaults at the Omni-settings level

PRD #2417, spec beside this plan (`spec.md`). The feature branch `feat/tech-defaults` goes into
`main` through the feature PR (`Closes #2417`); each slice is a sub-PR from
`feat/tech-defaults--<slice>` into the feature branch (`Part of #2417`).

The tree's resolver (PRD #2416) already reads an Omni-settings copy at
`.omni-loop/local/tree/omni-settings/` and tags its sections `[omni settings]`; nothing writes that
copy yet. This plan writes it, from the workspace's settings repository's plain files, and gives the
Omni page a view and a pull-request edit of those files.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The kit ships the curated first default (review: fix / push back / ask, definition of done, verification before a push, bug-fixing) and names where a settings repository keeps its tech playbook; a local copy written from those files is read by `omni kb show` as `[omni settings]` | `kit/templates/omni-settings/` `kit/lib/omni-settings/` | — | 1 | deep |
| s2 | `omni kb status` names the pages that read the Omni-settings default, and `/omni:invade` writes only the pages it proves, leaving the rest to that default | `kit/lib/playbook/status.` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `kit/plugin/skills/invade/` `kit/test/invade-` | — | 1 | build |
| s3 | The Omni page serves a repository its workspace's settings repository's tech playbook (read as the Omni app), at one API route the kit calls | `apps/galaxy/src/omni-settings/` `apps/galaxy/app/api/omni-settings/` | s1 | 2 | build |
| s4 | `omni sync` refreshes the local copy from that route, and an offline run keeps reading the last copy | `kit/lib/sync/` `kit/lib/ask/client.` `kit/lib/omni-settings/sync` `kit/bin/commands/sync.ts` | s1 | 2 | build |
| s5 | This workspace's settings repository holds the first version, so this repository's blank and missing pages read it; the user guide says how the tech side's levels read | `.omni-loop/settings/` `docs/guide/` | s1 | 2 | light |
| s6 | The Omni page shows the settings repository's tech playbook, page by page, each page's text and whether it is the settings repository's own or the kit's first default | `apps/galaxy/src/omni-settings/` `apps/galaxy/app/app/settings/` | s3 | 3 | build |
| s7 | A workspace owner's change to a page on the Omni page opens a pull request in the settings repository; once a person merges it, the next `omni sync` reads the new text | `apps/galaxy/src/omni-settings/` `apps/galaxy/app/api/omni-settings/` `apps/galaxy/app/app/settings/` | s6 | 4 | deep |

**Shared ground.**

- `kit/lib/omni-settings/`: s1 creates the module (the settings repository's layout, the curated
  default's reader, the local copy's writer and reader); s4 adds only files starting
  `kit/lib/omni-settings/sync` and uses s1's writer unchanged. s4 waits for s1: wave 2.
- `apps/galaxy/src/omni-settings/`: s3 creates the area (contract, service reading the settings
  repository, controller of the API route); s6 adds the page's view on top of it (wave 3), s7 the
  edit and its pull request (wave 4). Each later slice extends the area's contract and service; they
  never share a wave.
- `apps/galaxy/app/api/omni-settings/`: s3's read route, then s7's edit route (wave 4).
- `apps/galaxy/app/app/settings/`: s6 adds the `playbook/` page and its link from the settings
  index; s7 adds the edit form on that page (wave 4).
- s2 owns `kit/bin/commands/kb.ts` and `kit/bin/kb.test.ts`; no other slice changes them.
- s5 writes no code: it copies s1's curated pages into this repository's settings folder, so it
  waits for s1 (wave 2) and shares no ground with s3 or s4.
- Generated files are never committed by a slice; the wave rebuilds them.

## Per slice: done when

### s1 (deep: the text every agent of every repository will follow, and the copy the resolver trusts)

- `kit/templates/omni-settings/playbook/` holds the curated first version as playbook forms the
  forms' own parser reads: `review` (fix, push back, ask), `definition-of-done`, `verification` and
  `bug-fixing`, each section filled, none a `TODO(human)`, each page with an `owner:` line defaulting
  to the repository's law owners (spec Q3). It names no repository, package manager or tool
  (`kit/test/no-literals.test.ts` stays green).
- A `kit/lib/omni-settings/` module names where a settings repository keeps its tech playbook
  (recorded as an outbox item, since the plan repository's own knowledge is another level), reads the
  curated default, and writes a local copy at the tree's Omni-settings folder from a list of files
  (form, text) plus where they came from (repository, commit, time); a malformed file is skipped and
  named, never an error.
- With a copy written, `omni kb show review` in a repository without its own `review` page prints
  the settings text tagged `[omni settings]` (AC 2); with none, it prints exactly what it prints today.
- Unit tests over fixture checkouts prove the copy's round trip and the curated pages' shape (AC 4).

### s2

- `omni kb status` prints, after the forms, one line naming the pages whose sections read the
  Omni-settings level (`reads the Omni settings: review, definition-of-done …`), and `--json`
  carries the same list; a repository with no Omni-settings copy prints exactly today's rows (AC 3).
- `/omni:invade`'s skill says a page it cannot prove from evidence is left unwritten, reading the
  Omni-settings default (then the kit default), names those pages from `omni kb status`, and still
  never copies default text into the repository's files (AC 3).
- `kit/bin/kb.test.ts` snapshots both outputs; the invade skill's text test covers the new rule.

### s3 (`ui: yes`)

- `GET /api/omni-settings/playbook?repo=<owner/name>`, signed in as `omni signin` signs in, returns
  the repository's workspace's settings repository (its plan repository, the workspace's
  `plan_repo`), the commit read, and each playbook file under the settings folder s1 names, read
  through the Omni app's installation token; the response is parsed by s1's schema.
- A repository outside the caller's workspace is refused (403); a workspace with no settings
  repository, or a settings repository with no files, returns an empty list with that reason, never
  an error. Which repository is the settings one when the workspace names none is recorded as an
  outbox item.
- Service and controller tests with a fake GitHub prove each case; the layering guard stays green.

### s4

- `omni sync` (and `--quiet`, the session's background run) fetches the route and rewrites the
  Omni-settings copy through s1's writer within the page check's time budget; the sync record says
  when it was last refreshed.
- Offline, signed out or refused, the last copy stays as it was and `omni kb show` keeps reading it
  (AC 2, offline); no copy and no server leaves every form as today.
- Tests with a fake client prove the refresh, the offline read and the untouched-when-refused case.

### s5 (light: copies the curated pages and writes docs)

- `.omni-loop/settings/playbook/` holds the curated first version, so this repository's blank
  `definition-of-done`, `bug-fixing` and missing `review` pages read it, tagged `[omni settings]`,
  once a sync copies it (spec point 4).
- `docs/guide/` says in plain words where the tech side's levels live and which one wins.

### s6 (`ui: yes`)

- A workspace settings page lists each tech playbook page of the settings repository with its text,
  and says for each whether it is the settings repository's own file or the kit's first default; it
  is linked from the settings index.
- A workspace with no settings repository says so, with the one thing to do.
- Render and service tests prove both cases; the page follows the design form.

### s7 (deep: writes into a workspace's repository as the Omni app) (`ui: yes`)

- A workspace owner edits a page's text on that page and submits: the Omni app opens a branch and a
  pull request in the settings repository with that file changed (or added, for a page still on the
  kit's default), and the page links the pull request (AC 1). A member who is not an owner sees no
  edit control, and the route refuses them (403).
- Nothing is stored on the Omni page: the text lives only in the pull request until a person merges
  it; after the merge, the next `omni sync` reads the new text (AC 1, Never 6).
- Service tests with a fake GitHub prove the branch, the file, the pull request and the refusal;
  a render test proves the edit control appears for an owner only.
