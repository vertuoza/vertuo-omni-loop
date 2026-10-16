# Plan: Every open question in one Outbox, repository PRDs included

PRD #2124, spec `spec.md` beside this plan. The feature branch is `feat/outbox-all-prds` into `main`,
its pull request opening with `Closes #2124`. Each slice is a sub-PR from `feat/outbox-all-prds--<slice>`
into the feature branch, with `Part of #2124`. No migration: `prd_outbox` already exists (PRD 657).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Work › Questions › Outbox lists repository PRDs' waiting items from `prd_outbox` beside product PRDs' `outbox_items` rows, in one list (viewer first, then rank), filtered by product across both; a repository row shows `as of <time>` and links to its PRD page's Outbox tab | `apps/galaxy/src/outbox-items/outbox-questions` `apps/galaxy/src/outbox-items/Outbox` `apps/galaxy/app/ask/(shell)/outbox/` | — | 1 | build |
| s2 | The guide's Questions section says the Outbox holds repository PRDs' questions too, and where each is answered | `docs/guide/products.md` | s1 | 2 | light |

**Shared ground.** None: s1 owns the Outbox's read and page, s2 the guide.

## Per slice: done when

**s1** (`ui: yes`)
- With a product PRD's open item and a repository PRD's high item waiting on the viewer, `/ask/outbox`
  lists both, the viewer's first, each with its product, PRD id and rank.
- A repository row links to `/prd/<id>?tab=outbox` and shows `as of <time>` from `prd_outbox.synced_at`;
  a product row shows none.
- The product filter applies to both sources; "No product" lists rows whose repository is in no product.
- A repository PRD's medium item, and a PRD whose feature PR is closed, are not listed; another
  workspace's rows never are.
- Answering a product PRD's question in the list works as before (its tests pass unchanged).

**s2** (light: docs only)
- `docs/guide/products.md` describes the merged Outbox and where each question is answered.
