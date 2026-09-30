---
concept: 746
title: Business context every agent reads
kind: product
scale: vast
---

## The brief

**Asked.** Omni Loop ships software, but it has no notion of the product or business its
repositories serve. The knowledge folder, the code and the docs are engineering doctrine. Example:
Vertuoza is a vertical SaaS B2B ERP for construction companies of 2 to 50 people, with competitors,
an ICP and a region. The person proposed a Business (and/or Product) that repositories are assigned
to, with a definition, an ICP and competitors, which skills can read, perhaps through an MCP, so they
brainstorm better.

**Outcome.** Every Omni Loop agent (think-big, brainstorm, mega-brainstorm, invade…) knows what
business its repositories serve: the one-line definition, the ICP, the competitors, the region. It
uses that when it thinks.

**For whom.** Product people who run the studio and brainstorms, and the agents themselves.

**Success.** A `/omni:think-big` on a Vertuoza repository cites the ICP and a named competitor
without anyone typing them.

**Assumed, and confirmed by the person.**
- It lives in the Omni app, per workspace, empty by default (workspaces are generic).
- A business owns one or more products, and each tracked repository points at one product.
- Agents read it through the omni CLI and an MCP.
- A skill that finds none carries on.

## The vision

**The Business page: what we believe, with receipts.** Every business fact is one row, a *claim*.
- **Kind:** one-liner, ICP, region, rival, buyer, never…
- **Source:** evidence, pick or answer.
- **State:** proposed, confirmed, contradicted or unknown.
- **Also:** a receipt (a link or a quote) and a last-seen date.

A workspace with one product never sees the word "Product". There is no curated rival catalogue.
Empty is a state ("No business yet — agents carry on"), never an error.

Its wow moments, from the vision tour (`vision.html`):

1. **Pick, don't type.** An empty workspace fills the sentence "We sell … to … in …, up against …"
   by tapping generic axes: size, region, trade, and suggested rivals confirmed with one tap.
2. **"It already knows us."** "Draft from my repos" types out "We think you sell an ERP to 2–50-person
   builders in Belgium, up against Procore and Excel + WhatsApp". Every claim carries a receipt
   chip, and ✓ Right / ✗ Wrong is the only verb pair. "That's us" confirms the rest.
3. **The customer in the room.** In a think-big run, a voice rendered only from confirmed claims
   ("Marc") objects once with its receipts: "My office is my kitchen table. Board, no." The concept
   reshapes, and a fit line follows. The voice stays silent when a concept fits, or when the
   business is empty.
4. **Disagree once, and the page catches up.** Overruling the voice offers "Save as a claim?".
5. **Stopped before code.** The phase-0 check flags a design that breaks a Never line or the ICP,
   with "Rewrite for Marc" or "Change the claim".
6. **Any agent knows us.** An editor's agent reads the same claims through a read-only MCP link and
   answers with claim ids. A question nobody can answer becomes an "unknown" row on the Business
   page, naming who asked.
7. **Monday takes a minute.** One contradiction diff ("Belgium → Belgium + France", from the fr-FR
   PR), one gap question, and one "Answer once".

## Why this one

Crowned by the person in round 2 as "merge B C→A · crown A": the Business page (A) takes in the
customer's voice (B) and the read path (C).

Final scores on the crowned concept (Wow · User value · Craft · Fit · Feasibility):

| role | scores | stance |
|---|---|---|
| Visionary | 5 · 5 · 4 · 5 · 3 | The prototype lives or dies on that sentence being right. |
| Craft | 4 · 5 · 5 · 5 · 3 | The product; nail the empty, draft and drift states. |
| Skeptic | 4 · 5 · 4 · 5 · 3 | The right spine; ship the wedge with suggested rivals, or it fails its own test. |
| Value | 5 · 5 · 4 · 5 · 3 | Turns "who we sell to" from folklore into cited, confirmed facts every agent uses. |
| Sophie (user) | 5 · 5 · 4 · 5 · 3 | The core; three builds, so the pricing URL comes first and the deck second. |
| Tom (user) | 4 · 5 · 4 · 5 · 3 | Its empty and thin states matter more than the rich one. |

**Consensus.**
- Claims with receipts are the store.
- Picking is the empty state.
- The customer's voice is how agents *speak* it: rendered from confirmed claims only, once per
  concept, and only to object.
- The canon check and the Never lines guard it.
- `omni business show --json` returns exactly the fields the MCP does, so the two cannot drift.

**Dissent, kept.**
- **Evidence drafting.** All six doubt that `/omni:invade` finds market facts in code, since READMEs
  rarely name competitors (Feasibility 3). The wedge therefore works without evidence drafting.
- **Order of `agent-connect`.** Value and Tom would build it third, because a Cursor team needs
  "my agent knows us" on day one. The Skeptic keeps it last, because a read-only revocable token for
  a static MCP header is new auth work near ADR-0051. The person kept it last.
- **Where facts come from.** Sophie: code shows what we built, not who we sell to next. Outside
  sources (a pricing-page URL, later a deck) are needed.
