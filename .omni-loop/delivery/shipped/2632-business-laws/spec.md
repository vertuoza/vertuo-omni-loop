---
prd: 2632
title: Business laws above the repositories
blocked-by: none
spec: file
phase0: server
areas: [product-knowledge, approvals, gate]
---

## Problem

A product's business rules hold across its repositories, but Omni Loop has nowhere to put them.

1. **A repository law is the wrong shape.** A law (`kit/lib/knowledge/registers.ts`) is locked in one
   repository, governs that repository's files and is proven by its test. "A quote can be sent only
   when its total is above zero" is true for the whole product, whichever repository builds the screen.
2. **The rules are not read.** Vertuoza keeps about 190 written rules in `business-rules.md` files of a
   documentation repository. No agent reads them while it designs, and no gate judges a PRD against them.
3. **Nothing stops a PRD that breaks one.** The canon check judges a spec against the Statement, the
   Never lines, the claims and the Legal entries, but only on a phase-0 pull request
   (`apps/omni-app/src/inbox-check/inbox-check.ts`). A PRD approved on its page has none, so it gets no
   canon verdict at all.

## Solution

### A business law

A **business law** is a rule of the product, written for the people who build it, with its reason:

```markdown file=domains/quotes/business-laws.md
## BL-QUOTES-1
A quote can be sent only when its total including tax is above zero.
Why: A customer who receives an empty quote stops trusting the contractor.
Also: invoicing
```

- **Its home is Git.** Laws live in the product's **law home**: its plan repository when
  `products.plan_repository` is set, else its only repository. A product with several repositories and no
  plan repository has no law home: its Business laws section says to set one, and nothing is judged.
- **Its file says its domain.** `<knowledge root>/domains/<key>/business-laws.md` holds that domain's laws;
  `<knowledge root>/product/business-laws.md` holds the laws that apply everywhere. A plan repository's
  imported copies under `repos/<target>/` never count.
- **Its id is `BL-<CODE>-<n>`,** the code being the folder's, as the registers make it (`QUOTES`, `PRODUCT`).
- **`Why:` is required.** It is the reason a red shows.
- **`Also:` is optional:** more domain keys the law belongs to.
- **It needs no test and no paths,** and it does not count toward `laws.max`.
- **It works under any `laws.source`.** Vertuoza's plan repository says `laws: source: none`, so a business
  law depends on the file alone.

`omni check knowledge` grades the files: the id's shape and code, a number used once, a statement, a `Why:`.
With the product's read (as Legal entries are verified, `kit/lib/knowledge/check-knowledge-legal.ts`) it also
refuses a folder or `Also:` key off the product's domain list, a statement using a word the glossary says to
avoid, and a law in a repository that is not the law home, naming the home. Unreachable, each is a note,
never a violation. `omni check knowledge` refuses a law while `laws.owners` names nobody.

### Only the PM amends a law

Adding, changing or removing a business law keeps the outbox check red through `law-locked`
(`kit/lib/outbox/decision-coverage.ts`), knowledge pull requests included, until a CODEOWNER of the file
approves the pull request on GitHub. The product's PM is that CODEOWNER: `laws.owners` in the law home, and
`omni kb owners` writes `business-laws.md` into `.github/CODEOWNERS`. An outbox answer or a label never clears it.

### Which laws a spec is judged against

Selection is pure and uses no model, in a kit module the terminal and the server share:

1. The domains of the spec's `areas:` line.
2. The domains of every glossary term the spec's text uses: whole words, without case, the term or one of its
   avoid words. A term naming no domain adds none.
3. Every law of those domains, by its folder or its `Also:`, and every law of `product/`.

The result names why each domain was taken: `Quotes ← "Quote"`, `Invoicing ← areas`.

### The judge

One judge on the Omni server, `apps/galaxy`, which holds the model key:

- **It reads merged laws only:** the newest knowledge pack of the law home, which the App writes on every
  merge (`supabase/migrations/20261212100000_knowledge_packs.sql`). A pull request cannot change the laws it
  is judged by.
- **It asks in batches of 40 laws.** A finding counts only when it quotes the spec word for word (whitespace
  and case aside, as the canon gate does) and cites a law of the batch.
- **A verdict is kept** per spec version and pack commit in `business_law_verdicts`: `green`, `red` or `neutral`,
  the laws and domains judged, and each finding with the law's statement and `Why:` as they were. It is never
  changed or deleted. The same spec and pack never call the model again.
