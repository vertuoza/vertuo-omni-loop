# Plan: Business laws above the repositories

PRD #2632, spec in `spec.md` beside this plan. The feature branch `feat/business-laws` goes into `main`
with `Closes #2632`; the sub-PRs go from `feat/business-laws--<slice>` into the feature branch with
`Part of #2632`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A repository holds business laws in `business-laws.md`, `omni check knowledge` grades their shape, and an agent reads them with `omni kb business-laws`, `--spec` and `omni kb laws --paths` | `kit/lib/knowledge/business-laws` `kit/lib/knowledge/check-knowledge` `kit/lib/knowledge/disclose-lookup` `kit/bin/commands/kb.ts` `kit/bin/commands/check.ts` `kit/bin/kb-business-laws.test.ts` `kit/lib/help/entries.ts` | — | 1 | deep |
| s2 | A product has a law home, every terminal reads the laws from it, and `omni check knowledge` refuses a domain off the list, an avoid word and a law outside the home | `supabase/migrations/` `supabase/checks/business.sql` `kit/lib/product/` `kit/lib/ask/client.ts` `kit/lib/knowledge/check-knowledge` `kit/lib/knowledge/business-laws` `kit/bin/commands/kb.ts` `kit/bin/kb-business-laws.test.ts` `kit/lib/help/entries.ts` `apps/galaxy/src/business-laws/law-home` `apps/galaxy/src/knowledge-api/` | s1 | 2 | build |
| s3 | Only a CODEOWNER of its file can change a business law: `law-locked` holds the pull request under any `laws.source`, and `omni kb owners` writes the files into CODEOWNERS | `kit/lib/outbox/` `kit/lib/codeowners` `apps/omni-app/src/outbox-check/` | s1 | 2 | deep |
| s4 | A spec on a PRD's page is judged, and a red shows its law, Why and quote, turns Approve off and is refused by `dossier_approve`; a green and a not-judged say so | `supabase/migrations/` `supabase/checks/business_law_verdicts.sql` `supabase/checks/approvals.sql` `supabase/database.types.ts` `apps/galaxy/src/business-laws/` `apps/galaxy/src/dossier/page/` `apps/galaxy/src/approval/` `apps/galaxy/app/api/dossiers/push/` | s2 | 3 | deep |
| s5 | A phase-0 pull request gets a `business laws` gate through the signed judge route, with the same words | `apps/omni-app/src/inbox-check/` `apps/omni-app/src/env.ts` `apps/galaxy/app/api/business-laws/` `apps/galaxy/src/business-laws/` `apps/galaxy/src/env.ts` `apps/galaxy/.env.example` | s4 | 4 | build |
| s6 | Knowledge shows a read-only Business laws section, filtered by domain, and a domain's page lists its laws | `apps/galaxy/src/product-knowledge/` `apps/galaxy/app/app/products/[id]/knowledge/` | s2 | 3 | build |
| s7 | The skills use the laws: the brainstorm names them in Risks, the plan and do-work read them, knowledge-add amends one; the guide explains them | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/plugin/skills/do-work/` `kit/plugin/skills/knowledge-add/` `docs/guide/knowledge.md` `docs/guide/products.md` `docs/guide/several-repositories.md` | s3, s5, s6 | 5 | build |

**Shared ground.** `supabase/migrations/` is declared by s2 and s4: waves 2 and 3 keep them apart, and each adds
its own migration, re-dated newest on `main` before the feature PR is ready. `kit/lib/knowledge/business-laws`,
`kit/lib/knowledge/check-knowledge`, `kit/bin/commands/kb.ts`, `kit/bin/kb-business-laws.test.ts` and
`kit/lib/help/entries.ts` are declared by s1 and s2: waves 1 and 2. `apps/galaxy/src/business-laws/` is declared by
s2 (`law-home` only), s4 and s5: waves 2, 3 and 4. s2 and s3 share wave 2 and no ground: s3 changes the outbox and
CODEOWNERS files, and s2 the check and the product read. s4 and s6 share wave 3 and no ground: s4 changes the
dossier page and the approval, and s6 the Knowledge section. Existing tests are inside the territory of the only
slice that changes what they read: `apps/galaxy/src/product-knowledge/knowledge-sections.test.ts` and
`product-knowledge.render.test.ts` in s6, `apps/galaxy/src/approval/approval-api.test.ts` and
`supabase/checks/approvals.sql` in s4, `kit/lib/outbox/decision-coverage.test.ts` in s3. The built `kit/dist/` and
`apps/omni-app/api/` are never committed by a slice.

## Per slice: done when

### s1 (deep: the one parser and pure selection every later slice rests on)

- A `business-laws.md` under `domains/<key>/` or `product/` parses into id, statement, `Why:` and `Also:`; copies under `repos/<target>/` never count.
- `omni check knowledge` refuses a law with no `Why:`, a bad id or code and a number used twice, under any `laws.source`, `none` included, and refuses a law while `laws.owners` names nobody.
- A law is never `isLaw`: the thesis, the briefing's locked list and `laws.max` do not see it.
- Selection takes the spec's `areas:`, the domains of each glossary term or avoid word used as a whole word without case, and every `product/` law; a term naming no domain adds none; each domain carries its reason.
- `omni kb business-laws [--domain <key>] [--json]` prints the local laws, and `--spec <file>` prints the selection and why (acceptance 2, 3).
- `omni kb laws --paths` shows a business law for a file mapped to its domain, hides it for another, and places `product/` laws under Global (acceptance 13).

### s2

- `business_for_product()` and `business_for_repo_app()` answer `lawHome`: the plan repository when set, else the only repository, else null; `supabase/checks/business.sql` proves all three cases.
- Away from the law home, `omni kb business-laws` reads the home's pack, and says so when it prints the last copy.
- `omni check knowledge` refuses a folder or `Also:` key off the product's list, a statement using an avoid word, and a law outside the law home, naming the home; unreachable, each is a note (acceptance 1).
- An older kit's or server's reply without `lawHome` reads as none.
- `apps/galaxy/src/business-laws/law-home` reads a product's laws from the newest pack of its law home, as the caller, so a member of another workspace reads none (BR-PRODUCT-63).

### s3 (`law: BR-PRODUCT-6 · owner @pierrederval or @dervalp`) (`law: N-PRODUCT-4 · owner @pierrederval or @dervalp`) (deep: a change to the gate every pull request is judged by)

Both laws' test, `apps/omni-app/src/outbox-check/outbox-check.test.ts`, sits in this territory. If BR-PRODUCT-6 breaks, a risky change nobody explained reaches the main branch and the reviewer is never told; if N-PRODUCT-4 breaks, any change could switch its own gate off and every reviewer would trust a green check that means nothing. A change to that test holds the feature PR for one of those owners' approval on GitHub.

- A pull request adding, changing or removing a business law keeps its outbox check red through `law-locked` until a CODEOWNER of the file approves it on GitHub, under `laws.source: none` too (acceptance 10).
- An outbox answer, a label or a commit trailer does not clear it, and a knowledge pull request is held like any other.
- A pull request changing no business law is judged exactly as before: the existing tests stand unchanged.
- `omni kb owners` writes `business-laws.md` into `.github/CODEOWNERS`.

### s4 (`ui: yes`) (deep: a database refusal on approval, a model's verdict that stops work, and a verdict never rewritten)

- `business_law_verdicts` holds one verdict per spec version and pack commit, written only by the service role's `business_law_verdict_put()`; a member reads, a stranger reads nothing, nobody signed in writes; a row is never changed or deleted.
- The judge asks in batches of 40; a finding whose quote is not in the spec, or whose law is not in its batch, is dropped (acceptance 7); the same spec and pack never call the model again.
- No key, a model error, no pack, no law home or no law: `neutral`, with why, and nothing red.
- A push starts the judging without slowing its answer; the page's load and Approve judge when no verdict exists for the latest spec and the newest pack.
- A red shows each finding's law, Why, the spec's words and owner, with Approve off and saying why (acceptance 4); **Ask to amend this law** copies `/omni:knowledge-add amend <id>`.
- `dossier_approve` refuses a red at the newest pack, and allows a red at an older pack, a green and a neutral (acceptance 5); `supabase/checks/business_law_verdicts.sql` proves each.
- A spec pushed without the break, or a merged amendment, gives a new verdict, and Approve comes back when it is not red (acceptance 6); a green says what it judged.
- With no key, the page says `Business laws not judged: <why>`, Approve works, and the approved version's verdict still says so afterward (acceptance 8).
- An unmerged change to a law changes no verdict (acceptance 14).

### s5

- `POST /api/business-laws/judge` refuses a missing or wrong signature, a malformed body and a body past its cap, as the constituent judge's route does.
- A phase-0 pull request whose spec breaks a law has a red `business laws` gate carrying the law, its Why and the quote (acceptance 11).
- A refusal or failure of the route, or a repository with no law home, leaves the gate neutral, and the canon gate's behaviour and its tests are unchanged.

### s6 (`ui: yes`)

- Knowledge lists Business laws after Domains, with its count on the sub-menu, each law's statement, Why, domains and owner, and a link to its file on GitHub; there is no edit control (acceptance 12).
- `?domain=<key>` filters the list, and a domain's page lists its laws.
- A product with several repositories and no plan repository says to set one; no pack yet and no law each say so.

### s7

- `/omni:brainstorm` runs `omni kb business-laws --spec` and names each law in the spec's **Risks**; a spec touching none says so.
- `/omni:plan` and `/omni:do-work` read the laws through `omni kb laws`.
- `/omni:knowledge-add amend <id>` and adding a law draft the change on a knowledge branch and open a signed pull request; it never merges (acceptance 9).
- `docs/guide/` says what a business law is, where it lives, what a red does and who amends one, and that a ◇ repository must require the check.
- The product's glossary holds **Business law**, added or proposed with `omni kb glossary add`.
