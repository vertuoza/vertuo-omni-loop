# Plan: a business law says for whom it plays out differently

PRD #3375, specified in `spec.md` beside this plan. The feature branch `feat/law-variants` merges into
`main` through one feature PR (`Closes #3375`); each slice is a sub-PR from `feat/law-variants--<slice>`
into the feature branch (`Part of #3375`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni check knowledge` reads `product/law-variants.json` and refuses what is wrong in it, by path, offline, and a Legal id the product does not hold, online | `kit/lib/knowledge/law-variants` `kit/lib/knowledge/check-knowledge.ts` `kit/lib/knowledge/check-knowledge-legal.ts` `kit/lib/knowledge/check-knowledge-law-variants.test.ts` | — | 1 | deep |
| s2 | `omni kb business-laws` prints a Differs for line under each law a variant names, and `omni kb law-variants [--base <ref>]` prints the file in words or only what changed | `kit/lib/knowledge/business-laws-text.ts` `kit/lib/knowledge/business-laws-home.ts` `kit/bin/commands/kb.ts` `kit/bin/kb-business-laws.test.ts` `kit/bin/kb-law-variants.test.ts` `kit/lib/help/entries.ts` `docs/guide/knowledge.md` | s1 | 2 | build |
| s3 | `get_knowledge` on a law or a Legal entry a variant names ends with a Differs for paragraph, and `search_knowledge` finds it by the variant's condition key | `kit/lib/knowledge/entries.ts` `kit/lib/knowledge/entries.test.ts` | s1 | 2 | build |
| s4 | the Business laws table on the Omni page shows a Differs for column, read from the law home's pack with the laws, in demo mode too | `apps/galaxy/src/product-knowledge/business-laws-load.ts` `apps/galaxy/src/product-knowledge/business-laws-load.test.ts` `apps/galaxy/src/product-knowledge/BusinessLawsSection.tsx` `apps/galaxy/src/product-knowledge/business-laws-section.ts` `apps/galaxy/src/product-knowledge/business-laws-section.test.ts` `apps/galaxy/src/product-knowledge/knowledge.css` `apps/galaxy/src/product-knowledge/product-knowledge.render.test.ts` | s1 | 2 | build |
| s5 | the Law variants section draws the matrix and its states, and a Legal entry a variant names shows its Differs for block | `apps/galaxy/src/product-knowledge/LawVariantsSection.tsx` `apps/galaxy/src/product-knowledge/law-variants-section` `apps/galaxy/src/product-knowledge/knowledge-sections.ts` `apps/galaxy/src/product-knowledge/knowledge-sections.test.ts` `apps/galaxy/src/product-knowledge/KnowledgeItem.tsx` `apps/galaxy/src/product-knowledge/KnowledgeNav.tsx` `apps/galaxy/src/product-knowledge/knowledge.css` `apps/galaxy/src/product-knowledge/product-knowledge.render.test.ts` `apps/galaxy/app/app/products/[id]/knowledge/[section]/page.tsx` | s4 | 3 | build |

**Shared ground.**

- `apps/galaxy/src/product-knowledge/knowledge.css` and `apps/galaxy/src/product-knowledge/product-knowledge.render.test.ts`
  are declared by s4 and s5: the page's one stylesheet and its render test, both of which the column and the
  section change. s5 is blocked by s4 (it reads the variants s4 adds to the load), so they sit in waves 2 and 3
  and never merge together.
- `kit/lib/knowledge/law-variants.ts` is s1's alone: s2, s3 and s4 import its parser, its freshness and its
  lines, and none edits it. It holds the pack reader (`lawVariantsOfPackFiles`) beside `lawsOfPackFiles`'s
  shape, so the MCP and the page read the file one way.
- `kit/dist/` and `apps/omni-app/api/` are built from these sources: each slice rebuilds them only to test,
  and the wave rebuilds them once after merging.

## Per slice: done when

### s1 (deep: the schema and its refusals are the contract every reader trusts)

- `kit/lib/knowledge/law-variants.ts` exports the zod schema of version 1, `parseLawVariants`,
  `lawVariantProblems`, `freshnessOf`, `variantLines`, `lawVariantsDiff` and `lawVariantsOfPackFiles`, each
  pure; `law-variants.test.ts` covers every field rule of the spec, unknown keys, `freshnessOf` at day 30
  (fresh) and 31 (stale) of 30 and for `unchecked`, and the diff (added, removed, changed fields as
  `old → new`, absent at base, no change). The clock is always passed in.
- `omni check knowledge` passes on the spec's example file and refuses, each named by file and JSON path:
  an undeclared audience (`law-variants.json: variants[0].audiences.BETTA — not a declared audience`), a law
  id that is none of the folder's business laws, a `legal` id `COOK-1`, `live` with `on: null`, an `on` after
  today, a duplicate variant id, an unknown key; it warns on a file over 512 KiB. No file: nothing printed.
- With no sign-in, a `legal` id the product does not hold is a note and the check passes; with the product's
  read stubbed, it is a violation. The tests live in `check-knowledge-law-variants.test.ts`;
  BR-PRODUCT-95's proof in `check-knowledge.test.ts` is untouched.

### s2

- Under `BL-PLANNINGANDTIMETRACKING-1`'s `Why:` line, `omni kb business-laws` prints `  Differs for:
  Internal, New tenants — Where Absences are recorded (flag remove-absences-sidebar-rh) · checked live
  2026-11-27 · v3.15.9`, ending ` · stale` past `staleAfterDays` and reading `· not checked` for an unchecked
  variant; `--domain` and `--spec` print the same lines. The variants come from the same place as the laws
  (this checkout, or the law home's pack).
- `omni kb law-variants` prints a block per variant, one naming no law included; with no file it says so in
  one line.
- After a fixture commit changing `"BETA": "off"` to `"on"`, `omni kb law-variants --base HEAD~1` prints that
  variant with `BETA: off → on` and nothing about the others; with no change, `law variants: no change since
  HEAD~1`; it exits 0 either way.
- `omni help kb` names `law-variants`, and `docs/guide/knowledge.md` shows the file's shape and the command.

### s3

- `knowledgeEntries` gives a business law a variant names a body ending with a `Differs for` paragraph, the
  same lines as the terminal's; a Legal entry a variant names gets the same paragraph; an entry none names is
  unchanged.
- `embedText` of that law holds the condition key and the feature, so a search for `remove-absences-sidebar-rh`
  ranks the law; a law home pack whose file does not read gives the laws as today, with no paragraph.

### s4 (`ui: yes`)

- `loadBusinessLaws` returns the variants of the same pack as the laws; a file that does not read returns the
  laws and a note, never `unreadable`.
- The Business laws table, on the section and on a domain's page, has a Differs for column: a named law shows
  a line per variant (the audiences mapped `on` as badges, the feature, the condition key as code, the check
  badge `live · <n>d`, `· stale` in the warning tone, `not checked` muted) linking to
  `…/knowledge/law-variants#<id>`; a law no variant names shows `—`.
- The section's lede reads "Read from `<home>` · newest merge".
- Demo mode shows one fictional variant on the fictional law.

### s5 (`ui: yes`)

- The sub-menu lists Law variants with its count right after Business laws; `/app/products/<id>/knowledge/law-variants`
  draws the matrix: a column per declared audience in file order, a row per variant (feature, condition under
  it), each cell `on`, `off` or `—`, then Laws and Legal as links and Checked; each row has its `id` as anchor
  and a disclosure with the on and off text and the check's note.
- With no file: "No law variant yet." and the file to add; a file that does not read: a notice naming the
  pack's commit with the first problem under it; no law home, no pack, unreadable: the Business laws texts.
- A Legal entry's page shows a Differs for block for each variant naming it, and no block when none does.
- The screens match `product-law-variants`, `product-business-laws` and `product-knowledge-item` in the design
  library, and `omni design words` finds nothing on the built pages.
