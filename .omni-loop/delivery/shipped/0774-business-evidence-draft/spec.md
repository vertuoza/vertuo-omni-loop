---
prd: 774
title: Drafted from evidence
blocked-by: none
spec: file
---

# Drafted from evidence

**Date:** 2026-09-30 · **PRD:** #774 · **From:** concept #746, area `evidence-draft` (after PRD 748,
the business store)
**Touches:**
- `supabase/migrations/` (one new file), `supabase/checks/business.sql`
- `apps/galaxy/src/business/` (the page states), `apps/galaxy/src/business/draft/` (new)
- `apps/galaxy/app/api/business/draft/`, `apps/galaxy/app/api/business/recheck/`,
  `apps/galaxy/app/api/business/sources/` (new)
- `apps/galaxy/src/business-api/` (`state` on each claim)
- `apps/galaxy/src/waiting/` (the bell group)
- `.github/workflows/business-recheck.yml` (new)
- `kit/bin/commands/business.mjs`, `kit/test/fake-ask-server.mjs`
- `kit/plugin/skills/invade/SKILL.md` (one hand-off line)

## Problem

PRD 748 gave each workspace a business made of claims, and a pick screen to fill it. But every claim
is still typed or tapped by a person, from memory, and stays true only as long as someone remembers
to change it. The repositories, their docs and the company's own web pages already say much of what
the business is (who it sells to, where, against whom), and they change when the business does: a
French locale lands, a pricing page adds a tier.

The concept's dissent is the constraint: all six panelists doubted that code alone names a market.
So the draft reads the documents and the web pages people point it at, not just the code, and it
never keeps a claim it cannot quote.

## Solution

**Draft from my repos.** Settings › Business gains a **Draft from my repos** button, on the empty
sentence and on a filled page, and **+ add a web page**, where a member pastes up to three URLs
(pricing, home, about). Pasting a URL is the only typing.

A click runs the draft in galaxy:

1. **Sources.** For each tracked repository of the workspace, read as the Omni Loop App: its
   `README.md`, its top-level `docs/*.md`, and, when it has the kit layout, the ten most recently
   shipped PRD specs. Then each pasted web page. At most twelve files per repository.
2. **Extract.** One call per source to the small model already used for suggested rivals (the
   OpenRouter call of `apps/galaxy/src/business/suggest.ts`), which returns candidate claims, each a
   kind, a value, a quote and where the quote is.
3. **Verify.** A candidate is kept only when its quote appears, word for word (whitespace and case
   aside), in the text of the source it names. An invented receipt is dropped, never shown.
4. **Merge** with the store (the table below), and write what is new as `proposed` claims with
   source `evidence` and their receipts.

**The reveal** (vision step 2). While the draft runs, the headline shows the sources as they are
read ("✓ vertuo-app · README.md", "– vertuoza.com/pricing · skipped"). Then the sentence types itself
as **"We think you sell … to …-person … in …, up against …"**, with a "Sources used" line (for
example "2 READMEs · 14 PRDs · 1 web page"). Under it, **What we found**: one row per proposed
claim, with its kind, value, a receipt chip per quote (hover or tap shows the quote) and ✓ Right /
✗ Wrong. A pill says "Nothing saved yet". A dock says "Rows you leave alone are confirmed with
'That's us'", and **✓ That's us** confirms every proposed row not marked ✗. The page then reads as
the filled page, with "✓ Saved. Every agent reads these from the next run."

**Thin evidence.** When fewer than two claims survive the quote check, the page says "We found only
N things", keeps those rows, shows the pick controls, and points at "+ add a web page". When none
survive, or the model key is unset, it says "Nothing we could quote — pick instead", and the pick
screen works as in PRD 748.

**The weekly recheck.** Every Sunday at 22:00 UTC a GitHub Actions schedule wakes
`POST /api/business/recheck` with a bearer secret, as `.github/workflows/stages.yml` wakes the
stages sync. For each business with at least one confirmed claim, it runs the same draft on the same
sources, and merges as below.

**Contradictions** (vision step 7). A value found for a kind that holds several (region, trade,
rival) and not yet in the store is shown as an addition diff, "Region: Belgium → Belgium + France",
with its receipts. A different value for a kind that holds one (offering, size) is a `proposed`
claim that `replaces` the confirmed one, which becomes `contradicted`, shown as "~~ERP~~ → CRM".
✓ Right confirms the new claim and rejects the old. ✗ Wrong rejects the new claim and confirms the
old again.

**Last-seen fading.** Each time a source quotes a claim again, its receipt's `seen_at` moves to now,
and the claim's `last_seen` is the newest one. A confirmed claim with receipts that no source has
quoted for eight weeks fades on the page: dimmed, "not seen since 12 Aug", with ✓ Still true (which
sets `last_seen` to now) and ✗ Wrong. A claim with no receipt (a pick) never fades.

