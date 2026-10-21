# Plan: Agents read the product's knowledge

PRD #2299, specified in `spec.md` beside this plan. The feature branch `feat/surface-product-knowledge`
merges into `main` through the feature PR; each slice's sub-PR, from `feat/surface-product-knowledge--<slice>`,
merges into the feature branch. `kit/dist/` is generated: no slice commits it, and the wave rebuilds it
once after merging.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A session starts with the capped Knowledge block: `omni kb index`, personas kept in the local copy, the second `SessionStart` hook, its help | `kit/lib/product/` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `kit/plugin/hooks/` `kit/test/hooks-json.test.ts` `kit/test/plugin.test.ts` `kit/lib/help/entries.ts` | — | 1 | build |
| s2 | The glossary's avoided words count: the word pass names them on screens, and `omni check inbox` warns on them in specs, never red | `kit/lib/design/words/` `kit/bin/commands/design.ts` `kit/bin/design-words.test.ts` `kit/lib/inbox/check-inbox` | — | 1 | build |
| s3 | Brainstorm, plan, do-work and bug-fix read `omni kb glossary` (and brainstorm and do-work `omni kb legal`) at the step their words come from, the page winning over `paths.glossary` | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/plugin/skills/do-work/` `kit/plugin/skills/bug-fix/` `kit/porting/plugin--` `kit/test/plugin.test.ts` | s1 | 2 | light |

**Shared ground.** `kit/test/plugin.test.ts` is declared by s1 (the hook entry) and s3 (the skills
naming `omni kb glossary` and `omni kb legal`): s3 waits for s1, in wave 2. s2 only reads
`PRODUCT_KNOWLEDGE_FILE` from `kit/lib/product/`, which s1 owns; it changes nothing there, and an
older copy without `personas` still reads, so s2 needs nothing of s1. `kit/dist/` is generated and
listed nowhere.

## Per slice: done when

### s1

- `omni kb index` prints, after a read of `GET /api/business?repo=`, the `Knowledge of <product>`
  block: words with their avoided words, each Legal id with its statement, each persona with its
  stance, and the three commands; at most 3 KB, a longer list ending `… <n> more: <command>` at a
  whole item.
- Offline it prints the copy with its age; with no copy, no product, no sign-in or no knowledge, one
  line ending `— agents carry on`; an archived product its one line; every outcome exits 0 within the
  3-second budget, held by a test whose server never answers.
- `--json` prints `{ state, product, words, legal, personas, syncedAt, cut }`.
- `.omni-loop/local/product-knowledge.json` keeps `personas` (name, stance); a copy without them
  still reads for `omni kb glossary` and `omni kb legal`.
- `kit/plugin/hooks/hooks.json` runs `omni kb index || true` after `omni constituents`, with a
  10-second timeout; `kit/test/hooks-json.test.ts` asserts it.
- `omni help kb` lists `index`.

### s2

- `omni design words` reports a glossary avoided word on an "after" screen as
  `avoided word: <word> → say <term>`, beside the design form's own words; with no copy, nothing
  more.
- `omni check inbox` prints `<folder>/spec.md: "<word>" ×<n> → say <term>` once per avoided word in
  an inbox spec, matched whole and without case, never inside another word; its exit code is the
  same with and without these lines.
- Both read the local copy only; no test reaches a server.

### s3 (light: skill wording only)

- `/omni:brainstorm` reads `omni kb glossary` where its words come from (steps 4 and 6) and
  `omni kb legal` before **Risks**, naming in **Risks** each Legal entry the design touches.
- `/omni:plan` step 1 reads `omni kb glossary` beside `paths.glossary`.
- `/omni:do-work` step 4 reads `omni kb glossary`, and `omni kb legal` when the slice touches
  personal data, keys, logs or licences.
- `/omni:bug-fix` reads `omni kb glossary` for the nouns and verbs of the reproduction.
- Each says the page wins over `paths.glossary` on a term both define, and that an offline or
  product-less read carries on with what it has.
- Each skill's porting note in `kit/porting/` records the change; `kit/test/plugin.test.ts` asserts
  the four skills name the commands.
