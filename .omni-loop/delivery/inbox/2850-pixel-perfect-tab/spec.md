---
prd: 2850
title: A Pixel perfect tab of whole, numbered screens, iterated as an artifact first
blocked-by: none
spec: file
---

## Problem

The before/after page (PRD 2239) is what a person reads to approve a PRD. Two things fail them
today.

- **The screens are not screens.** The Pixel perfect section sits inside the Functional & design
  tab, one per service, and holds loose cards about 480 px wide: no app shell, no navigation, no
  real page width. PRD 2784's page shows six cards of a settings screen; the screen library's own
  mockup of that screen is fuller than the page that was approved. Nothing in the grader
  (`kit/lib/before-after/grade.ts`) asks a filled Pixel perfect section to hold a whole screen, so
  "pixel perfect" is a title, not a property.
- **A screen cannot be named.** A page with several screens and several states of each gives a
  reader nothing to point at. "The second card on the right" is how a change is asked for.
- **The person cannot iterate before it is written down.** `/omni:brainstorm` step 5 says "Never
  publish it as a claude.ai artifact", because an artifact is private to its author. That is true
  for the reviewers, and it also forbids the one use that helps: the author looking at the page,
  asking for changes and seeing them, before the page is committed and pushed to the PRD's page.
  An agent with such a tool (in Claude: the Artifact tool) never uses it.

## Solution

### 1. Three tabs

A page of the new shape carries `<meta name="omni-before-after" content="3">` and three tabs, in
this order:

| tab | `data-tab` | holds |
|---|---|---|
| **Functional** | `functional` | per service, the `functional` section: today beside after, in product words. Open when the page loads |
| **Technical** | `technical` | Flow, Deploy order, then per service `db`, `api`, `behaviour`, unchanged |
| **Pixel perfect** | `pixel-perfect` | one `data-section="pixel-perfect"`, once for the page, never per service |

- The Pixel perfect section keeps the three states. `filled`: the screens. `na`: the one line
  `Pixel perfect: no screen changes`, or `N/A — design craft is off here` with the design flag off.
  `gap`: `To settle — <what is missing>`.
- The tab is always there, so a reader always knows where to look, and its label carries the count
  of screens when filled (`Pixel perfect · 3`).
- `#pixel-perfect` in the address opens that tab, as `#technical` opens the Technical one.
- `omni before-after new` writes version 3 only. A version 2 page stays valid and is graded as
  today: no page in the inbox or shipped turns red.

### 2. Whole screens

In a filled Pixel perfect section, every screen is drawn whole:

- at its real width, which it declares (`data-viewport="1280"`; a phone screen `390`);
- inside the shared screens the library says it appears in (its app shell, its navigation), read
  from `omni design screens`: a page whose route a shared screen lists is drawn inside that shared
  screen;
- built from the library screen's mockup and the design form's `system` tokens, as step 5 already
  asks. "Today" is the library screen as it stands. "After" is that same screen with only what the
  approved design changes. A screen with no library file yet is drawn whole the same way, and that
  "after" is its draft.

The kit's template lays the frames out: the agent writes a screen at its real width and never
writes scaling. The Pixel perfect tab uses the window's full width, not the 1040 px column of the other
tabs. Each frame is scaled down to fit its column: today beside after when the window shows both
at half their size or more, today above after otherwise, and a frame opens at 100 % when its
reference is pressed. The
template's own styles never reach inside a marked screen, and a screen's styles never leak out of
it: a screen reads the same in the page as in its library mockup.

### 3. References

Every screen has a number and every state of it a letter:

- **`2`** is the second screen of the page; **`2.A`** its first state, **`2.C`** its third (an
  error, a confirm step, an empty list).
- A reference names one state of one screen. Its two sides are **`2.C` today** and **`2.C` after**;
  a state that does not exist today has only its after.
- Each frame shows its reference, the library name of its screen, Today or After, and its width:
  `2.C · quote-list · After · 1280`.
- References are **fixed once written**. A state removed in a later version leaves a hole: the
  others are never renumbered, so "change 2.C" means the same thing in every version of the page.
  A new state takes the next free letter, a new screen the next free number.
- The tab opens with an index of every reference, built by the template from the marks, each entry
  a link to its frame (`#s-2-C`).

The marks, on the element that holds the screen:

| mark | value | new |
|---|---|---|
| `data-screen` | the screen's library name; every state of screen 2 carries the same one | no (the word pass reads it) |
| `data-ref` | `<number>.<letter>`, as `2.C` | yes |
| `data-when` | `today` or `after` | yes |
| `data-viewport` | the screen's width in CSS pixels, a whole number from 320 to 2560 | yes |
| `data-primary` | on the one primary action of the screen | no |

The section keeps its `screens:` line (`screens: quote-list · app-shell`), which `/omni:pr` reads
for the feature PR's **Pixel perfect** line.

### 4. The grader

`omni check inbox` grades a version 3 page as it grades a version 2 one (states, no
`<!-- FILL -->`, no unrendered diagram, no loaded resource, the size limit), with these rules in
place of the two-tab rule. Each violation names the file and the reference or the screen.

1. The three tabs are there.
2. Exactly one `pixel-perfect` section, inside the `pixel-perfect` tab.
3. A marked screen (`data-screen`) outside the Pixel perfect tab is refused: the Functional tab is
   product words.
4. A `filled` Pixel perfect section holds at least one marked screen.
5. Every marked screen carries a well-formed `data-ref`, a `data-when` and a `data-viewport`.
6. A pair (`data-ref`, `data-when`) appears once.
7. Every reference has an `after`.
8. One number, one screen: every state of a number carries the same `data-screen`, and two numbers
   never carry the same one.
9. The `screens:` line names every `data-screen` the section holds.

The grader reads text, so it cannot measure a width. What makes a frame whole is the template
(rule: the screen is laid out at its declared width) and the skill's rule on shared screens; the
grader holds the declarations. That limit is said in **Risks**.

The word pass (`omni design words`) reads marked screens as today, and reads the words inside a
screen's `<template>`: on the prototype it finds the five screens and counts no word in them,
which is the gap to close. The frame's caption sits outside the marked element, so it is never
read as a word of the screen.

### 5. Shown to its person first

After the page is written, rendered, word-passed and graded, the skill shows it to its person
before committing it, when all three hold:

- the agent has a tool that publishes a page privately to its person and hands back a link (in
  Claude: the Artifact tool);
- `OMNI_UNATTENDED` is not set;
- the page passed `omni check inbox`.

Otherwise the step is skipped, saying nothing, and the skill runs as it does today.

How it runs:

1. **One page, one private link.** The whole `before-after.html` is published as it is, never a
   copy per tab or per screen: a change is often global ("every header darker"). The file is never
   changed to suit the host; a host that refuses the page is said in one line and the step is
   skipped.
2. **One question:** *Iterate* or *Carry on*, through the session's question tool. The page is
   opened for the person where the tool can; the question names the link and the references.
3. **Iterate.** The person says what to change, naming a reference when it is about one screen
   ("2.C: shorten the label"). The agent changes the file, runs the word pass and the grader, and
   republishes to the same link. Then it asks again.
4. **A change made on the page itself.** When the host lets the person change the page there, the
   agent reads the page back from the host before each change of its own and before carrying on:
   the host's copy is written over the file.
5. **Carry on.** The exported HTML is `before-after.html`. The word pass and `omni check inbox`
   run on it once more. A refusal is fixed, republished and shown again: what is committed is what
   the person last saw, and it passes.

The private page is the author's working copy and nothing more: its link is written in no file, no
issue, no pull request and no dossier. The file in the repository, reviewed in the phase-0 PR or on
the PRD's page, stays the only copy anyone else reads. The sentence "Never publish it as a
claude.ai artifact" becomes "never as the copy others read".

### 6. Where it applies

- `/omni:brainstorm` step 5, and **Rework**: a reworked version 2 page keeps its shape and is
  edited in place, unless the person asks for the new one; either way it is shown first.
- `/omni:mega-brainstorm` step 6: the Pixel perfect tab groups its screens by repository, the
  numbers running across the page.