**The Monday digest.** When anything waits to be checked (a proposed evidence claim, a contradiction,
a faded claim), every member's bell (PRD 499) shows one group, **Business · N to check**, linking to
Settings › Business, where those rows sit on top of the page. At zero the group is gone. No email,
no sound.

**invade.** `/omni:invade`'s hand-off gains one line: the Business page drafts itself, at Settings ›
Business › Draft from my repos. invade drafts nothing itself.

## Decisions

Settled with the person during the brainstorm:

1. **One PRD for the whole area:** the draft, the reveal, contradictions, fading and the digest.
2. **The drafting runs in the app, on one click.** Galaxy reads the repositories as the Omni Loop App
   and calls the small model; `/omni:invade` only points at the page.
3. **Sources:** each tracked repository's README, top-level `docs/*.md` and shipped PRD specs (when
   the kit layout is there), capped per repository, and up to three pasted web pages kept on the
   business. A deck upload is out (it needs a new storage bucket).
4. **Every member gets the Monday digest,** since any member can confirm (PRD 748, decision 3).
5. **All in galaxy:** a member's draft route, and a recheck route woken weekly by a GitHub Actions
   schedule. No Inngest function.
6. **A contradicted claim still reaches agents,** with `state: "contradicted"`, until someone
   answers it.

Made in this spec, recorded here:

7. **The five kinds stay** (region, offering, size, trade, rival). The draft proposes nothing else;
   other kinds, such as a buyer, belong to later areas.
8. **Receipts are rows.** A new `claim_receipts` table holds several per claim: a kind (`file`, `pr`
   or `link`), where (a repository path or a URL), the quote (at most 300 characters) and `seen_at`.
   `claims.receipt` is left null for evidence claims; `claims.last_seen` is kept equal to the newest
   `seen_at`.
9. **The merge**, for each verified candidate:

   | the store holds | the draft does |
   |---|---|
   | nothing for that value | adds a `proposed` claim with its receipts |
   | the value, `confirmed` | adds the receipt (or moves its `seen_at`); shows nothing |
   | the value, `proposed` | adds the receipt |
   | the value, `rejected` | nothing: a rejected value is never proposed again |
   | another confirmed value, kind offering or size | adds a `proposed` claim with `replaces`, and sets the old one `contradicted` |

   A size is snapped to PRD 748's slider stops before it is compared.
10. **One draft at a time per business.** A click while one runs shows the running one. Each run is a
    `business_drafts` row: `draft` or `recheck`, who started it, when, `running | done | failed`,
    the counts of what it read, and, when it failed, why.
11. **Web pages are fetched safely:** `https:` only, public addresses only (private, loopback and
    link-local refused, after each redirect too), at most 1 MB, 10 seconds, HTML reduced to text.
12. **The read's contract grows by one field:** each claim of `omni business show --json` and of
    `GET /api/business` gains `state` (`confirmed` or `contradicted`). `receipt` becomes the newest
    receipt as `<where> — "<quote>"`, or null. Nothing else changes. Proposed and rejected claims
    still never leave the app.
13. **Fading is eight weeks,** read from `last_seen`, and only on the page: agents read a faded claim
    as before, its `lastSeen` telling its age.
14. **The recheck skips** a business with no confirmed claim, and one workspace's failure never stops
    the others.

## User stories

1. As a member of a new workspace, I press Draft from my repos and watch it read my repositories;
   the sentence writes itself, and every row shows where it was read.
2. As that member, I mark the one wrong row ✗ and press That's us; the rest are confirmed at once.
3. As a member whose repositories say little about the market, I paste our pricing page and draft
   again, and the draft finds more.
4. As a member whose repositories say nothing quotable, I read one line saying so and pick instead.
5. As a member on Monday, I see "Business · 2 to check" in my bell, open it, and settle a region diff
   and a faded rival with one tap each.
6. As an agent, I read a contradicted claim marked as such, and I do not state it as settled.
7. As a person running `/omni:invade`, I learn at the end that the Business page drafts itself.

## Scope

**In:**
- the migration (`business_sources`, `claim_receipts`, `business_drafts`, `claims.replaces`, the
  RPCs) and the SQL check;
- the draft core (sources, read, extract, verify, merge) and its two routes, and the sources route;
- the page: the draft button, + add a web page, the scan, the reveal, That's us, thin and
  nothing-found states, diffs, faded rows, at 393px too;
- the weekly workflow and its secret;
- the bell group;
- `state` on each claim of the read, in galaxy and in the kit;
- invade's hand-off line; the help entries touched.

