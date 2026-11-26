---
prd: 3184
title: Inbox skeletons and empty states on the design system
blocked-by: none
spec: file
phase0: server
areas: [ask]
---

## Problem

The Inbox (`/app/inbox`, `/app/inbox/done`, `/app/inbox/workspace`, PRDs omni-loop-22 and omni-loop-23)
reads its parts one by one and paints each the moment it lands. While it reads, a person sees the
wrong thing:

- Each tab's `loading.tsx` borrows a skeleton made for another page: Open and Done draw a settings
  list (`ListLoading`), Workspace draws a board with four tiles and two charts it never has
  (`BoardLoading`). The page jumps when it lands.
- The Open tab is drawn from the app shell's waiting list (`WaitingProvider`), whose parts start
  empty and have no "still reading" state. Sections pop in one after another, and "Nothing waits on
  you." can show for a moment before the first read.
- A kind pill with nothing in it (Approvals 0, Shared with me 0) leaves a blank area under the pills.
- The answer panel says "Reading the question…" as a grey line in an empty box.
- Done and Workspace say they are empty in a plain paragraph, each with markup of its own
  (`.done-empty`, `.dash-note`).
- The app has two skeleton systems: its own `src/skeleton` (a pulse, `--ask-line`) and the design
  system's `@omni/ui` Skeleton (a shimmer, tokens). Only the second belongs in the design system.

## Solution

Two components of the design system, reused by the whole app, and the Inbox drawn with them in
every tab and section.

1. **`@omni/ui` Skeleton** gains two shapes and a repeat:
   - `pill`: a 32 px round bone, as a pill of `SegmentedControl variant="pills"` draws.
   - `row`: the Inbox's shared row anatomy (`inbox.css .inbox-r`) bone for bone: a 32 px anchor
     tile, a 16 px title bone, an 11 px quiet-line bone, the age bone at the end, 16 px by 12 px
     inside the row, a hairline under it. `aside` adds the Waiting board's second column (a face
     and a word, "Whose turn").
   - `count`: how many pills or rows to draw. Rows run one shimmer 80 ms apart, so a list reads as
     one wave; widths vary from row to row by a fixed list, never at random.
   - The shimmer is the package's (`--color-border-subtle`, the band `--color-sunken`, 1.6 s) and
     stops under `prefers-reduced-motion: reduce`. One `role="status"` per skeleton names what
     loads; the bones are hidden from assistive technology.
2. **`@omni/ui` EmptyState** gains an optional `icon`, an `IconName` of `@omni/design`: on the
   `page` size a 48 px sunken tile above the title, on the `inline` size a 32 px tile beside it.
   The icon is hidden from assistive technology. The rest is unchanged: why in the title, when it
   fills in one line, at most one action.
3. **The app's skeletons** (`apps/galaxy/src/skeleton`) are rebuilt on `@omni/ui` Skeleton: the
   home, the boards, the settings lists, the PRD list and a PRD's page keep their layout and take
   the shimmer; `skeleton.css`'s `.skel-bone` pulse is removed.
4. **`WaitingProvider`** exposes `reading`, one flag per part of the waiting list (questions,
   outbox, approvals, reviews, documents, business, runners): true from the first render until
   that part's first read ends, whether it succeeded or failed. A failed read keeps today's retry
   line (`problemsOf`); it is never shown as empty.
