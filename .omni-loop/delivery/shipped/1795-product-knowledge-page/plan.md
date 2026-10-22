# Plan: product knowledge on the Omni page, Legal and Glossary

PRD #1795, spec beside this plan (`spec.md`). The feature branch `feat/product-knowledge-page`
merges into `main` with `Closes #1795`; each slice is a sub-PR from
`feat/product-knowledge-page--<slice>` into the feature branch, with `Part of #1795`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A product holds Legal entries and Glossary terms, with their owners, proposals and an append-only event log, changed only through definer functions, and the business read answers `legal` and `glossary` | `supabase/migrations/` `supabase/checks/product_knowledge.sql` `supabase/checks/business.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | deep |
| s2 | The product home has a Knowledge tab after Questions, with a Legal and a Glossary section, their owner and delegate, their entries, the open proposals and the controls each role may use | `apps/galaxy/src/product-knowledge/` `apps/galaxy/src/product-home/` `apps/galaxy/app/app/products/[id]/knowledge/` `.omni-loop/knowledge/design/screens/product-knowledge.md` | s1 | 2 | build |
| s3 | `GET /api/business?repo=` and the MCP link's `get_business` answer `legal` and `glossary`, and `omni business show --json` prints them | `apps/galaxy/src/business-api/` `apps/galaxy/src/agent-connect/mcp/` `kit/bin/commands/business.ts` `kit/bin/business.test.ts` | s1 | 2 | build |
| s4 | `omni kb legal` and `omni kb glossary` read the product's knowledge through the business read and keep the local copy, falling back to it when the page is unreachable | `kit/lib/product/knowledge` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` `kit/lib/help/` `kit/bin/help.test.ts` | — | 1 | build |
| s5 | A rule's or an invariant's `Serves:` may name an `L-<CODE>-<n>`, checked offline for its shape and verified by `omni check knowledge` against the product, never blocking on the network | `kit/lib/knowledge/check-knowledge` `kit/lib/knowledge/registers` `kit/bin/commands/check.ts` `kit/bin/knowledge.test.ts` | s4 | 2 | build |
| s6 | `omni design words` adds the glossary's avoided words, read from the local copy only, and names the product's term in each such finding | `kit/bin/commands/design.ts` `kit/bin/design-words.test.ts` `kit/lib/design/words/` | s4 | 2 | build |
| s7 | The canon gate judges a phase-0 spec against the product's live Legal entries, and its cache key changes when one does | `apps/omni-app/src/canon/` | s1 | 2 | build |
| s8 | `docs/guide/products.md` has a section on product knowledge: the two kinds, who changes them, the two verbs, `Serves: L-…` and the words check | `docs/guide/products.md` | — | 1 | light |

Shared ground: none. Every prefix above is declared by one slice. The generated bundles
(`kit/dist/`, `apps/omni-app/api/`) are rebuilt by the wave, never by a slice. s3 and s4 agree on the
read's shape through the fields this plan fixes (below), so s4 needs neither s1 nor s3 to be merged:
it is tested on a stubbed `fetch`.

**The shape every slice uses.** `GET /api/business` gains `legal`, an array of
`{ id: "L-<CODE>-<n>", statement, source, owner }` (the owner a GitHub login), the product's active
entries ordered by code then number, and `glossary`, an array of `{ term, meaning, avoid: string[] }`,
its live terms ordered by term without case; each is `[]` when there are none. A database from
before s1 sends neither: both read as `[]`.

## Per slice: done when

### s1 (deep: a migration of five tables, their definer functions and their policies)

`law: BR-PRODUCT-28 · owner @pierrederval`, `law: BR-PRODUCT-63 · owner @pierrederval`. If the read
answered Legal or the glossary to an account outside the workspace, a stranger would see what a team
keeps to itself.

- One migration, dated after the newest on `main`, creates `product_knowledge_owners`,
  `product_legal`, `product_glossary`, `product_knowledge_events` and `product_knowledge_proposals`,
  each readable by members of the product's workspace only, written by nobody signed in directly.
- Definer functions add, edit, retire (Legal) and remove (Glossary), propose, approve, reject, and
  name an owner or a delegate; each checks the caller's role as "Who changes it" says (a workspace's
  owners acting as a kind's owner while it names none), appends exactly one event in the same
  transaction, and refuses with `42501`, `P0002` or `22023` (the field in `hint`).
- The next Legal number is the next for that code in that product and is never reused, even after a
  retirement; a live glossary term is unique without case; a removed term is kept, marked removed.
