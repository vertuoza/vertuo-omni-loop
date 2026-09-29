# Plan: New documents alert

PRD #579, with the spec beside this plan (`spec.md`). The feature branch `feat/new-documents-alert`
merges into `main` with `Closes #579`. Each slice is a sub-PR from
`feat/new-documents-alert--<slice>` into the feature branch, with `Part of #579`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The bell's **New documents** group lists, one line per PRD newest first, the spec, plan and before/after versions pushed in the last 7 days to the numbered dossiers the signed-in person opened, read from Supabase every 10 s while the tab is visible; seen is kept per browser (first run sets `since` to now), and opening a PRD's page marks it seen; new documents never add to the bell's count, `(N)`, the favicon dot or the badges | `apps/galaxy/src/waiting/` `apps/galaxy/src/nav/bell` `apps/galaxy/src/nav/Bell` `apps/galaxy/src/dossier/page/` | — | 1 |
| s2 | A PRD's new documents are announced once they settle (newest version at least 30 s old): one desktop alert per PRD naming the kinds since its last alert, tagged `docs-<dossier>-<newest>` and opening `/prd/<dossier>`, and one chime per read through `claimChime`, both behind the existing switches; announced ids kept in localStorage, bounded at 200 | `apps/galaxy/src/waiting/` | s1 | 2 |

**Shared ground:** `apps/galaxy/src/waiting/` is declared by s1 and s2 (both touch `documents.ts`
and `WaitingProvider.tsx`, and s2 `alerts.ts`); s2 is blocked by s1, so they sit in waves 1 and 2.

## Per slice: done when

**s1**
- `groupDocuments` turns rows of two PRDs into two groups, kinds ordered spec, plan, before/after and
  each once, with the newest id and time; rows at or before the PRD's seen time or before `since` are
  dropped, and a PRD with only seen rows is dropped (unit tests, fixtures only).
- The reader, on a fake `Db`, filters on `opened_by` = me, a numbered dossier, the last 7 days and 50
  rows, and throws on a read error.
- The seen store: the first run sets `since` to now, `markSeen` writes a dossier's time, and a
  throwing storage gives `since` = load time and never throws.
- `bellPanel` shows **New documents** after Outbox, only with lines or a problem, each line head
  `PRD <n> · <title>`, text `New <kinds>`, meta how long ago, link `/prd/<dossier>`; the bell's count
  and `bellName` are unchanged by new documents (`bell.test.ts`, `Bell.render.test.ts`).
- The PRD page's seen part calls `markSeen` with the dossier id on mount and when the rendered
  versions change.

**s2**
- `settled` holds a group whose newest version is 30 s old and not one 29 s old.
- `toAnnounce` skips a newest id already announced, announces a later version of the same PRD naming
  only the kinds newer than its last alert, and keeps the announced list at most 200.
- `documentAlertOf` gives the title `PRD 572: new spec, plan, before/after`, the body the PRD's title,
  the tag `docs-<dossier>-<newest>` and the href `/prd/<dossier>`.
- With the switches off nothing is raised or played; with Desktop alerts on, two settled PRDs in one
  read raise two notifications, and with Chime on one chime plays, claimed once across tabs.
- The first read after load announces settled groups never announced before, and a reload announces
  nothing again.
