---
title: Design craft (opt-in)
description: Turn on design craft, fill the design form and its laws, keep a library of screens and shared screens a person locks, draw each screen's mockup and see them all in the gallery, run the word pass, read the before/after's Functional and Pixel perfect parts, type /omni:pixel-perfect on a screen, and read the Design review the loop adds to a sub-PR that changes a screen.
---

Screens an agent builds tend to look generic: right enough, but not quite your product. **Design
craft** gives the loop an eye for that. It reads what your product looks like from one page of the
playbook, checks every screen it builds against it, and brings a set of design commands you can
type on any screen yourself.

It also gives the loop a **memory**: the laws your screens follow, and a library of the screens
you have decided, so the next agent builds on what you chose instead of starting from zero.

It is **off by default**. A repository that does not turn it on sees no change at all, and turning
it off again brings the loop back to what it was. When it is on, **nothing it finds ever blocks**:
no slice stops, no check turns red, no pull request stays draft because of a design finding. There
is one exception, on purpose: a screen or a law a person locked is not changed without them (see
**Changing a locked screen asks its owner**, below).

![Where design craft gets your product's look: /omni:invade reads your repository's tokens, components, fonts, screens and DESIGN.md into the design form, with its five sections, and drafts the screen library beside it; /omni:pixel-perfect and the loop's skills read both; with design.enabled false, the default, nothing runs](diagrams/design-craft.svg)

## Turn it on

A few lines in `.omni-loop/config.yml`, merged like any other change:

```yaml file=.omni-loop/config.yml
design:
  enabled: true
  paths:
    - "src/components/**"
    - "src/app/**/*.tsx"
    - "src/styles/**"
```

- **`design.enabled`**: `false` by default. Every part of design craft reads it first; while it is
  `false`, nothing below runs.
- **`design.paths`**: where your screens, styles, design tokens and components live, as globs.
  Empty by default. The loop uses it to tell whether a change touches a screen (below). Left empty,
  the agent judges from the change itself, and says that it judged.
- **`design.screens`**: the folder of the screen library (below). By default `design/screens/`
  in your knowledge folder, `.omni-loop/knowledge/design/screens/`.
- **`design.words`**: tunes the word pass (below). `sentence` is how many words make a sentence
  (7 by default), `screen` and `primary` the selectors that mark a screen and its main action
  (`[data-screen]` and `[data-primary]` by default), `content` the selector that marks content
  the screen shows rather than words it wrote (`[data-content]` by default), and `avoid` a list of
  words your product never uses (empty by default).
- **`design.ignore`**: globs `omni design touched` drops from a change before it reads it (below).
  You rarely set it: left out, it is the common test shapes, `**/*.test.*`, `**/*.spec.*`,
  `**/__tests__/**` and `**/test/**`, so a change made only of tests is no screen change. Set your
  own list when your tests live elsewhere, or `[]` to drop nothing.
- **`commands.design`**, under the `commands:` block you already have: a design linter you already
  use, such as `npx impeccable detect src`, run during each review. `null` by default: the review then says `Design lint: not set here`. The
  loop never installs one for you.

`omni config design` prints what the repository has. You rarely write this by hand:
[`/omni:invade`](/docs/invade) proposes it when it finds screens in your repository (below).

## Tell it what your product looks like

The loop reads your product's look from one form of the playbook, `design`:

```bash terminal agent
omni kb show design
```

It has five sections, in `.omni-loop/knowledge/playbook/design.md`:

| Section | Required | What it holds |
|---|---|---|
| **Product** | yes | who uses the product, where, on what screens and under what light; its voice, and the words it uses and avoids |
| **System** | yes | where the design tokens, the type scale, the spacing, the colours and the components live, by path |
| **Deliberate** | no | what the product does on purpose, including any general design rule it sets aside, and why |
| **Review** | no | how to look at a screen: the routes, the widths (390 and 1440 when it names none), how to sign in |
| **Language** | no | your product's laws: the rules every screen follows, each one locked by a person |

**Your product wins.** The commands below come with a general quality floor and a list of patterns
that make a screen look machine-made. What the form says about your product, its design system and
what it does on purpose overrides both. If your product uses all capitals in its headings on purpose,
say so under **Deliberate**, and no review will ever "fix" it.

### Laws, in the Language section

A law is one rule your screens follow, such as "one primary action per place". Each law is a
heading, then a **lock line** saying who decided it, when and in which words, then the law itself:

```markdown file=.omni-loop/knowledge/playbook/design.md
## Language

### One primary action per place
🔒 2026-10-10 · @ana · "only one blue button, ever"

A place holds one primary action and at most one quiet one.

#### Amended 2026-11-02 · @ana · "dialogs may have two"
```

A law is never rewritten. When it changes, its owner adds an **amendment** below it: a dated
`#### Amended` line, in their words. Only a person writes a lock line or an amendment line; an
agent never does. The kit ships no law, only the shape: every law is yours. Your laws win over
the general quality floor, as the rest of the form does.

Already have a page that describes your design system, such as a `DESIGN.md`? Point the form at it
with a `See: DESIGN.md` line instead of copying it.

With design craft on, `/omni:invade` fills the form for you from what your repository shows (your
theme and token files, your component library, your fonts and global styles, your screens and their
copy), naming each file it read. Where the files do not say, it leaves a `TODO(human)` question for
you rather than inventing a direction. Run `/omni:invade --refresh` after your design system moves.
A repository with no screens keeps the form blank and the flag off.

## The screen library

The library is a folder of plain files, one per screen of your product: what the screen shows,
and whether someone decided it. Any agent and any person can read them and see what changed.

```markdown file=.omni-loop/knowledge/design/screens/quote-editor.md
---
screen: quote-editor
status: locked
locked-by: "@ana"
locked-on: 2026-10-10
quote: "this is the editor, build it"
kind: page
mock: quote-editor.html
implements: [src/quotes/editor/QuoteEditor.tsx, src/quotes/editor/editor.css, src/quotes/editor/words.ts]
reads: [src/quotes/pricing/]
routes: [/quotes/:id]
supersedes: null
---

## Purpose
## Regions
## States
## Words
## Refusals
## Open questions
```

- The top block says the screen's **status**, who locked it, when and in which words, its
  **kind** (`page`, the default, or `shared`, below), its mockup
  (`mock`, an HTML page beside the file, below), the files it is drawn from (`implements`), the
  code behind it (`reads`, optional) and the addresses it lives at (`routes`).
- **Regions** says what each part of the screen shows and where its data comes from; **States** its
  empty, loading and error states; **Words** its labels; **Refusals** what it does not do, on
  purpose; **Open questions** what is still undecided.

A screen is in one of three states:

| Status | What it means |
|---|---|
| **draft** | a starting point. Anyone may change it, and it holds nothing up |
| **locked** | a person decided it. Agents build it as written, and never redesign it |
| **superseded** | replaced whole by a newer screen. It is kept, never deleted, and the new screen names it in `supersedes` |

### What a screen claims: `implements` and `reads`

A screen names its code in two lists, split by one rule, in four lines:

- **A file whose change can change what a person sees on this screen goes in `implements`**, the
  data files that hold its words included.
- **A file the screen only depends on goes in `reads`.**
- **Structure several pages share is a shared screen of its own** (below); each page lists its
  files in `reads`.
- **A view file two pages share, and that is not structure, goes in `reads` on each.**

Every skill that writes a screen states the rule in these lines.

- **`implements`** holds what the screen is drawn from: its layout, its styles, its words. This is
  what a lock guards: a change there to a locked screen asks its owner (below).
- **`reads`** holds the code behind it: engines, data, rules. Agents read it for context when they
  build or review the screen, but a change there **never** trips a lock. The developer who fixes
  the pricing engine behind a locked quote editor does not wait for anyone.

`reads` is optional: a screen without it reads as an empty list, and nothing written before has to
change. Name files in `implements`, not folders: a folder there means a lock trips on every file
in it, the engine's included. `omni check design` warns about each one, and still passes.

![What a screen claims: implements, the files it is drawn from, where a change to a locked screen raises a high outbox item and a change that leaves the mockup alone is named mock may be stale; the screen's file and its mockup, one HTML page drawn by /omni:pixel-perfect mock; reads, the code behind it, which never trips a lock; below, design.ignore drops tests before touched reads a change, and omni design gallery shows every screen on one page that is never committed](diagrams/screen-claims.svg)

There is no index to keep by hand. To see the library:

```bash terminal agent
omni design screens
```

```text terminal
app-shell     draft · shared  —                /quotes · /quotes/:id
quote-editor  locked          @ana 2026-10-10  /quotes/:id
quote-list    draft           —                /quotes
quote-new     draft           —                —
quote-old     superseded      —                —
```

One line per screen, sorted by name: its status, `shared` beside a shared screen, who locked it
and when, and its routes. It also names any file whose top block does not read, and says so when
the library is empty.

### Shared screens

Some structure is on many pages at once: the app shell (the sidebar and top bar around every page),
the notifications bell and its panel, a sign-in page, a dialog, a toast. A change to it changes
what a person sees everywhere, so it is not the code "behind" a page: it is a **shared screen**, a
screen of its own, with `kind: shared` in its top block.

```markdown file=.omni-loop/knowledge/design/screens/app-shell.md
---
screen: app-shell
status: draft
kind: shared
mock: app-shell.html
implements: [src/shell/AppShell.tsx, src/shell/Sidebar.tsx, src/shell/shell.css]
routes: [/quotes, /quotes/:id]
---
```

- It has everything a page has: its own `implements`, mockup, lock, review and place in the
  gallery. With no route of its own, its `routes` name the pages it appears on.
- **Each page it appears on lists its files in `reads`**: `quote-list` and `quote-editor` read
  `src/shell/`, they do not implement it.
- **Locking the shell guards the shell, and only the shell.** A change to the shell's files never
  trips a page's lock, and a change to a page never trips the shell's. A shared screen starts as a
  draft, like any other, and holds nothing until a person locks it.
- `kind` is optional: a screen without it is a `page`, so nothing written before has to change. Any
  other kind is refused by name. The kit names no shared screen: your repository draws its own.

![Shared screens and what holds a change: the page quote-list implements its own files and reads the shell's; the shared screen app-shell, kind: shared, implements the shell; only a change to a screen's own implements can hold it; the review reports a fault in a part the change did not touch under Seen, not touched, never against the work; below, the before/after's Functional part, then its Pixel perfect part naming the screens, or Pixel perfect: no screen changes, which runs no design work, and the feature PR's Pixel perfect line](diagrams/shared-screens.svg)

![A screen's life: a skill writes it as a draft; a person locks it with their login, the date and their words; a change asks its owner through a high outbox item and adds a dated amendment line; a screen replaced whole is superseded, kept and named by its replacement](diagrams/screen-life.svg)

### Who writes drafts, who locks

**The loop writes drafts.** `/omni:visual-fix` writes the variation you picked; `/omni:brainstorm`
writes the approved "after" of each screen it draws; `/omni:think-big` writes the screens of the
concept you crowned; and `/omni:invade` drafts an entry for each screen it can prove your
repository has, with every undecided point under **Open questions**. Each one writes
`status: draft`, splits the screen's code between `implements` and `reads` by the rule above, and
says where it came from. None of them locks anything.

**Only a person locks**, in their own words (in your agent's form:
[Any coding agent](/docs/any-agent#set-up-your-agent)):

```text agent
/omni:pixel-perfect lock quote-editor
```

It shows you the screen, asks for one sentence in your words on what you are deciding (unless you
already said it, as in `lock quote-editor, this is the editor, build it`), and records your GitHub
login, today's date and your words, word for word. It commits that one file on the branch you are
on, and pushes nothing. A law is locked the same way:
`/omni:pixel-perfect lock law "One primary action per place"`. Picking a variation or approving a
design is not a lock: a screen stays a draft until its person locks it here.

To change a locked screen yourself, say the change in the same command (`lock quote-editor, the
totals move to the top`). It adds a dated amendment line under the top block,
`> Amended 2026-11-02 · @ana · "<your words>": <what changed>`, and changes the body. An amendment
line is never removed.

Every skill that draws or builds a screen reads the form and the library first: a locked screen is
built as written, a draft is a starting point.

### Changing a locked screen asks its owner

This is the one place design craft blocks, on purpose. When a change an agent builds departs from
a locked screen or a locked law, the agent builds what was asked, leaves the locked file as it is,
and raises a **high item** in the outbox naming the screen, the change and who locked it. The gate
stays red until that person answers; if they agree, they add the amendment line in their words. An
agent never edits a locked screen or law, and never writes an amendment line.

A silent edit does not get through either:

```bash terminal agent
omni check design
```

It runs as part of `omni check all`, and refuses:

- a locked screen or law whose text changed against the default branch without a new amendment
  line, naming who to ask;
- an amendment line that was removed, or that does not read;
- a screen whose top block does not read;
- a `superseded` screen that no other screen names in `supersedes`.

A draft changes freely. It also warns, on standard error, and still passes:

```text terminal
warning: quote-editor: implements names a folder (src/quotes/editor/) — a lock trips on every file in it; put the code behind the screen in reads
```

## Mockups and the gallery

A screen's mockup is the picture a lock is made against: one HTML page beside the screen's file,
named by its `mock`. It is HTML, never a screenshot, because the word pass and a lock read text,
never pixels, and no image goes into git. To draw one:

```text agent
/omni:pixel-perfect mock quote-editor
```

It reads the screen's file, its `implements` and its `reads`, and the design form, takes a
screenshot of the screen when the app runs here (the form's **Review** section says how), and
writes `quote-editor.html` beside `quote-editor.md`: one self-contained page, with inline styles
and drawings, no script, no remote font or image. The screen is the element marked
`data-screen="quote-editor"`, and each primary action carries `data-primary`; an explanation of
the mockup sits outside the mark. It runs the word pass on it and fixes what it finds, then sets
the screen's `mock` and changes nothing else in the file. Typed by you, it commits the screen and
its mockup on the branch you are on, and pushes nothing.

On a **locked** screen it never overwrites the mockup. It writes the new one as a draft beside it,
`quote-editor-next.md` and its mockup, and raises the high outbox item a change to a locked screen
always raises: its owner takes it with `/omni:pixel-perfect lock` (below).

### Standing in

A mockup is one self-contained page: it cannot load the product's fonts, its images or its data.
`mock` stands in for each, and never guesses or leaves it out:

| What is missing | What stands in |
|---|---|
| **Fonts** | the product's faces named first in each `font-family`, with the fallbacks the product itself uses; no font is loaded |
| **Pixel art and images** | an inline SVG placeholder at the image's real size, labelled with what it stands for |
| **Example data** | allowed, and expected on a screen that shows data: taken from the product's own demo data or fixtures when they exist, realistic, put inside `data-content` (below), and said to be examples outside the marked screen |
| **No screenshot** | the screen is drawn from the source, and the mockup says so outside the mark |
| **No gallery yet** | open the `.html` file directly |
| **An undecided primary action** | the one the screen's own words point to is marked, the mockup says so outside the mark, and the question stays in the screen's **Open questions** |

**A stale mockup is named, never blocked.** When a change touches a screen's `implements` but
leaves its mockup alone, `omni design touched` adds a `mock may be stale: quote-editor` line, and
the design review reports it. A change under `reads` never marks a mockup stale. A draft with no
mockup is fine.

To see every screen at once:

```bash terminal agent
omni design gallery
```

It writes one page of the whole library and prints its path: each screen with its status, who
locked it and when, its routes and its mockup (or `no mockup`), locked screens first, then drafts,
then superseded, and the shared screens in a group of their own, after the pages. The page goes to a fresh folder under your system's temporary folder, or to the
file `--out <file>` names. It is written anew each time and **never committed**: there is no index
to keep. An empty library prints `no screen yet` and writes nothing.

## The word pass

Mockups often ship with wording faults: a sentence on a button, two main actions on one screen,
text explaining the screen to someone who is only looking at it. The word pass reads the words
before a person sees them:

```bash terminal agent
omni design words .omni-loop/delivery/inbox/7-quotes/before-after.html
```

It lists the visible words of each marked screen in the page, and flags four things:

| Rule | It flags |
|---|---|
| `sentence-on-control` | a button or link whose label holds 7 words or more (`design.words.sentence`) |
| `two-primaries` | more than one primary action on one screen |
| `explains-at-rest` | a sentence on the screen, outside any button or link, longer than 7 words |
| `avoided-word` | a word your product avoids: one of `design.words.avoid`, or of the list the form's **Product** section gives on a line such as `Words we avoid:` |

```text terminal
before-after.html
  screen quote-editor · 31 words
    Quote (1)
    [control] Save (1)
    [control] Send the quote to the customer right now please (9)
    ! sentence-on-control: "Send the quote to the customer right now please" — 9 words on a control (7 or more)
    ! two-primaries: 2 primary actions — "Save", "Send the quote to the customer right now please"
```

**It reads the page's structure, never its look, and only the screens it marks.** A screen is an
element marked `data-screen`, its primary action one marked `data-primary`. Every mockup the loop's
skills write is marked that way: the before/after pages, the visual-fix rounds, the think-big
boards and the screens' own mockups. What explains the page sits outside every mark, so a caption
is never mistaken for a screen's words. A page with **no** screen marked is skipped, with no
finding:

```text terminal
before-after.html
  no screen marked: skipped ([data-screen])
```

**Copy apart from content.** Some of what a screen shows is not words it wrote: the PRD text in a
dossier's pane, the figures on a dashboard, a customer's name. Mark it `data-content`, and the pass
counts it apart, as `content · <n> words`, and raises no finding on it. It is not skipped silently:
you see what was left out. Set `design.words.content` when your mockups mark content another way.

**How it cuts the words into strings:**

- **A sentence stays whole.** A phrasing element inside running text (`a`, `b`, `code`, `em`,
  `span`, `strong`, `time` and the like) does not split it: `on <code>main</code> (2026-10-11)`
  is one string.
- **Two neighbouring blocks are two strings**, and so are neighbouring elements with no running
  text around them: `<span>ask.client.ts</span><span>POST</span>` reads `ask.client.ts` and
  `POST`, never glued together.
- **A control's parts are words apart.** Inside a control, two neighbouring elements are joined
  with a space: `<b>CREW TOP 5</b><span>NO SCORES YET</span>` reads `CREW TOP 5 NO SCORES YET`.

```text terminal
dossier.html
  screen prd-dossier · 10 words
    Shipped on main (2026-10-11) (4)
    [control] CREW TOP 5 NO SCORES YET (6)
    content · 412 words
    findings: none
```

A control is a button, a link, or any element marked `data-primary`, whatever its tag. If your own
mockups use other markers, set `design.words.screen`, `design.words.primary` and
`design.words.content` to your selectors.

**It never blocks.** It always exits 0 and prints what it found. `/omni:brainstorm`,
`/omni:visual-fix` and `/omni:think-big` run it before showing you a mockup and fix what it finds,
and the review's critique runs it too. A finding is fixed in the screen, never silenced.

## The before/after: a Functional part and a Pixel perfect part

With design craft on, the before/after page `/omni:brainstorm` writes for a PRD has two parts, in
this order, each under its own heading:

- **Functional:** what the change does, today beside after: the flow, the data, the exchange.
  Every PRD has it.
- **Pixel perfect:** only when the change changes a screen: the marked screens, today beside after,
  and one line naming the library screens they are, shared screens included
  (`screens: quote-list · app-shell`). It is the part the review and the word pass read, and the
  one a reviewer looks at closely.

A PRD that changes no screen (a database fix, a guard, a doc) has the Functional part alone, and
says, in place of the second, the one line `Pixel perfect: no screen changes`. Then **no slice
runs design work for it**: no review, no mockup, no word pass. Each sub-PR's **Design review** is
the one line `— Design review: no screen changes (Pixel perfect: no screen changes)`.

The feature pull request says where to look, right after its link line:

```markdown github
**Pixel perfect:** quote-list · app-shell
```

It names the screens of the before/after's `screens:` line, or `none` when the page says
`Pixel perfect: no screen changes`. `/omni:visual-fix`'s page is all screens: it is the Pixel
perfect part alone. With design craft off, the before/after is written in one part, as before,
and the pull request has no such line.

## Use it on a screen

Type a command and the screen you mean:

```text agent
/omni:pixel-perfect polish the quote page
```

| Command | What it does |
|---|---|
| `critique` | does the screen read as your product: hierarchy, clarity, voice, the tokens and components it uses |
| `audit` | accessibility, performance, theming and mobile, scored |
| `polish` | the last pass: agreement with your design system, spacing, states, details |
| `harden` | empty, loading and error states, long text, other languages, edge cases |
| `typeset` | type choices, sizes, hierarchy |
| `layout` | spacing, rhythm, grid, alignment |
| `adapt` | mobile and desktop, touch targets, breakpoints |
| `clarify` | labels, error messages and empty states, in your product's words |
| `review` | the bounded review the loop runs on its own (below) |
| `mock` | draws a screen's mockup, beside its file in the library (above) |
| `lock` | locks a screen of the library or a law, in your words (above) |

Each command looks once, fixes in one batch, and checks once more, then stops. It changes only the
screen you named, and asks before going further. A redesign or a brand new screen is not its job:
that is a product decision, and starts at `/omni:brainstorm`. With design craft off, the command
prints one line saying how to turn it on, and does nothing else.

## What you see on a sub-PR

With design craft on, the review starts on its own: nobody asks for it. When `/omni:do-work` builds a
slice that changes a screen, it runs `/omni:pixel-perfect review` before the sub-PR is marked ready.

![The design review on a slice: omni design touched decides whether a screen changed; when it did, a critique, an audit, the lint, screenshots at 390 and 1440 and one batch of polish, then a Design review section on the sub-PR, and what it left goes to the outbox; it never blocks](diagrams/design-review.svg)

**How it knows a slice changes a screen.** `/omni:plan` marks a slice `ui: yes` when the files it
may touch meet `design.paths`. While it builds, the agent also asks the change itself:

```bash terminal agent
omni design touched
```

It first drops every changed file a `design.ignore` glob matches (by default the test shapes), so a
change made only of tests reads `ui: no`. Then it prints `ui: yes` with the files that matched,
`ui: no`, `ui: unknown` when `design.paths` is empty, or `design: off`. It never fails. When the
change touches the code of screens in the library, it adds a `screens:` line: each screen whose
`implements` it touches, with its status and routes (🔒 means locked), then each screen it reaches
only through `reads`, as `reads <screen>`, which trips no lock. A screen whose `implements` changed
while its mockup did not gets a `mock may be stale` note:

```text terminal
ui: yes
  src/quotes/editor/QuoteEditor.tsx
  src/quotes/list/QuoteList.tsx
  src/quotes/pricing/total.ts
screens: quote-editor 🔒 (/quotes/:id) · quote-list (draft) (/quotes) · reads quote-totals
mock may be stale: quote-editor
```

The review screenshots those routes, and compares a locked screen with its mockup. A difference
from a locked screen is the high outbox item above, never an edit of the screen. A shared screen
the change touched is screenshotted **in place**, on one page it appears on, as well as on its own.

**Only what a change touches can hold it.** A lock trips only when the change touches that screen's
own `implements`. A change to its `reads`, to another screen, or to a shared screen it shows is no
change to it.

**The review, in five steps:** a critique against your design form, an audit, your design linter
when you set one, screenshots at the form's widths compared with the "after" screen of the PRD's
before/after page, then one batch of fixes and one more look. Its fixes stay inside the files the
slice may touch.

The sub-PR then carries a **Design review** section, one line per step:

```markdown github
## Design review

- ✓ Critique — reads as the product; 2 fixed (the empty state's copy, the table's header weight)
- ✗ Audit — 1 left: focus ring on the date picker, outside the slice (item s3-02)
- — Design lint: not set here
- ✓ Screenshots — 390 and 1440, beside the before/after page's "after"
- ✓ Polish — one batch, confirmed at 390 and 1440
```

- **✓** done, nothing left.
- **✗** done, something left. What the review did not fix becomes a question in the PRD's outbox,
  with the fix it would make and why it left it: you answer it with the others, on the feature pull
  request.
- **—** not run, and why. A slice that changes no screen shows one line,
  `— Design review: no screen changed (ui: no)`. When the app cannot run or cannot be seen where the
  agent works, the line says so, and nothing is reported as seen.

### Seen, not touched

A screenshot shows the whole page, not only what the slice changed. A fault the review sees in a
part the change did not touch (another screen, or a shared screen the change left alone) is not the
slice's: the developer fixing the quote list is never held by a bug in the menu. It goes under its
own heading at the end of the **Design review**, apart from the slice's findings:

```markdown github
### Seen, not touched

- — app-shell: the menu's active item loses its highlight at 390 (not touched here; file it as a bug of its own)
```

It is never a finding against the slice, never fixed in it, never an outbox item and never a
block. The review names the screen it sits on and suggests filing it as a bug of its own, through
`/omni:bug-fix` or `/omni:visual-fix`; it files nothing itself. No such fault, no heading.

`/omni:visual-fix` runs the same review when it looks at the real screen, against the variation you
picked. A visual fix has no outbox, so what it left is listed in its pull request's **Design
review** section.

## Turn it off

Set `design.enabled: false`, or remove the `design:` block. The form, its laws and the screen
library stay; the loop simply stops reading it, runs no review, and the sub-PRs have no **Design review**
section.

## Where the commands come from

The `/omni:pixel-perfect` commands are imported from [impeccable](https://github.com/pbakaus/impeccable)
by Paul Bakaus, which started from Anthropic's frontend-design skill, both under the Apache License
2.0, and were modified for the loop: they read your design form, let your product win, stay bounded
and never block. The kit owns the copy: nothing is installed and nothing calls the network. The
credit is in `kit/NOTICE.md`, and every change in `kit/porting/plugin--pixel-perfect.md`.

[Next → Validate with e2e (beta)](/docs/validate-e2e)