5. **The Inbox**, tab by tab:
   - **Open.** `loading.tsx` draws `InboxOpenLoading`: the real tabs line with a bone for the Open
     count, the six pills with bones for their counts, the key hints, then the list (Questions and
     Your decisions, each its heading and row bones) beside the panel's skeleton from 1280 px, the
     list alone below. Once the page is drawn, a section whose part is still reading shows its
     heading, a bone for its count and two row bones. "Nothing waits on you." (EmptyState, icon
     `check`, its line shortened to "New questions land here as agents ask.", today's action) shows only when no part is reading, nothing counted waits,
     and the pill is All. A pill with nothing in it shows an inline EmptyState under the pills:
     Questions "No question waits on you.", Approvals "No approval waits on you.", Outbox "No outbox
     item waits on you.", Reviews "No review waits on you.", Shared with me "Nothing is shared with
     you.", each with its kind's row icon (`tone-info`, `check`, `outbox`, `prds`, `home`) and the
     one action "Show all" back to `/app/inbox`. The tab's count shows a bone
     while a counted part is reading, never 0.
   - **The panel.** While its round is read, the panel draws its own skeleton in its final box: the
     context line, two lines of question, four option bones with their key, the foot with the time
     left and the Send button's bone. "Reading the question…" stays as the skeleton's label.
   - **Done.** `loading.tsx` draws `InboxDoneLoading`: the tabs line, the 200 px categories column,
     the search field and its filter pill, then a day heading and four row bones. "No question yet"
     becomes a page EmptyState (icon `tone-info`, its line shortened to "Questions asked in ask
     mode land here."); "No question matches" an inline one
     (icon `search`, today's words) with the one action "Clear the filters".
   - **Workspace.** `loading.tsx` draws `InboxWorkspaceLoading`: the tabs line, the three view pills
     and the product filter as bones, then a group heading with its "Whose turn" column and four
     row bones with `aside`. Each view's empty sentence becomes a page EmptyState under the toolbar
     (icon `roadmap`, `prds` for My PRDs), with one line on when it fills ("Waits on members show
     here, oldest first."); with a product filter on, it names the product ("Your Insight PRDs wait on no one.")
     and offers "Show every product".

The mock this design was settled on drew every one of these states at real size; the before/after
page holds them as screens 1 to 3.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | ui package | `SKELETON_SHAPES` gains `'pill'`, `'row'` | ← packages/ui/src/Skeleton.meta.ts:3 |
| vertuo-omni-loop | ui package | `SkeletonProps.count`, `SkeletonProps.aside` | no written convention: follows packages/ui/src/Skeleton.tsx:4 (`lines`) |
| vertuo-omni-loop | ui package | `EmptyStateProps.icon: IconName` | no written convention: follows packages/ui/src/IconButton.tsx (an `IconName` prop) |
| vertuo-omni-loop | app | `Waiting.reading` | no written convention: follows apps/galaxy/src/waiting/WaitingProvider.tsx:65 (`unread`, one flag per part) |
| vertuo-omni-loop | app | `InboxOpenLoading`, `InboxDoneLoading`, `InboxWorkspaceLoading` | no written convention: follows apps/galaxy/src/skeleton/pages.tsx (`HomeLoading`, `BoardLoading`) |

## Decisions

- **EmptyState takes an optional pixel icon** (asked, 2026-11-23): yes, any `IconName` of
  `@omni/design`; pages that leave it out look as today.
- **The new skeleton replaces the old one everywhere** (asked): `src/skeleton` is rebuilt on
  `@omni/ui` Skeleton in this PRD, not only on the Inbox.
- **An empty pill only says it is empty** (asked): "No approval waits on you." with "Show all",
  no count of the other items.
- **How Open knows a part is still reading** (asked, approach A of three): a `reading` flag per
  part in `WaitingProvider`. Rejected: reading the waiting list on the server before the first
  paint (changes how the whole shell reads, slows every page), and delaying the empty state by a
  fixed time (a guess; still flashes on a slow network).
- **The voice's objection** (persona:F-E Developer, skeptical): "A staggered shimmer on every list
  is the kind of motion that hides a slow page; I want proof it never shifts the layout when the
  data arrives." Settled `accepted`: render tests pin that each Inbox skeleton and its loaded
  screen share the same row and toolbar boxes (AC-6).
- **The empties use icons that exist** (taken alone, most reversible): the pixel set has no inbox,
  clock or share icon, which the mock drew; drawing new icons is left out, and each empty takes the
  nearest existing one (all clear `check`, questions `tone-info`, the kinds' own row icons). A later
  PRD can draw the three and swap them in one line each.
- **Words at rest stay at seven or fewer** (the word pass): the empties' lines are shortened on
  the after; today's longer lines are noted on the before/after page, not redrawn.
- **A section past 10 s** keeps its bones and says it is still reading in one quiet line, as the
  Skeleton's own "don't" asks (use it for a moment or two only).
- **The screen library:** `inbox` and `waiting-board` are drafts (not locked); their drafts are
  brought up to the after. `app-shell` is drawn around them and does not change.

## User stories

- As a member opening the Inbox, I see the Inbox's own shape at once, and nothing moves when it
  fills.
- As a member with nothing to answer, I am told so only once the Inbox has truly read everything,
  and offered what waits on others.
- As a member on a pill that holds nothing, I see that it is empty and get back to All in one click.
- As a member on Done or Workspace with nothing to show, I read why, and the one thing that fills it.
- As a developer of the app, I draw any page's loading and empty states from two design-system
  components instead of writing a skeleton or an empty paragraph of my own.

## Scope

In: `@omni/ui` Skeleton (`pill`, `row`, `count`, `aside`) and EmptyState (`icon`), their meta,
specimens and tests; `apps/galaxy/src/skeleton` rebuilt on them; `WaitingProvider.reading`; the
three Inbox `loading.tsx`; the Open tab's section bones, pill empties, all-empty state and panel
skeleton; Done's and Workspace's empties on EmptyState; the `inbox` and `waiting-board` draft screens.

Out: the Inbox's error states beyond today's retry line; skeletons for pages that have none today;
the Questions pages under `/ask` (their own PRD); new icons in `@omni/design` (the empties use icons
that exist today: `check`, `tone-info`, `outbox`, `prds`, `home`, `search`, `roadmap`).

## Test seams

- `packages/ui`: render tests of Skeleton (each shape, `count`, `aside`, the label, `aria-hidden`
  bones, the stagger custom property) and EmptyState (`icon` on both sizes, hidden from assistive
  technology, none by default); the meta and catalogue tests (`src/generated/catalogue.ts`) updated.
- `apps/galaxy/src/waiting`: the provider's `reading` flags, through its existing test harness:
  true before the first read, false after a read that succeeds and after one that fails.
- `apps/galaxy/src/inbox`: `InboxOpenView` render tests (`render.test.ts`, `open.render.test.ts`)
  given a `reading` map: bones and no empty state while reading; the empty state once all are read
  with nothing counted; a pill's inline empty with Show all.
- `apps/galaxy/src/skeleton`: `loading.test.ts` extended to the three Inbox loading screens and the
  no-shift check: the skeleton and the loaded screen of each tab use the same row, toolbar and tabs
  classes in the same order.
- Done and Workspace: `done-tab.test.ts` and `waiting-board/render.test.ts` for each empty.
- `pnpm design` stays green: every value is a token.
- Tests never call GitHub or need `.env.local` (testing form).

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) on Vercel; every page with a skeleton
  changes its look from a pulse to the shimmer. Rollback: revert the feature PR; no data, no
  migration, no API changes.
- **The provider is shared** by the menu count, the tab title and the bell: `reading` is added
  beside the parts, nothing existing changes meaning, so they read the same as today.
- **The Legal entries:** none touched.
- **The locked laws:** the lookup lists the ask domain's locked laws because the panel sits in it.
  The design changes only what the panel draws while it reads, never how an answer is read, sent or
  shown once given:
  - BR-PRODUCT-12: if broken, an answer would change after it was given and nobody could tell what
    was decided. Kept: no write path changes. Changing it needs @pierrederval or @dervalp to approve
    the pull request on GitHub.
  - BR-PRODUCT-29: if broken, a stranger could read a team's questions. Kept: no read changes who
    may read. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-39: if broken, a question could leak or be lost. Kept: no session read changes.
    Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-94: if broken, an agent could answer in a person's name. Kept: untouched. Changing it
    needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - N-PRODUCT-7 and N-PRODUCT-8: if broken, a hook could block a person or call a host they never
    chose. Kept: no hook changes. Changing either needs @pierrederval or @dervalp to approve the
    pull request on GitHub.
- **The business laws:** BL-ASK-1 (an answer a person gave is never changed or reworded) is kept:
  the panel's skeleton shows before the round is read and is never drawn over an answer.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The Skeleton draws a list row in the Inbox's row anatomy
  Given the Skeleton with shape row and count 3, labelled "Loading your decisions"
  When it is rendered
  Then it is one status named "Loading your decisions"
  And it draws three rows, each with an anchor bone, a title bone, a quiet-line bone and an age bone, all hidden from assistive technology
  And each row's shimmer starts 80 ms after the row before it
```

### AC-2 · test

```gherkin
Scenario: The EmptyState shows an optional icon
  Given an EmptyState titled "Nothing waits on you." with the icon check
  When it is rendered at page size and at inline size
  Then the check icon shows on its tile, hidden from assistive technology
  And an EmptyState with no icon renders as it does today
```

### AC-3 · test

```gherkin
Scenario: A section still reading shows bones, never an empty state
  Given the Open tab with questions read and empty, and the decisions still reading
  When the tab is drawn
  Then the Your decisions section shows its heading, a bone for its count and two row bones
  And "Nothing waits on you." is not shown
  And the Open count shows a bone, not 0
```

### AC-4 · test

```gherkin
Scenario: The Inbox says nothing waits only once every part is read
  Given every part of the waiting list read, with nothing counted
  When the Open tab is drawn with the pill All
  Then it shows "Nothing waits on you." with the check icon and the action "See what waits on others"
```

### AC-5 · test

```gherkin
Scenario: An empty pill says it is empty
  Given every part read, with two questions and no approval
  When the Open tab is drawn with the pill Approvals
  Then it shows "No approval waits on you." with the one action "Show all"
```

### AC-6 · test

```gherkin
Scenario: Nothing moves when a tab lands
  Given the loading screen and the loaded screen of each Inbox tab
  When both are rendered
  Then they draw the same tabs line, the same toolbar and rows of the same row anatomy, in the same order
```

### AC-7 · test

```gherkin
Scenario: The answer panel keeps its box while it reads
  Given the open question's round not read yet
  When the panel is drawn
  Then it draws the panel's skeleton named "Reading the question…": the question, four option bones and the Send bone
```

### AC-8 · test

```gherkin
Scenario: Done and Workspace say why they are empty
  Given a workspace with no question yet, and a Done search that matches nothing
  When the Done tab is drawn for each
  Then it shows "No question yet" at page size, and "No question matches" inline with the action "Clear the filters"
  And the Workspace tab with nothing waiting shows "Nothing waits on a person." at page size under its toolbar
```

### AC-9 · test

```gherkin
Scenario: Every page skeleton of the app is the design system's
  Given the app's page skeletons (home, boards, settings lists, the PRD list, a PRD's page)
  When each is rendered
  Then its bones are the design system's Skeleton, and no bone uses the old pulse
```