- `business_for_repo()` (and the app's variant the canon gate reads) answers `legal` and `glossary`
  in the shape above.
- `supabase/checks/product_knowledge.sql`, run by the `supabase` workflow, proves each row of "Who
  changes it", the numbering and its never-reuse, retire-not-delete, remove-not-delete, the
  uniqueness without case, one event per change and that nobody writes a table directly, on fixture
  workspaces, in one transaction rolled back; `supabase/checks/business.sql` proves the two fields.
- `supabase/database.types.ts` lists the new tables and functions.

### s2 (`ui: yes`)

- `/app/products/<id>/knowledge` shows, to a member of the workspace, the Knowledge tab after
  Questions, with a Legal section and a Glossary section, each naming its owner and delegate.
- A kind's owner or delegate sees Edit, Retire (Legal) or Remove (Glossary) and Approve and Reject on
  each open proposal; another member sees Propose instead; a workspace owner sees, in each section,
  the control that names its owner and delegate.
- A Legal entry added with code `INVOICING` shows as `L-INVOICING-1`, the next as `L-INVOICING-2`.
- `apps/galaxy/src/product-knowledge/` follows the layering (contract, client, controller, service,
  repository); its service is tested against a fake repository (who may decide, who may only
  propose), and the tab's component for an owner, a delegate, a member and a workspace owner.

### s3

`law: BR-PRODUCT-28 · owner @pierrederval`, `law: BR-PRODUCT-63 · owner @pierrederval`. The read
stays the business read: a repository it refuses is refused the same way, so no stranger reads a
team's Legal entries.

- The business read's schema accepts `legal` and `glossary` in the shape above, each `[]` by default.
- `apps/galaxy/src/business-api/` tests read both, empty and filled.
- `get_business` answers the same two fields as the route for the same repository
  (`apps/galaxy/src/agent-connect/mcp/server.test.ts`), and its description names Legal entries and
  the glossary.
- `omni business show --json` prints them (`kit/bin/business.test.ts`).

### s4

- `omni kb legal` prints one line per active entry (id, sentence, source, owner) and `omni kb
  glossary` one line per term (term, meaning, words to avoid), both through the business read with
  the computer's sign-in, and both write `.omni-loop/local/product-knowledge.json`
  (`{ product, readAt, legal, glossary }`), through a new `kit/lib/product/knowledge.ts`.
- No answer within 5 seconds, or a 5xx: the copy is printed under `last read <date>: the Omni page
  is unreachable`, exit 0; with no copy, `no product knowledge: the Omni page is unreachable and
  nothing was read yet`, exit 1.
- A 4xx prints the server's reason and exits 1, whatever the copy.
- `kit/lib/product/knowledge.test.ts` and `kit/bin/kb.test.ts` cover a fresh read, a 5xx, a timeout,
  a 4xx and no copy on a fixture repository with a stubbed `fetch`; `omni help kb` names both verbs.

### s5

`law: N-PRODUCT-14 · owner @pierrederval`. If `omni check knowledge` judged a served id against
anything but the page, a rule could quietly lose what it serves.

- `servesViolations` accepts `L-<CODE>-<n>` offline beside a principle id; `Serves: L-invoicing-1`,
  or any other shape, fails offline; the register's id pattern recognises a Legal id.
- `omni check knowledge` reads the product's knowledge as `omni kb legal` does (the read becomes the
  copy) only when a rule serves an `L-` id: an id the product does not hold fails with `serves
  L-INVOICING-9, which product <name> does not hold.`, a retired one with `serves L-INVOICING-2,
  which product <name> retired.`, and a repository of no product with `serves L-INVOICING-1, but
  this repository belongs to no product.`
- Unreachable: it passes with `Legal not verified: page unreachable`; no sign-in: it passes with
  `Legal not verified: not signed in`. No served `L-` id: nothing is read, nothing printed.
- Tests: held, not held, retired, unreachable, no sign-in, no product.

### s6

- With a local copy whose glossary says "Credit note, avoid: refund", `omni design words` on a page
  whose marked screen says "refund" reports `"refund": avoid, the product says "Credit note"`,
  without calling the server; the product's words are added to the two lists of today, without
  duplicates.
- With no copy, the avoid list is today's (`kit/bin/design-words.test.ts`, both cases).

### s7

- The canon gate reads the product's active Legal entries beside the claims, the personas and the
  constituents; a "broken" finding is kept only when its quote is in the spec word for word and it
  cites a live `L-<CODE>-<n>`; the check is then red, names the sentence and the entry, and carries
  Rewrite and "Change the entry" linking to the Knowledge tab; red never blocks a merge.
- A retired entry is never cited; the verdict cache key gains the newest `product_knowledge_events`
  id, so a changed entry re-judges (`apps/omni-app/src/canon/` tests).

### s8 (light: docs only)

- `docs/guide/products.md` gains a section on product knowledge, in plain words, matching the spec:
  the two kinds, who changes them, `omni kb legal` and `omni kb glossary` with the local copy,
  `Serves: L-…` in `omni check knowledge`, and the glossary in `omni design words`.