- `/omni:do-work` and `/omni:pr` read "the Pixel perfect tab" where they read "the Pixel perfect
  section" of a version 2 page: the `screens:` line and the one line `Pixel perfect: no screen
  changes` are found the same way in both shapes.
- `/omni:visual-fix` writes its own page, with no `omni-before-after` meta. It is not changed.
- The user guide (`docs/guide/design.md`, `docs/guide/first-prd.md`) says the three tabs, the
  references and the first look.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | kit | meta `omni-before-after` content `3` ← the version 2 meta | `kit/lib/before-after/grade.ts:11` |
| vertuo-omni-loop | kit | `data-tab="pixel-perfect"` ← `data-tab="functional"`, `data-section="pixel-perfect"` | `kit/lib/before-after/skeleton.ts:18` |
| vertuo-omni-loop | kit | `data-ref`, `data-when`, `data-viewport` ← `data-screen`, `data-primary` | `kit/lib/design/words/pass.ts:3` |
| vertuo-omni-loop | kit | `#pixel-perfect`, `#s-<number>-<letter>` ← `#technical` | `kit/templates/before-after/page.html:83` |
| vertuo-omni-loop | design | library screen `before-after-page` ← no written convention: follows `prd-dossier.md` | `.omni-loop/knowledge/design/screens/prd-dossier.md` |

## Decisions

- **A third tab of the same file**, not a document of its own on the PRD's page (the person's
  choice): one file, one thing to review, and the dossier, its push and `omni phase0` are
  untouched.
- **One private page for the whole before/after**, not one per screen or per tab (the person's
  choice): a change is often global. References do the work several pages would have done.