- **It never goes red on its own failure.** No key, a model error, no pack yet: `neutral`, with why. A product
  with no law home or no law is `neutral` too, and shows nothing.

### On a PRD approved on its page (◆)

- **When:** on the spec's push, and on the page's load or on Approve when no verdict exists for the latest spec
  and the newest pack.
- **Red holds Approve.** The approve screen shows `Business laws ✗ <n>`, and for each finding the law's id and
  statement, **Why** it exists, the spec's words, and who owns it. Approve is off, saying why.
- **`dossier_approve` refuses too:** a red verdict for the latest spec version at the law home's newest pack
  refuses the approval, with no way round it for a person who calls the database directly.
- **Ask to amend this law** on each finding copies `/omni:knowledge-add amend <id>`, for an agent to open the
  pull request the PM approves.
- **Green** shows `Business laws ✓ 12 judged · Quotes, Invoicing`, its domains' reasons one click away.
- **Neutral** shows `Business laws not judged: <why>`, and Approve stays on. The verdict stays pinned to the
  version approved, so the approval's record says so for good.
- **Out of a red:** change the spec, or merge the law's amendment. Either gives a new verdict.
- **A law that changes later voids nothing:** an approval stands, and the new law judges the next spec version.

### On a PRD with a phase-0 pull request (◇)

The inbox check (`apps/omni-app/src/inbox-check/evaluate-inbox.ts`) gains a sixth gate, `business laws`, which
calls the same judge through a signed route, as the constituent judge does
(`apps/galaxy/src/jev/decisions/judge-route.ts`). Its details carry the same words: law, why, the spec's quote.
GitHub stops the merge only where the repository requires the check.

### What people and agents read

- **The page:** Knowledge gains a read-only section, **Business laws**, after Domains: each law's statement,
  Why, domains and owner, filtered through `?domain=<key>`, and a link to its file on GitHub. A domain's page
  lists its laws. Nothing is edited there.
- **`omni kb business-laws [--domain <key>] [--json]`** prints the laws, from the files in the law home and from
  its pack elsewhere (`omni kb pack get`), the last copy saying so when the page is unreachable.
- **`omni kb business-laws --spec <file>`** prints what that spec would be judged against, and why.
- **`omni kb laws --paths`** adds the business laws of the domains those files map to, under **Applies here**,
  and `product/` laws under **Global**. They are never `isLaw`: the thesis, the briefing's locked list and
  `laws.max` do not see them.
- **`/omni:brainstorm`** runs `--spec` and names each law in the spec's **Risks**. **`/omni:plan`** and
  **`/omni:do-work`** read them through `omni kb laws`. **`/omni:knowledge-add`** learns `amend <id>` and adding
  a law: it drafts the change on a knowledge branch and opens the pull request; it never merges.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | migration | `<timestamp>_business_law_verdicts.sql` | `node scripts/migration-order.ts` (briefing › Never: newest on `main`) |
| vertuo-omni-loop | db | `business_law_verdicts`, `business_law_verdict_put()` | no written convention: follows `supabase/migrations/20261212110000_product_knowledge.sql` |
| vertuo-omni-loop | db | `dossier_approve` raises its refusal in the caller's words | ADR-0050 (`.omni-loop/knowledge/adr/`) |
| vertuo-omni-loop | api | `POST /api/business-laws/judge` | no written convention: follows `apps/galaxy/app/api/constituents/judge/route.ts` |
| vertuo-omni-loop | cli | `omni kb business-laws` | no written convention: follows `omni kb domains` in `kit/bin/commands/kb.ts` |
| vertuo-omni-loop | kit | `kit/lib/knowledge/business-laws.ts` | no written convention: follows `kit/lib/knowledge/registers.ts` |
| vertuo-omni-loop | knowledge | `BL-<CODE>-<n>`, `business-laws.md` | no written convention: follows `kit/lib/knowledge/registers.ts:17` |
| vertuo-omni-loop | ui | `apps/galaxy/src/dossier/page/BusinessLawsVerdict.tsx` | no written convention: follows `apps/galaxy/src/dossier/page/ApproveButton.tsx` |
| vertuo-omni-loop | ui | section key `business-laws` | no written convention: follows `apps/galaxy/src/product-knowledge/knowledge-sections.ts:22` |

