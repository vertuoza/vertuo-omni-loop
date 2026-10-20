# Plan: the before/after page in two tabs

PRD #2239, spec beside this plan (`spec.md`). The feature branch `feat/before-after-two-tabs` goes into
`main` with `Closes #2239`; each slice is a sub-PR from `feat/before-after-two-tabs--<slice>` into the
feature branch, with `Part of #2239`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni check inbox` grades a page carrying `<meta name="omni-before-after" content="2">`: both tabs, a valid `data-state` on every section, no `<!-- FILL -->`, no unrendered `<pre class="mermaid">`, no external resource; a page without the meta is graded on its size only | `kit/lib/before-after/grade` `kit/lib/inbox/` | — | 1 | deep |
| s2 | `omni before-after new <n> --services …` writes the two-tab skeleton from `kit/templates/before-after/page.html`, and `omni help before-after` describes both verbs | `kit/templates/before-after/` `kit/lib/before-after/skeleton` `kit/bin/commands/before-after` `kit/bin/commands/index.ts` `kit/bin/before-after` `kit/lib/help/` `kit/bin/help.test.ts` | s1 | 2 | build |
| s3 | `omni before-after render <n>` turns each `<pre class="mermaid">` into inline SVG through the repository's Playwright and a pinned Mermaid, and refuses with the install line when no browser starts | `kit/lib/before-after/render` `kit/bin/commands/before-after` `kit/bin/before-after` | s2 | 3 | build |
| s4 | `/omni:brainstorm` step 5 and **Rework**, and `/omni:mega-brainstorm` step 6, write the page through `new` and `render`, in the two tabs, each section in one of three states | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/mega-brainstorm/` `kit/test/plugin.test.ts` `apps/galaxy/src/docs/skills` | s2 | 3 | build |

**Shared ground.** `kit/bin/commands/before-after` (the command file) and `kit/bin/before-after` (its
`main()` test) are declared by s2 and s3: s2 creates both with the `new` verb in wave 2, s3 adds
`render` in wave 3. `kit/lib/before-after/` is split by file prefix (`grade`, `skeleton`, `render`), so
s1, s2 and s3 never meet there. `kit/dist/` is generated and listed nowhere: each slice rebuilds it
only to test, the wave rebuilds it once after merging.

## Per slice: done when

### s1 (deep: delivery core, the gate's rules, mutation-tested)

- A pure grading of one page's text, in `kit/lib/before-after/grade.ts`, returns one violation per
  rule of spec §4, each naming the file, with fixture pages: a good page; a missing tab; a section
  with no state and one with an unknown state; a `<!-- FILL -->` left; a `<pre class="mermaid">`
  left (the message names `omni before-after render <n>`); an external `src` or stylesheet; and a
  page without the meta, which returns nothing.
- `gradeFolder` in `kit/lib/inbox/check-inbox.ts` adds those violations beside the size check, so
  `omni check inbox` and `inboxViolationsFor` (the GitHub App's phase-0 grading) report them.
- Through `main()`: a fixture inbox folder whose page breaks a rule makes `omni check inbox` red and
  names it; this repository's own inbox stays green.
- `pnpm mutation:changed --base origin/feat/before-after-two-tabs` leaves no survivor in the code
  written.

### s2

- `omni before-after new 2239 --services kit` writes a page whose head carries the meta, with the
  Functional & design tab first and checked, the Technical tab second, `#technical` opening it, one
  `data-service` block per named service in each tab, and every section a `<!-- FILL -->`.
- The page, with each `<!-- FILL -->` replaced by an `na` state, passes s1's grading.
- It refuses, writing nothing, a PRD with no inbox folder, an existing page without `--force`, and a
  missing or empty `--services`, each with one line and exit 1.
- The skeleton's styles cover light and dark, the `add`, `del` and `ctx` lines, the badges, and the
  collapsed `<service>: no technical change` line; it stays self-contained (no external resource).
- `omni help before-after` prints both verbs; `kit/lib/help/entries.test.ts` and
  `kit/bin/help.test.ts` are green; `kit/test/dist.test.ts` is green after `pnpm kit:build`.

### s3

- The browser is a provider passed in, as the pitch's capture is; no test starts Chromium or reaches
  the network.
- With a fake provider, `render` replaces every `<pre class="mermaid">` with its SVG inline, keeps the
  source in a `data-source` attribute, redraws an already rendered diagram from it, prints
  `rendered <section> of <service>` per diagram and exits 0.
- With no Playwright, it exits 1 with the line
  `cannot render the diagrams: <why>. Install it: pnpm add -D playwright && pnpm exec playwright install chromium`
  and leaves the page byte-identical.
- A diagram Mermaid refuses exits 1 naming its section, its service and Mermaid's first error line,
  the other diagrams still drawn.
- A rendered page passes s1's grading.

### s4

- `/omni:brainstorm` step 5 describes the two tabs, the sections and their three states, the
  breaking rule, and the order `omni before-after new` → fill → `omni before-after render` → word
  pass, with the pixel-perfect rules (design form, design memory, marks, drafts) kept unchanged under
  the Pixel perfect section; a diagram that cannot render becomes `gap` with its source in a
  `<details>`.
- **Rework** writes the page the same way, and keeps the old shape of a page without the meta unless
  the person asks.
- `/omni:mega-brainstorm` step 6 makes each repository a service, in the plan's build order.
- No skill names the skeleton's path; `kit/test/plugin.test.ts` and the docs tests are green.
