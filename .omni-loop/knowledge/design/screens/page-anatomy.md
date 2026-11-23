---
screen: page-anatomy
status: draft
mock: page-anatomy.html
implements: ["packages/ui/src/PageHeader.tsx", "packages/ui/src/StageTrack.tsx", "packages/ui/src/Tabs.tsx", "packages/ui/src/SegmentedControl.tsx", "packages/ui/src/SectionHeading.tsx", "packages/ui/src/DefinitionList.tsx", "packages/ui/src/ReviewScreen.tsx", "packages/ui/src/EmptyState.tsx", "packages/ui/src/Notice.tsx", "packages/ui/src/ListRow.tsx"]
reads: ["packages/ui/src/", "packages/design/tokens/", "apps/galaxy/src/page-width.test.ts", "apps/galaxy/src/nav/AppShell.tsx"]
routes: []
supersedes: null
---

## Purpose

The shared anatomy of every page of the app: one way to title a page, one tab row, one way to
show sub-views, one heading for a section, one list row, one set of side facts, one empty state,
one notice, one width. A page is composed from these parts; it never draws its own header. It
exists so that every page reads the same, uses the full width and says the stage once. The PRD
page (`prd-dossier`), the review screen (`prd-review`) and the fix pages are its first users; the
other pages move onto it later (omni-loop-14).

The parts live in `packages/ui` and are built on omni-loop-12's components and the tokens of
`packages/design/tokens/`. A part takes variants, never `className` or `style`.

## Regions

- **PageHeader.** Top of every page, full width, in one box:
  - a **breadcrumb** (`Breadcrumb`), whose last crumb names the current item, so no page adds its
    own "← back" link;
  - one **title**, 32 px, one line where it fits;
  - a **subtitle**, one sentence. On an item that waits on a person it names who acts and what;
  - a **meta row** of at most five unlabelled facts, each a `DefinitionList` item; an empty fact is
    left out, and the meta row never repeats the stage;
  - one **primary action** slot, shown only to the person who acts, its label the subtitle's verb;
  - an **Actions** menu for rare actions only (copy, delete, send elsewhere). No other buttons in
    the head.
- **StageTrack.** The stage, said once, under the title. Accent while agents work, signal while it
  waits on the reader. It is a row of stops, the current one filled.
- **Tabs.** One style, one row, directly under the header. Every tab is a link, so the page works
  before a script runs. A count is a mono pill; the pill is yellow only when the tab waits on the
  reader. An empty tab stays visible and dimmed, its reason on its pane. A page has one `Tabs` row
  at most; no More menu, no second row.
- **SegmentedControl.** Sub-views, filters and versions inside one tab: Before/after · Spec · Plan,
  a filter of rows, a version choice. Never a second tab row. Its selected segment is named in the
  address.
- **SectionHeading.** Every section of a pane starts with one: a heading of one size, with an
  optional count and an optional meter. Titles come in one form and one size; no page uses a
  heading of its own.
- **DefinitionList.** Side facts and the About block: a term above its value. An empty fact is
  left out, not shown as a dash.
- **ListRow.** One row of a list: a mark, a title, a secondary line, and its facts on the right. A
  folded row opens to its detail on the same page.
- **EmptyState.** A pane with nothing in it: one line saying why, muted, and at most one action. It
  never says only "No data".
- **Notice.** A message the reader must see: a full border and an icon, never a left stripe. Three
  tones: information, a warning that waits on the reader, an error.
- **ReviewScreen.** A focused, full-width screen for one signed decision: its own `PageHeader`, the
  reading in order (what changed, the verdict, the body), and the decision row at the foot, with no
  tabs and nothing else on it. Its breadcrumb ends at the review.

- The trail header (omni-loop-23), for hub pages whose tabs are the page, as the Inbox: no visible
  32 px title, the top bar's trail is the title and a visually hidden h1 stays; the tabs sit right under
  the top bar, the one count that says who acts is the filled count of its tab, and the actions sit in
  the tabs line's end slot. Every other page keeps the full header.

## Width

Every page spans the full app width (`apps/galaxy/src/page-width.test.ts`). Only running prose,
Markdown and the reading of a spec or a retro, keeps a 900 px measure, inside its pane. A page never
caps its own width with a narrow frame.

## States

- **Empty:** `EmptyState`, one line, its reason, muted.
- **Waiting on the reader:** the subtitle names the reader and the action, the primary action carries
  the same verb, the waiting tab's count is yellow.
- **Error:** a `Notice` of the error tone above the pane, the rest of the page still readable.
- **Loading:** the page's skeleton inside the layout frame; each part keeps its height.
- **Three themes:** every part reads in light, dark and the high-contrast theme from the tokens; no
  colour is set by a part directly.

## Words

Stage words are said once, in `StageTrack`. Tab words: Brainstorm, Specifications, User voice,
Outbox, Feature, Retro, Timeline. Action words follow the subtitle's verb: Review and approve,
Answer the outbox, Fix with answers, Review the plan, Review the feature. Empty words say why, in a
sentence. "Slices", not "tasks", is the word for a plan's unit of work.

## Refusals

- A page never draws its own title, tabs or back link: it composes `PageHeader` and `Tabs`.
- A part never takes `className` or `style`: its look comes from its variant and the tokens.
- No second tab row, no More menu, no floating panel above a tab.
- A notice never uses a left stripe as its only signal of tone.

## Open questions

- Whether the breadcrumb of a fix page (`/visual/<id>`, `/bugs/<id>`) shows its product or only its
  kind.
- How many facts a meta row takes on a narrow phone before a fact moves into the About block.
- Whether `SegmentedControl` on a phone becomes a select, and at what width.

- omni-loop-23: whether the trail header becomes a variant of PageHeader, or stays the Tabs' own layout.

## Source

- omni-loop-20 spec, section 1 "The page anatomy, as parts in `@omni/ui`"
- omni-loop-20 spec, section 2 "Every page spans the full app width"
- apps/galaxy/src/page-width.test.ts
- packages/ui/src/ (the parts of omni-loop-10 and omni-loop-12)
/omni:brainstorm, PRD omni-loop-23: its before/after page, on the PRD's page (omni dossier get omni-loop-23 before-after)