## Decisions

- **Git, in the plan repository or the only repository** (the person: "for now business rules is inside a repo
  and in a multi-repo is the plan repo"). This keeps never#6 whole. A home on the Omni page was offered and
  not taken.
- **Red, and the reason must show to the person working on the product** (the person). So `Why:` is required, and
  every red carries it.
- **Hard stop: only the product's PM amends the law** (the person). An approver has no way to approve past a
  red. The risk of a wrong red is in **Risks**.
- **The glossary finds the laws** (the person, offered with the spec's named domains and every law): a spec cannot
  dodge a law by leaving out `areas:`, and no model picks.
- **If the model cannot judge, approval goes on and says so** (the person). As the canon gate, a gate is never
  red on its own failure.
- **The spec only, never the code** (from the person's choice at the first question): a repository still writes
  its own tested rules.
- **The judge is new, not the canon gate grown.** Canon runs one model call on a phase-0 PR, in the App, cached by
  other keys. Its behaviour stays as it is.
- **The verdict keeps the law's words as they were,** so an old red still reads true once the law is amended.
- **Objection, `persona:Irisa`:** "I ship quick wins for customers and I don't master the technical harness. If a
  model's wrong call stops my PRD and the only way out is a pull request in a plan repository I've never
  opened, I'm stuck." Settled `accepted`: **Ask to amend this law** on each finding, so an agent opens the
  pull request and the PM approves it.

## User stories

- As a PM, I read why a law stopped my PRD, in words a customer would follow, and know who can change it.
- As a product's PM, I am the only one who can change a law, and I approve that change on GitHub.
- As an agent, I read the laws a spec or a file touches before I design or build, and no others.
- As a lead engineer, I see one list of the product's laws across every repository.
- As an approver, I cannot approve a PRD that breaks a law, and I can see what was judged when it passed.

## Scope

**In:** the `business-laws.md` files and their check; the law home; `law-locked` and `omni kb owners` on them;
the selection module; the judge and `business_law_verdicts`; the approve screen, `dossier_approve` and
the sixth inbox gate; the read-only Business laws section and the domain page's list; `omni kb business-laws`,
`omni kb laws`; the brainstorm, plan, do-work and knowledge-add skills; `docs/guide/` and the kit's help text; the
term **Business law** in the glossary.

**Out:** editing a law on the page; moving Vertuoza's rules, which is its own step after this ships; any check
on code; `Serves: BL-…` from a repository rule; judging the plan or the before/after; new knowledge graph node
kinds; voiding an approval when a law changes; a dismiss action on a finding.

## Test seams

Following `omni kb show testing`: tests sit beside the code, no test calls GitHub or a model, and every fixture
is fictional.

- **`kit/lib/knowledge/business-laws.test.ts`, pure:** parsing (id, code, `Why:`, `Also:`, a missing field named);
  selection from a spec and a glossary: whole words, avoid words, a cross-domain term adding none, `areas:`,
  `Also:`, `product/` always, imported `repos/` copies ignored, each domain's reason.
- **`kit/lib/knowledge/check-knowledge.test.ts`:** each refusal, each offline note, and a law under
  `laws.source: none` still graded.
- **`kit/lib/outbox/`:** `law-locked` fires on an added, changed and removed business law, a CODEOWNER's approval
  clears it, an outbox answer does not, under `laws.source: none` too.
- **`apps/galaxy/src/business-laws/`:** the judge with an injected model: a quote not in the spec is dropped, a law
  outside the batch is dropped, batches of 40, one verdict per spec and pack, each failure `neutral`; the
  law home's three cases. The route's signature refusals, as `judge-route.ts`.
- **`supabase/checks/business_law_verdicts.sql`:** a member reads, a stranger reads nothing, nobody signed in
  writes; `dossier_approve` refuses a red at the newest pack, allows a red at an older pack, a green and a neutral.
- **The dossier page and Knowledge render tests:** red, green and neutral; Approve off with its reason; the copy
  line; the section, its filter, the domain page's list, no edit control.
- **`apps/omni-app/src/inbox-check/`:** the sixth gate red, green and neutral through an injected judge, a phase-0
  PR with no law unchanged.
- **`kit/bin/kb.test.ts`, through `main()`:** both `omni kb business-laws` forms, from files and from a pack; `omni kb
  laws --paths` placing them.

## Risks

**What merging publishes** (`omni kb show releasing`): one migration applied to production, a deploy of
`apps/galaxy` and `apps/omni-app`, and a new kit. Rollback: a follow-up migration restores `dossier_approve()`
from `supabase/migrations/20261210100000_product_roadmaps.sql` and drops the verdict table and its functions;
reverting the code removes the gate, the section and the commands. The laws themselves are files, and stay.

- **A wrong red stops a PRD.** A hard stop rests on a model's judgment, and no approver can pass it. Requiring a
  word-for-word quote and a cited law narrows it; the way out is changing the spec, or the PM amending the law.
  This is the risk the person accepted. A false red rate worth a dismiss action would be a later PRD.
- **A real break can pass during an outage,** when the verdict is neutral. It stays visible on the approval.
- **A common glossary word pulls many laws** (Vertuoza's Invoicing holds 50). Batches bound one call, not the
  total, so a wide spec costs more calls.
- **A ◇ repository without the required check can still merge on red.** Only the repository can require it, and
  `ci.branchProtection` is off by default.
- **Vertuoza needs two settings first:** `products.plan_repository` set, and the PM in `laws.owners`. Without the
  first it has no law home, and nothing is judged.
- **An older kit against the new server:** it ignores `business-laws.md`, so `omni check knowledge` says nothing there,
  and the App's `law-locked` still holds the file.

**The Legal entries:**

- `L-AIACT-1`, agents' content says so: the pull request `/omni:knowledge-add` opens is signed as the agent, and only a
  person approves it.
- `L-GDPR-1`, members only read a workspace's personal data: a verdict and the owner's login are read by members only.
- `L-GDPR-3`, a deleted account's data is erased except its decisions: no verdict names a person but through the
  law's owner, a login in the law's file.
- `L-GDPR-4`, logs recording decisions are kept for good: a verdict is never changed or deleted.
- `L-GDPR-5`, each service handling personal data is named: the spec's text goes to the model through OpenRouter, as the
  canon gate sends it today; nothing new is added. `L-GDPR-7` follows that same transfer.

**The locked laws** (`omni kb laws --paths` on the migration, the galaxy, App and kit files; this design changes none of
them, and they are named because its paths reach them):

- N-PRODUCT-4: any change could switch its own gate off, and every reviewer would trust a green check that means nothing. The judge reads merged laws only, for this reason. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch, and the reviewer is never told. `law-locked` grows here. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering the open questions. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-3: a badly ranked question slips past, and the person who answers decides without the facts they need. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test, and the team only learns it when the server refuses the pull request. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind, and nobody can tell what was decided. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, and players could no longer trust what they earned. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository, so these become ordinary tests.

1. `omni check knowledge` refuses a business law with no `Why:`, one in a folder off the product's domain list, one using
   an avoid word, and one outside the law home, each naming what to fix; unreachable, each is a note.
2. A spec using the word "Quote", with no `areas:`, is judged against the Quotes laws and every `product/` law, and not
   against a domain nothing points to.
3. `omni kb business-laws --spec <file>` prints those laws and why each domain was taken.
4. A red verdict on a ◆ PRD's latest spec shows each finding's law, its Why, the spec's words and its owner, with Approve off.
5. `dossier_approve` refuses that PRD for a member calling it directly.
6. After the spec is pushed without the break, or the law's amendment merges, a new verdict is judged and Approve comes back when it is not red.
7. A finding whose quote is not in the spec, or whose law was not in its batch, never makes a verdict red.
8. With no model key or on a model error, the page says `Business laws not judged: <why>`, Approve works, and the approved version's verdict still says so afterward.
9. **Ask to amend this law** copies `/omni:knowledge-add amend <id>`, which opens a signed pull request and never merges it.
10. A pull request changing a business law keeps its outbox check red until a CODEOWNER of the file approves it on GitHub, under `laws.source: none` too; an outbox answer does not clear it.
11. A phase-0 pull request whose spec breaks a law has a red `business laws` gate with the same words, and one with no law home is unchanged.
12. The Business laws section lists each law with its Why and domains, filters by `?domain=<key>`, links to its file, and offers no edit; a product with several repositories and no plan repository says to set one.
13. `omni kb laws --paths` shows a business law for a file mapped to its domain and hides it for a file of another, and `product/` laws sit under Global.
14. A pull request's unmerged change to a law does not change the verdict on any spec.
