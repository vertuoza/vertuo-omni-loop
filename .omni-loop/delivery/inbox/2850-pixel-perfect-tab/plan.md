# Plan: A Pixel perfect tab of whole, numbered screens, iterated as an artifact first

PRD #2850, its spec beside this plan (`spec.md`). The feature branch `feat/pixel-perfect-tab` goes
into `main` through one draft feature PR (`Closes #2850`); each slice is a sub-PR from
`feat/pixel-perfect-tab--<slice>` into the feature branch (`Part of #2850`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni before-after new` writes a version 3 page: three tabs, one Pixel perfect section for the page, and a template that draws each marked screen whole at its declared width, isolated, scaled to fit, with its index and its 100 % view | `kit/templates/before-after/` `kit/lib/before-after/skeleton.` `kit/lib/before-after/template.` `kit/bin/commands/before-after.` `kit/bin/before-after.` `.omni-loop/knowledge/design/screens/before-after-page.` | — | 1 | deep |
| s2 | `omni check inbox` grades a version 3 page by the nine rules of the screens, and a version 2 page or a page with no meta exactly as before | `kit/lib/before-after/grade.` `kit/lib/inbox/check-inbox.` | — | 1 | build |
| s3 | The word pass reads the words inside a marked screen's `<template>`, and never a frame's caption | `kit/lib/design/words/` | — | 1 | build |
| s4 | The brainstorms draw whole, numbered screens in the third tab and show the graded page to its person first; `/omni:do-work` and `/omni:pr` find the screens line in either shape | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/mega-brainstorm/` `kit/plugin/skills/do-work/` `kit/plugin/skills/pr/` `kit/porting/plugin--` `kit/test/before-after-skills.` `kit/test/design-skills.` | s1, s2, s3 | 2 | build |
| s5 | The guide and `omni help before-after` say the three tabs, the references and the first look | `docs/guide/design.md` `docs/guide/first-prd.md` `kit/lib/help/entries.` | s1, s2 | 2 | light |

**Shared ground.**

- No prefix is declared by two slices. Wave 1's three slices own three separate folders or file
  families of the kit; wave 2's two slices own the skills and the guide.
- `kit/lib/before-after/` is split by file family: `skeleton.` and `template.` (s1), `grade.` (s2).
  `render.` is touched by nobody: a version 3 page renders its diagrams as a version 2 one does.
- The tests beside those files (`skeleton.test.ts`, `grade.test.ts`, `kit/lib/design/words/*.test.ts`)
  fall under their slice's prefix. The command's test, `kit/bin/before-after.test.ts`, is s1's, under
  `kit/bin/before-after.`.
- The skill guard tests that read `brainstorm/SKILL.md` (`kit/test/before-after-skills.test.ts`,
  `kit/test/design-skills.test.ts`) are s4's alone. `kit/test/agent-neutral.test.ts` reads every
  skill and is changed by nobody: s4 keeps it green.
- `kit/dist/` is generated: no slice commits it, the wave rebuilds it once after merging.

## Per slice: done when

### s1 (deep: one template must isolate, scale and index screens it has never seen, with no resource loaded)

- `omni before-after new <n> --services a,b` writes a page with the version 3 meta, the tabs
  Functional, Technical and Pixel perfect in that order, and one `pixel-perfect` section that
  belongs to no service; no service's Functional block holds a `pixel-perfect` section.
- The written page, its `FILL` marks replaced, loads no resource and passes today's grader.
- In a browser (the repository's Playwright, as `render.test.ts` does): a marked screen declaring
  `data-viewport="1280"` is laid out 1280 CSS pixels wide and scaled to fit its column; its 100 %
  control shows it at its real size.
- A style rule of the page does not change an element inside a marked screen, and a screen's rule
  changes nothing outside it; the screens' stylesheet is written once for the page.
- The Pixel perfect tab opens with an index listing every reference once, each linking to its
  frame; its label carries the count of screens; `#pixel-perfect` and `#s-2-C` open the tab.
- Today sits beside after when the window shows both at half their size or more, above it
  otherwise.
- The template starts from this PRD's own `before-after.html`, the prototype; the draft library
  screen `before-after-page` and its mockup are brought up to what the template draws.

### s2

- A version 3 page is refused, in words naming the file and the reference or the screen, for each
  of: a missing tab; no or several `pixel-perfect` sections, or one outside its tab; a marked
  screen outside the Pixel perfect tab; a filled section with no marked screen; a screen with no
  well-formed `data-ref`, `data-when` or `data-viewport`; a pair of reference and side written
  twice; a reference with no `after`; a number carrying two screens, or one screen under two
  numbers; a `data-screen` the `screens:` line does not name.
- A version 3 page that keeps them all is accepted, with the states, the `FILL` marks, the
  unrendered diagrams, the loaded resources and the size limit graded as on a version 2 page.
- A version 2 page, and a page with no meta, get exactly the violations they got before; this
  PRD's own page, version 3, is accepted.

### s3

- `omni design words` on a page whose marked screens hold their markup in a `<template>` counts
  the words of each screen and reports its findings, as it does for a screen written in place.
- On this PRD's own page it counts words in each of the five screens (it counts none today).
- A frame's caption, outside the marked element, is never read as a word of the screen.
- A page with no marked screen is skipped and says so, as today.

### s4

- `/omni:brainstorm` step 5 and Rework, and `/omni:mega-brainstorm` step 6, say: the three tabs;
  whole screens at their declared width inside their shared screens, from the library's mockup;
  the marks; the references, and that they are never renumbered. Mega-brainstorm groups the
  screens by repository, the numbers running across the page.
- The same skills say the first look: after the grader and before the commit; only with a tool
  that publishes a page privately to its person (in Claude: the Artifact tool), attended, and a
  graded page; one page and one link, opened for the person where the tool can; Iterate or Carry
  on; the read-back; the grader run again on the export; the link stored nowhere. With no such
  tool, or `OMNI_UNATTENDED` set, the steps read as a run with no first look.
- "Never publish it as a claude.ai artifact" is gone from both skills; in its place, the page is
  never published as the copy others read.
- Rework keeps a version 2 page in its shape unless the person asks for the new one.
- `/omni:do-work` and `/omni:pr` name the Pixel perfect tab beside the section, and find the
  `screens:` line and `Pixel perfect: no screen changes` in either shape.
- The porting notes record each change; the guard tests hold the phrases above;
  `kit/test/agent-neutral.test.ts` passes unchanged.

### s5 (light: wording only)

- `docs/guide/design.md` and `docs/guide/first-prd.md` say the three tabs, what a reference is and
  that it never changes, and the first look with its two answers.
- `omni help before-after` says the page it writes has three tabs.
