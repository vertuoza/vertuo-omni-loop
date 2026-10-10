---
title: Design craft (opt-in)
description: Turn on design craft, fill the design form, type /omni:pixel-perfect on a screen, and read the Design review the loop adds to a sub-PR that changes a screen.
---

Screens an agent builds tend to look generic: right enough, but not quite your product. **Design
craft** gives the loop an eye for that. It reads what your product looks like from one page of the
playbook, checks every screen it builds against it, and brings a set of design commands you can
type on any screen yourself.

It is **off by default**. A repository that does not turn it on sees no change at all, and turning
it off again brings the loop back to what it was. When it is on, **nothing it finds ever blocks**:
no slice stops, no check turns red, no pull request stays draft because of a design finding.

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

It has four sections, in `.omni-loop/knowledge/playbook/design.md`:

| Section | Required | What it holds |
|---|---|---|
| **Product** | yes | who uses the product, where, on what screens and under what light; its voice, and the words it uses and avoids |
| **System** | yes | where the design tokens, the type scale, the spacing, the colours and the components live, by path |
| **Deliberate** | no | what the product does on purpose, including any general design rule it sets aside, and why |
| **Review** | no | how to look at a screen: the routes, the widths (390 and 1440 when it names none), how to sign in |

**Your product wins.** The commands below come with a general quality floor and a list of patterns
that make a screen look machine-made. What the form says about your product, its design system and
what it does on purpose overrides both. If your product uses all capitals in its headings on purpose,
say so under **Deliberate**, and no review will ever "fix" it.

Already have a page that describes your design system, such as a `DESIGN.md`? Point the form at it
with a `See: DESIGN.md` line instead of copying it.

With design craft on, `/omni:invade` fills the form for you from what your repository shows (your
theme and token files, your component library, your fonts and global styles, your screens and their
copy), naming each file it read. Where the files do not say, it leaves a `TODO(human)` question for
you rather than inventing a direction. Run `/omni:invade --refresh` after your design system moves.
A repository with no screens keeps the form blank and the flag off.

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

Each command looks once, fixes in one batch, and checks once more, then stops. It changes only the
screen you named, and asks before going further. A redesign or a brand new screen is not its job:
that is a product decision, and starts at `/omni:brainstorm`. With design craft off, the command
prints one line saying how to turn it on, and does nothing else.

## What you see on a sub-PR

With design craft on, the review starts on its own: nobody asks for it. When `/omni:do-work` builds a
slice that changes a screen, it runs `/omni:pixel-perfect review` before the sub-PR is marked ready.

**How it knows a slice changes a screen.** `/omni:plan` marks a slice `ui: yes` when the files it
may touch meet `design.paths`. While it builds, the agent also asks the change itself:

```bash terminal agent
omni design touched
```

It prints `ui: yes` with the files that matched, `ui: no`, `ui: unknown` when `design.paths` is
empty, or `design: off`. It never fails.

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

`/omni:visual-fix` runs the same review when it looks at the real screen, against the variation you
picked. A visual fix has no outbox, so what it left is listed in its pull request's **Design
review** section.

## Turn it off

Set `design.enabled: false`, or remove the `design:` block. The form and anything you wrote in it
stay; the loop simply stops reading it, runs no review, and the sub-PRs have no **Design review**
section.

## Where the commands come from

The `/omni:pixel-perfect` commands are imported from [impeccable](https://github.com/pbakaus/impeccable)
by Paul Bakaus, which started from Anthropic's frontend-design skill, both under the Apache License
2.0, and were modified for the loop: they read your design form, let your product win, stay bounded
and never block. The kit owns the copy: nothing is installed and nothing calls the network. The
credit is in `kit/NOTICE.md`, and every change in `kit/porting/plugin--pixel-perfect.md`.

[Next → Validate with e2e (beta)](/docs/validate-e2e)
