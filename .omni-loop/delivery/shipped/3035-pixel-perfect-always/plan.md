# Plan: The Pixel perfect tab shows every changed screen, whatever is configured

PRD #3035, its spec beside this plan (`spec.md`). The feature branch `feat/pixel-perfect-always` goes
into `main` through one draft feature PR (Closes #3035); each slice is a sub-PR from its slice branch
into the feature branch (Part of #3035).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `/omni:brainstorm` step 5 draws every changed screen today beside after whatever is configured, with a best effort from the page's own code when design craft is off; the N/A line is gone; step 0's design flag paragraph says so | `kit/plugin/skills/brainstorm/SKILL.md` `kit/test/design-skills.test.ts` | — | 1 | build |
| s2 | the design guide's three-tabs section says the Pixel perfect tab draws a changed screen whether or not design craft is on | `docs/guide/design.md` `kit/test/design-guide-pixel-perfect` | — | 1 | light |

Shared ground: none. The two slices change different files and their own tests; `kit/dist/` is
generated and listed by no slice.

## Per slice: done when

### s1

- AC-1: the skill's step 5 says a PRD that changes a screen draws it whole, today beside after,
  design flag on or off, `design.paths` set or empty, a screen library or none, with the marks the
  grader reads; which screens: those the approved design changes, plus a file under `design.paths`
  when it lists globs.
- AC-2: the skill never writes `N/A — design craft is off here`; a PRD that changes no screen says
  `Pixel perfect: no screen changes`, whatever the flag.
- AC-3: with design craft off, today is read from the page's own markup, styles and words, after
  changes only what the design changes, no design form, screen library, word pass or draft screen is
  used, and a guess is said in one line under the screen.
- The test in `kit/test/design-skills.test.ts` that pinned the N/A line asserts the new rule, each
  criterion titled `AC-<n>: …`; `omni check context` stays under the brainstorm skill's ceiling.

### s2 (light: one guide section)

- AC-4: `docs/guide/design.md`, **The before/after: three tabs**, says the Pixel perfect tab draws a
  changed screen whether or not design craft is on, and what the best effort is with it off; a test
  titled `AC-4: …` reads it.
