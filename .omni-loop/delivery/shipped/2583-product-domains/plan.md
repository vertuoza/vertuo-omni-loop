# Plan: A product's governed list of domains

PRD #2583, spec in `spec.md` beside this plan. The feature branch `feat/product-domains` goes into `main`
with `Closes #2583`; the sub-PRs go from `feat/product-domains--<slice>` into the feature branch with
`Part of #2583`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A product has a governed list of domains: the Domains section lists them, and a person who decides adds, edits and retires one, while any other member proposes | `supabase/migrations/` `supabase/checks/product_domains.sql` `supabase/checks/product_knowledge.sql` `apps/galaxy/src/product-knowledge/` `apps/galaxy/app/app/products/[id]/knowledge/` `.omni-loop/knowledge/design/screens/product-domains` `.omni-loop/knowledge/design/screens/product-knowledge` | — | 1 | deep |
| s2 | A glossary term names zero, one or several domains, on its page and in the business read, and the Glossary lists and filters them | `supabase/migrations/` `supabase/checks/product_domains.sql` `supabase/checks/business.sql` `apps/galaxy/src/product-knowledge/` `apps/galaxy/app/app/products/[id]/knowledge/` | s1 | 2 | build |
| s3 | The Domains section shows the folders of a product's repositories that are not on the list, with a count on the sub-menu, and a person adds one in one action | `apps/galaxy/src/product-knowledge/` `apps/galaxy/src/knowledge-packs/` `apps/galaxy/app/app/products/[id]/knowledge/` `supabase/checks/product_domains.sql` | s1, s2 | 3 | build |
| s4 | The terminal reads and changes domains: `omni kb domains`, `--domain` on the glossary verbs, the local copy, and the mark in `omni kb graph` | `kit/lib/product/` `kit/lib/ask/client.ts` `kit/lib/help/entries.ts` `kit/bin/commands/kb.ts` `kit/bin/kb-write.ts` `kit/bin/kb-write.test.ts` `kit/bin/kb-domains.test.ts` `apps/galaxy/app/api/knowledge/changes/` `apps/galaxy/src/knowledge-api/` | s2 | 3 | build |
| s5 | The user guide says what a product's domains are, how a folder comes onto the list, and that nothing blocks | `docs/guide/knowledge-map.md` | s3, s4 | 4 | light |

**Shared ground.** `supabase/migrations/`, `apps/galaxy/src/product-knowledge/` and
`apps/galaxy/app/app/products/[id]/knowledge/` are declared by s1, s2 and s3 (the migrations by s1 and s2
only), and `supabase/checks/product_domains.sql` by s1, s2 and s3: waves 1, 2 and 3 keep them apart. s2
extends the one migration s1 wrote rather than adding a second, since nothing has merged to `main` yet.
`apps/galaxy/src/product-knowledge/knowledge-sections.test.ts` and `product-knowledge.render.test.ts` read
what s1, s2 and s3 change, and sit inside the territory all three declare. s3 and s4 share wave 3 and no
ground: s4 changes the write route's files, and s3 the Knowledge section's.

## Per slice: done when

### s1 (`ui: yes`) (deep: a new kind across the owners, proposals and events tables, row-level security, a key that is never reused)

- An owner or delegate of the Domains kind, or a workspace owner while nobody is named, adds a domain with its key, name and meaning, and it is listed.
- Another member sees `Propose`; the domain is off the list until it is approved, and Reject leaves it off.
- A key that exists or was retired is refused, and an invalid key is refused, each naming the field.
- A domain's name and meaning can be edited, and its key cannot.
- A retired domain shows behind `Retired · n`, opens on its page, and no Delete control exists.
- `/app/products/<id>/knowledge/domains/<key>` shows its name, meaning, author and history.
- The sub-menu lists Domains after Glossary, with its active count.
- `supabase/checks/product_domains.sql` proves that a stranger and a member of another workspace read nothing, nobody writes a table directly, and every change appends its event.
- A reply with no domain field reads as an empty list, so the page holds while the migration and the deploy land.

### s2 (`ui: yes`)

- A term's page and the Glossary's add form pick none, one or several active domains; a member who may only propose proposes the same.
- A new link to a retired domain is refused; a link made before retirement stays and shows as retired.
- A link to another product's domain is refused, proven in `supabase/checks/product_domains.sql`.
- The Glossary list has a `Domains` column, and `?domain=<key>` shows only that domain's terms.
- `business_for_product()` and `business_for_repo_app()` answer `domains` and each term's `domains`, proven in `supabase/checks/business.sql`.
- `GET /api/business?repo=` carries them.

### s3 (`ui: yes`)

- `found-domains.ts`, pure and tested: a folder directly under `<knowledge root>/domains/` counts, a custom root is honoured, `repos/<target>/domains/` never counts, a file is no folder, and a name that cannot be a key is marked.
- A folder off the list shows under Not on the list with its repositories, read from each repository's newest pack and the plan repository's. No check fails anywhere.
- A person who decides adds it with its key, name and meaning filled from the folder, in one action; another member proposes the same.
- A folder that cannot be a key says `Cannot be a key: rename the folder` and offers no action.
- A retired domain still in a repository shows as such, and a repository with no pack shows as not read yet, adding nothing to the count.
- The sub-menu shows `Domains <n> · <k> not on the list` on every Knowledge section when `k` is above 0, and `Domains <n>` otherwise.
- A stranger, and a member of another workspace, reads no folder name, proven in `supabase/checks/product_domains.sql`.

### s4

- `omni kb domains` prints the active list, and offline prints its copy with its age, or one line with no copy.
- `omni kb domains add` and `edit` print `added`, `edited` or `proposed` as `omni kb glossary` does, through `POST /api/knowledge/changes`; nothing is retired from the terminal.
- `omni kb glossary add` and `edit` take `--domain <a,b>`, `--domain ''` clears them on `edit`, and `omni kb glossary` prints a term's domains.
- `omni kb graph` marks a folder off the list `not on the product's list` from the copy, with no network; with no copy it marks nothing; with an empty list it prints `the product lists no domains yet`. No exit code changes.
- A copy written before this PRD still reads, with no domains.
- `omni help kb` documents all of it.
- Fixtures are fictional.

### s5 (light: docs only)

- `docs/guide/knowledge-map.md` says what a product's domains are, who decides, how a folder comes onto the list, that a term's domains are optional, and that nothing blocks.
