# Plan: Read a PRD by its page's id

PRD #2411, spec beside this plan (`spec.md`). The feature branch `feat/prd-read-by-id` merges into
`main` with `Closes #2411`; each slice is a sub-PR from `feat/prd-read-by-id--<slice>` into the
feature branch with `Part of #2411`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `GET /api/dossiers/get?id=<uuid>&kind=` reads any PRD's latest version by its dossier's id, and both ways of naming a PRD answer `title`, `repo`, `prd` beside `prdId` | `apps/galaxy/src/dossier/api.ts` `apps/galaxy/src/dossier/api-product.test.ts` `apps/galaxy/src/dossier/store.ts` `apps/galaxy/src/dossier/store.fake.ts` `apps/galaxy/app/api/dossiers/get/` | — | 1 | build |
| s2 | `omni dossier get` takes a PRD page's link or a bare uuid besides `<key>-<n>`, and reads the widened answer | `kit/lib/dossier/product-prd.` `kit/bin/commands/dossier` `kit/bin/commands/prd-product.ts` `kit/lib/ask/client.ts` `kit/bin/dossier` | — | 1 | build |
| s3 | The user guide says how a workspace member's agent account reads a PRD by its link | `docs/guide/api.md` | — | 1 | light |

Shared ground: none. The three territories do not meet, so the three slices share wave 1. The
contract between s1 and s2 is the answer the spec's §2 fixes; s2 tests against that shape, not
against s1's code. `kit/dist/` is rebuilt by the wave, never by a slice.

## Per slice: done when

### s1

- `?id=<uuid of a repository PRD>&kind=spec` answers 200 with `prdId` `<owner/name>#<n>`, `repo`
  the repository, `prd` its number, `title`, and the latest spec's `version`, `sha256`, `content`,
  `createdAt`.
- `?id=<uuid of a product PRD>` answers `prdId` `<key>-<n>`, `repo` null, `prd` its `product_seq`.
- A non-uuid `id`, and `id` sent with `product` or `prd`, are 400s.
- A missing uuid, a dossier the caller cannot read and a dossier that is not a PRD answer the same
  404 body, `No such PRD.`; a PRD with no version of the kind is a 404 naming it.
- `?product=&prd=` answers every field it answered before, plus `title`, `repo`, `prd`.
- Tested in `apps/galaxy/src/dossier/api-product.test.ts` against the store fake.

### s2

- `omni dossier get https://<any host>/prd/<uuid> --kind plan`, with or without a trailing slash or
  a query, and `omni dossier get <uuid> --kind plan`, call the route with `id` and write the plan to
  the scratch folder, printing its path.
- `omni dossier get <key>-<n>` works as before; any other argument is refused with a line naming
  the three forms.
- `LatestSchema` reads `title`, `repo` (nullable) and `prd`; an answer without them (an older app)
  still reads.
- Tested in `kit/lib/dossier/product-prd.test.ts` (the argument parser and the schema) and the
  command's own test.

### s3 (light: docs only)

- `docs/guide/api.md` has a section on reading a PRD by its link: the token exchange, the route,
  the CLI line, and that the account must be a member of the workspace (a non-member gets 404).
- The guide's own test (`apps/galaxy/src/docs/guide.test.ts`) stays green.