- **Whole screens come from the screen library**, not from freezing the running product (the
  person's choice): it needs no reachable app, no sign-in and no fixtures. Freezing production is
  left out of this PRD.
- **Shown at the page step, with a pause**, not at the design gate (the person's choice).
- **A new meta version**, so that no page already written is graded by rules it was not written
  for.
- **The private link is never stored.** It is private to its author; a stored link would be a dead
  link for everyone else.
- **Agent-neutral words.** The skills name the ability ("a tool that publishes a page privately to
  its person"), then the Claude tool in brackets, as the kit does for asking (`kit/test/agent-neutral.ts`).
- **The file wins over the host.** The page is never bent to a host's own page rules; the grader
  is the only contract the page keeps.
- **This PRD's own page is version 3, written by hand** (the person asked to see the third tab
  before approving): it is the prototype of the template this PRD builds, and the kit on `main`
  grades it on its size alone. The slice that writes the template starts from it.
- **What the prototype settled.** A screen's markup sits in a `<template>` inside its marked
  element and is drawn in a shadow root, with one shared stylesheet for every screen of the page:
  that is the isolation of section 2, and the styles are written once. The product's own fonts are
  embedded as `data:` fonts when the design form names them and the size limit allows. A screen is
  written for its declared width: a media query of the product's stylesheet is resolved by the
  writer, since the frame is not a window.
- **The first look opens the page for its person**, where the agent's tool can, and does not only
  print a link (the person's remark on the first round).
- **No proof video** (the person's answer).
- **No personas were read** (no sign-in on this machine): no voice round and no `voice.json`.

## User stories

- As the author of a PRD, I see the page in a private link before it is committed, ask for changes
  by reference, and what I approved is what is pushed.
- As a reviewer, I open the Pixel perfect tab and see each screen whole, as it will be in the
  product, today beside after.
- As anyone commenting, I write "2.C" and everybody knows which state of which screen I mean, in
  every version.
- As a person using another agent, or a runner, nothing changes for me: the page is written and
  graded as before.

## Scope

In:

- the template (`kit/templates/before-after/page.html`): the third tab, the frames, their scaling,
  the index, the isolation of a screen's styles;
- the skeleton and `omni before-after new` (version 3);
- the grader's version 3 rules, in `omni check inbox`;
- the skills: `brainstorm` (step 5, Rework), `mega-brainstorm` (step 6), and the wording of
  `do-work` and `pr`; their porting notes;
- the guide pages, and the help entry of `omni before-after`;
- the rebuilt `kit/dist/`.

Out:

- freezing a screen from the running product;
- a Pixel perfect document of its own on the PRD's page, and any change to the dossier, its push
  or the PRD page;
- showing the concept tour (`/omni:think-big`), a library mockup (`/omni:pixel-perfect mock`) or a
  visual-fix round first;
- rewriting version 2 pages;
- storing or sharing the private link.

## Test seams

Following the testing form: pure functions tested on text, commands tested through their exit code
and output, skills held by guard tests on their text.

- `gradeBeforeAfter`: one test per rule of **The grader**, each naming the violation's words; a
  version 2 page graded exactly as before; a page with no meta untouched.
- `beforeAfterSkeleton`: version 3 meta, three tabs, one Pixel perfect section outside every
  service, no `pixel-perfect` section left in a service's Functional block.
- `omni before-after new`: writes a page the grader accepts once its `FILL` marks are replaced;
  `render` is unchanged on it.
- The template, in a browser (the repository's Playwright, as `render.test.ts` does): a marked
  screen is laid out at its declared width; a rule of the page's own styles does not restyle an
  element inside a screen; the index lists every reference; `#pixel-perfect` opens the tab.
- The word pass: a frame's caption is not read as a word of the screen.
- Skill guard tests (`kit/test/before-after-skills.test.ts`): step 5 names the three tabs, the
  references and the marks; the first look sits after the grader and before the commit; it names
  the three conditions and the skip; no skill says the private link is stored; the agent-neutral
  test still passes.
- The round trip with the host is agent behaviour, with no harness: it is proven once by hand, on
  this PRD's own page, and the feature PR says so.

## Risks

- **What merging publishes.** The kit: `kit/dist/omni.mjs` and the plugin's skills change for
  every repository at its next kit update. No migration, no API, no deploy of the arcade's data.
  Rollback is a revert of the feature PR; a version 3 page written meanwhile would then be graded
  on its size alone, as any page whose meta the kit does not know, so nothing turns red.
- **A page can still lie about its width.** The grader checks that a width is declared, not that
  the screen fills it or sits in its shell. The template lays it out at that width, the skill rule
  asks for the shared screens, and the person looks at it first: three guards, none of them a
  proof.
- **Size.** Whole screens weigh more than cards. `limits.beforeAfterMaxBytes` (512 000 here) is
  unchanged; a screen's styles are written once for the page, never once per frame. A page that
  cannot fit shows fewer states, never smaller screens.
- **The first look leaves the machine.** Publishing sends the page to the agent's host. It is
  private to its author, holds mockups and the design's own words, and never a secret; the step is
  skipped when unattended.
- **Two copies during the look.** The file and the host's page can differ while the person edits
  on the host. The read-back before every change and before carrying on is what keeps one truth.
- The Legal entries: not read (no sign-in on this machine); the design touches no personal data
  and no stored shape.
- The locked laws: `N-PRODUCT-15`: unreviewed work reaches every user, and nobody chose to ship
  it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub. The design
  does not change it: nothing here merges, and the first look approves no PRD.
- The business laws: none touched.

## Acceptance criteria

1. `omni before-after new <n> --services a,b` writes a page with the version 3 meta, the tabs
   Functional, Technical and Pixel perfect in that order, and one Pixel perfect section that
   belongs to no service.
2. `omni check inbox` refuses a version 3 page for each of the nine rules of **The grader**, in
   words that name the file and the reference or the screen, and accepts a page that keeps them
   all.
3. A version 2 page, and a page with no meta, are graded exactly as before this PRD.
4. Opened in a browser, a marked screen declaring `data-viewport="1280"` is laid out 1280 CSS
   pixels wide and scaled to fit its column; pressing its reference shows it at 100 %.
5. The Pixel perfect tab opens with an index listing every reference once, each linking to its
   frame; the address `#pixel-perfect` opens the tab.
6. A style rule of the page does not change an element inside a marked screen, and a screen's
   style rule changes nothing outside it.
7. `omni design words` on a version 3 page reports nothing from a frame's caption.
8. `/omni:brainstorm` step 5 and Rework, and `/omni:mega-brainstorm` step 6, say: the three tabs,
   whole screens at their declared width inside their shared screens, the references and that they
   are never renumbered.
9. The same skills say the first look: after the grader and before the commit, only with such a
   tool, attended, and a graded page; one page and one link; Iterate or Carry on; the read-back;
   the grader run again on the export; the link stored nowhere.
10. With no such tool, or with `OMNI_UNATTENDED` set, the skills' steps read as a run with no first
    look: nothing is published and nothing is asked.
11. `/omni:do-work` and `/omni:pr` find the `screens:` line and `Pixel perfect: no screen changes`
    in a version 3 page as in a version 2 one.
12. The guide says the three tabs, the references and the first look.
