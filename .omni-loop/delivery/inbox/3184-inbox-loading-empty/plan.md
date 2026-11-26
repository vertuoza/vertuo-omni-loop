# Plan: Inbox skeletons and empty states on the design system

PRD #3184, spec beside this plan (`spec.md`). The feature branch `feat/inbox-loading-empty` merges
into `main` with `Closes #3184`; each slice is a sub-PR from `feat/inbox-loading-empty--<slice>` into
the feature branch with `Part of #3184`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The design system's Skeleton draws a pill and a list row (`shape="pill"`, `shape="row"`, `count`, `aside`), rows shimmering 80 ms apart, still under reduced motion | `packages/ui/src/Skeleton.` | — | 1 | build |
| s2 | The design system's EmptyState shows an optional pixel icon on a tile, above its title at page size and beside it inline | `packages/ui/src/EmptyState.` | — | 1 | build |
| s3 | Every page skeleton of the app is drawn with the design system's Skeleton, the old pulse removed, and each Inbox tab opens on its own loading screen (Open, Done, Workspace) whose boxes match the loaded tab | `apps/galaxy/src/skeleton/` `apps/galaxy/app/app/inbox/loading.tsx` `apps/galaxy/app/app/inbox/done/loading.tsx` `apps/galaxy/app/app/inbox/workspace/loading.tsx` | s1 | 2 | build |
| s4 | The waiting list says which parts are still read, and the Open tab draws bones for them, says "Nothing waits on you." only once every part is read, says an empty pill is empty, and keeps the panel's box while it reads its round | `apps/galaxy/src/waiting/WaitingProvider.tsx` `apps/galaxy/src/waiting/reading.test.ts` `apps/galaxy/src/inbox/InboxScreen.` `apps/galaxy/src/inbox/inbox-open.css` `apps/galaxy/src/inbox/inbox.css` `apps/galaxy/src/inbox/render.test.ts` `apps/galaxy/src/inbox/open.render.test.ts` | s1, s2 | 2 | deep |
| s5 | Done and Workspace say why they are empty with the design system's EmptyState: no question yet, no match with "Clear the filters", each Workspace view, and a product filter with "Show every product" | `apps/galaxy/src/ask/page/WorkspaceHistory.tsx` `apps/galaxy/src/ask/page/history.css` `apps/galaxy/src/ask/page/history-render.test.ts` `apps/galaxy/src/inbox/done-tab.test.ts` `apps/galaxy/src/waiting-board/` | s2 | 2 | build |

**Shared ground.** No prefix is declared by two slices. Close calls, kept apart by narrow
territories: s4 owns the Inbox's screen files and its two render tests, s5 owns `done-tab.test.ts`
in the same folder; s3's no-shift test (`apps/galaxy/src/skeleton/loading.test.ts`) renders the
loaded Open view and the Done and Workspace screens without changing them, and the row, toolbar and
tabs classes it reads (`inbox-r`, `inbox-toolbar`, `omni-tabs`) are kept as they are by s4 and s5.
`packages/ui/src/generated/` is not touched: no part is added, so the catalogue does not change.

## Per slice: done when

### s1

- `<Skeleton shape="row" count={3} label="Loading your decisions" />` renders one status named by its
  label and three rows, each an anchor, a title, a quiet-line and an age bone, all `aria-hidden`
  (AC-1).
- Row `n` carries the stagger (`--i: n`, 80 ms per step); widths come from a fixed list, never at
  random.
- `aside` adds the second column (a face bone and a word bone); `shape="pill"` with `count` draws
  that many 32 px round bones.
- Under `prefers-reduced-motion: reduce` no bone animates; `text`, `block` and `circle` render as today.
- `Skeleton.meta.ts` lists the new shapes and props in its `do`; the specimen shows them;
  `pnpm design` and `pnpm lint packages/ui/src` are green.

### s2

- `<EmptyState title="Nothing waits on you." icon="check" />` shows the check icon on a 48 px tile
  at page size and a 32 px tile beside the title inline, the icon hidden from assistive technology
  (AC-2).
- An EmptyState with no `icon` renders exactly as today (its existing tests unchanged).
- `EmptyState.meta.ts` and its specimen show the icon; `pnpm design` is green.

### s3 (`ui: yes`)

- `HomeLoading`, `BoardLoading`, `ListLoading`, `PrdListLoading` and `DossierLoading` keep their
  layout and draw their bones with `@omni/ui` Skeleton; `.skel-bone` and its `skel-pulse` keyframes are
  gone from `skeleton.css` (AC-9).
- `/app/inbox`, `/app/inbox/done` and `/app/inbox/workspace` load `InboxOpenLoading`,
  `InboxDoneLoading` and `InboxWorkspaceLoading`, drawn as the before/after page's 1.A, 1.F and 2.A.
- `loading.test.ts` checks, for each Inbox tab, that the loading screen and the loaded screen use the
  same tabs line, toolbar and row classes in the same order (AC-6).

### s4 (`ui: yes`) (deep: the provider is shared by the bell, the menu count and the tab title)

- `useWaiting().reading` holds one flag per part, true from the first render until that part's first
  read ends, whether it succeeded or failed; the counts, the bell and the tab title read as today
  (`reading.test.ts`).
- With questions read and decisions still read, the Open tab shows the Your decisions heading, a
  count bone and two row bones, no "Nothing waits on you.", and a bone for the Open count (AC-3).
- Every part read with nothing counted, pill All: the EmptyState with the `check` icon, "New
  questions land here as agents ask." and "See what waits on others →" (AC-4).
- A pill with nothing in it shows its inline EmptyState ("No approval waits on you.", its kind's row
  icon) with the one action "Show all" to `/app/inbox` (AC-5).
- While its round is read, the panel draws its skeleton named "Reading the question…": the
  question, four option bones and the Send bone (AC-7). An answer once read is drawn as today.
- A part still read past 10 s says so in one quiet line under its bones.

### s5 (`ui: yes`)

- Done with no question ever: a page EmptyState "No question yet", icon `tone-info`, "Questions
  asked in ask mode land here."; a search that matches nothing: an inline EmptyState "No question
  matches", icon `search`, with "Clear the filters" (AC-8).
- Workspace with nothing waiting: a page EmptyState under the toolbar for each view (Workspace "Nothing
  waits on a person.", My PRDs, My reviews), icon `roadmap` (`prds` for My PRDs), "Waits on members
  show here, oldest first."; with a product filter on, "Your <product> PRDs wait on no one." and
  "Show every product" (AC-8).
- `.done-empty` and the empty `.dash-note` markup are gone from these two screens.