- **Payoff timing.** Tom: for a new workspace, the voice's payoff arrives in week two.
- **Size of the wedge.** The Skeptic: it is one fat PRD (three tables, a page, a CLI read, a skill
  edit). The brainstorm fuel line moves to customer-voice and the Never lines to canon-check to thin
  it.

## Killed and why

- **C, Fit Fight (a VS screen per idea).** A skin, not a concept, and a fit % is false precision.
  It lives on as the Game-mode VS card in canon-check (three cited ticks, no %).
- **D, Series Bible (a person-written canon).** A blank page to author breaks click-click and the
  empty default. Its "breaks canon" check and the Never lines live on in canon-check.
- **E, New Game (a character creator).** Merged into A as its empty state. Its curated trade and
  rival roster was dropped: it seeds Vertuoza's world into generic workspaces.
- **F, The Interview (10 minutes).** Too long. Its pushback lives on as one gap question at a time
  through ask mode.
- **G, Strategy Clock (bets that expire).** Answers another brief (priorities, not identity). A
  later PRD of its own.
- **H, Product Brain (a company-wide MCP).** Thinned to the read path (agent-connect). Per-asker
  permissions, the live "who asked" feed and sales reach come later.
- **Sent back in round 1 as shades of A:** Market Invade, Insert Cartridge and Intel Dossier (all
  "an agent drafts the business from evidence"), and Customer in the Room (a shade of B).

## Fuel

**Product facts read.**
- Workspaces (`supabase/migrations/20260926120000_workspaces.sql`) map repositories by GitHub owner.
- `repositories` (`20261008090000_repositories.sql`) has no product column.
- No MCP server exists.
- The CLI's only HTTP client is `kit/lib/ask/client.mjs`: bearer Supabase tokens, with the dossier
  and ask routes.
- `.omni-loop/knowledge/product` holds engineering and loop doctrine only, with no market, ICP or
  competitor facts. No playbook form covers the business.
- Galaxy already calls a small model (`apps/galaxy/src/ask/classify.ts`), which is cheap for
  suggested rivals.
- `ask-attachments` takes images of 5 MB or less, so a deck (PDF) needs a new bucket.
- The phase-0 inbox check is PRD 675.
- The look: `packages/design` tokens, the Settings sidebar, cards and plasma buttons.

**References looked at.**
- [AGENTS.md](https://agents.md/): nearest scope wins (workspace → product → repository).
- [Cursor rules](https://cursor.com/docs/context/rules): each block says when to load it.
- [Claude Projects](https://support.claude.com/en/articles/9519177-how-can-i-create-and-manage-projects):
  facts apart from instructions.
- [Notion AI](https://www.notion.com/help/notion-ai-faqs): read only what the reader may see.
- [Glean MCP](https://docs.glean.com/administration/platform/mcp/about): typed read tools over a
  permissioned store.
- [Linear customer requests](https://linear.app/docs/customer-requests): ICP as structured
  attributes.
- [Linear initiatives](https://linear.app/docs/initiatives): current bets, which became G.
- [Productboard hierarchy](https://support.productboard.com/hc/en-us/articles/360058212253-Build-your-product-hierarchy):
  a product spine.
- [April Dunford positioning](https://www.aprildunford.com/post/a-quickstart-guide-to-positioning):
  the claim kinds.
- [Klue battlecards](https://klue.com/blog/competitive-battlecards-101): a last-verified date on
  rivals.
- [HubSpot Make My Persona](https://www.hubspot.com/make-my-persona): guided picking.
- [Amazon PR/FAQ](https://workingbackwards.com/concepts/working-backwards-pr-faq-process/): a
  press-release fit test.
- [Jasper Brand Voice](https://www.jasper.ai/brand-voice): off-brand flagging.
- [Dovetail](https://docs.dovetail.com/): claims linked to evidence.
- [Commander's intent](https://en.wikipedia.org/wiki/Intent_(military)): purpose and end state let
  agents act alone.
- [The series bible](https://www.lafilm.edu/blog/the-series-bible/): canon that every writer
  respects.

Not opened, so not cited: Canva brand kit, ChatGPT memory, Lean Canvas, Gong.

## Areas

| id | area | brief | PRD |
|---|---|---|---|
| business-core | The business store | Claims store (one hidden product; repositories point at it), Settings › Business pick screen with suggested rivals and ✓/✗ rows, `omni business show [--json]` (empty exits 0), think-big reads confirmed claims and logs the claim ids it cited | #748 |
| evidence-draft | Drafted from evidence | `/omni:invade` drafts proposed claims with receipts from the repositories and a pasted pricing-page URL, the "That's us" reveal and thin-evidence state, contradiction diffs, last-seen fading, the Monday digest in the bell | #774 |
| customer-voice | The customer's voice | Brainstorm and think-big speak the confirmed claims as one cited objection per concept (uncitable lines dropped, silent when empty), overrule offers "Save as a claim?", one gap question at a time through ask mode | |
| canon-check | The canon check | Never lines as claims; the phase-0 inbox check flags a design that breaks a Never line or the ICP (Rewrite / Change the claim); the Game-mode VS card | |
| agent-connect | Connect any agent | A read-only MCP link with named revocable tokens, the same fields as `--json`, and unanswerable questions fed back as "unknown" rows to answer once | |