**Out:**
- a deck upload;
- the customer's voice and gap questions (`customer-voice`);
- Never lines and the canon check (`canon-check`);
- the MCP link and "unknown" rows (`agent-connect`);
- new claim kinds;
- email or sound for the digest.

## Test seams

Tests follow `omni kb show testing`: beside the code, run by `pnpm test`, never calling GitHub,
Supabase or OpenRouter.

- **SQL** (`supabase/checks/business.sql`, extended in its `raise exception 'FAIL: …'` style):
  - a fourth web page is refused (`22023`);
  - a receipt appends and moves `last_seen`;
  - That's us confirms the draft's proposed claims except those marked ✗;
  - `replaces`: ✓ confirms the new and rejects the old, ✗ does the reverse;
  - a rejected value proposed again adds nothing;
  - a member of another workspace is refused (`42501`);
  - `business_for_repo` returns confirmed and contradicted claims with `state`, never proposed or
    rejected ones.
- **Galaxy units** (`src/business/draft/`):
  - `verify`: a quote not in the text is dropped; whitespace and case differences pass;
  - `merge`: every row of decision 9, as a table test, and size snapping;
  - `extract` with a stubbed fetch: parsed candidates, and none on a failure or with the key unset;
  - the URL guard: `http:`, private, loopback and link-local addresses, and a redirect to one, are
    refused; a page over 1 MB is cut;
  - `sources`: the per-repository cap, and PRD specs only with the kit layout.
- **Galaxy page:** render tests for the scan, the reveal, thin evidence, nothing found, a diff, a
  faded row and 393px; the bell group's count and its absence at zero.
- **Routes:** the draft route refuses a non-member and returns the running draft on a second call;
  the recheck route refuses a call without the secret.
- **Kit:** `kit/bin/business.test.mjs` checks `state` on each claim of `--json` against the fake
  server; `kit/test/plugin.test.mjs` checks invade's hand-off line.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the migration goes to the production
  Supabase project through the Supabase workflow's deploy; the new workflow starts running on its
  schedule once `BUSINESS_RECHECK_SECRET` is set in both the repository and galaxy (until then it
  fails its run and changes nothing); the page ships with galaxy; `omni business` gains `state`
  through the next `chore(release)`; invade's line reaches every plugin user.
- **Migration order:** check the latest migration on `main` right before merging, and date this one
  after it (the lesson of #771).
- **Rollback:** revert the PR, then a follow-up migration drops `business_drafts`, `claim_receipts`,
  `business_sources`, `claims.replaces` and the new functions. Contradicted claims are set back to
  `confirmed` first.
- **The model can invent,** so a claim with no word-for-word quote is dropped, every drafted claim
  stays `proposed` until a person says Right, and agents never read a proposed claim.
- **Fetching pasted URLs** could be turned against internal hosts; decision 11 refuses them.
- **GitHub budget:** the App's rate budget is already contended (PRD 587); a draft reads at most
  twelve files per repository, and the recheck runs once a week.
- **Cost:** one model call per source per run; nothing runs where `OPENROUTER_API_KEY` is unset.
- **Not proven by CI:** a real draft on Vertuoza's repositories and pricing page, and a real Monday
  bell. Owed after merge by a person.

## Acceptance criteria

1. On Settings › Business, Draft from my repos reads each tracked repository's README, top-level
   docs and (with the kit layout) shipped PRD specs, and each pasted web page, and lists each source
   as read or skipped while it runs.
2. Every drafted claim is `proposed`, has source `evidence`, and has at least one receipt whose quote
   appears word for word in its source; a candidate without one is never stored.
3. The reveal shows "We think you sell …", Sources used, and one row per proposed claim with its
   receipts; That's us confirms every row not marked ✗, and the page then shows the filled sentence.
4. A value that was rejected is never proposed again; a value already confirmed gains a receipt and
   is not shown as new.
5. With fewer than two claims found the page says "We found only N things" beside the pick controls;
   with none, or with the model key unset, it says "Nothing we could quote — pick instead".
6. A fourth web page is refused, and a URL that is not `https:` or points at a private, loopback or
   link-local address is refused.
7. The weekly recheck, called with the secret, turns a new region into an addition diff and a new
   offering into a replacement that sets the old claim `contradicted`; ✓ and ✗ settle each as
   decision 9 says. Without the secret, it is refused.
8. A confirmed claim with receipts not quoted for eight weeks shows as faded with its date; ✓ Still
   true clears it; a claim without receipts never fades.
9. When anything waits to be checked, every member's bell shows "Business · N to check", linking to
   Settings › Business; at zero it shows nothing.
10. `omni business show --json` gives each claim a `state` of `confirmed` or `contradicted`, and never
    returns a proposed or rejected claim.
11. `/omni:invade`'s hand-off names Settings › Business › Draft from my repos; the plugin test checks
    it.
