---
prd: 855
title: Connect any agent
blocked-by: none
spec: file
---

# Connect any agent

**Date:** 2026-10-01 · **PRD:** #855 · **From:** concept #746, area `agent-connect` (the last area,
after PRDs 748, 774, 799, 822 and 839)
**Touches:**
- `supabase/migrations/` (three new files: tokens, questions, Jev), `supabase/checks/agent_tokens.sql` and
  `supabase/checks/agent_questions.sql` (new)
- `apps/galaxy/app/api/mcp/route.ts` (new), a new `apps/galaxy/src/agent-connect/`
- `apps/galaxy/src/business/` (two cards on Settings › Business), `apps/galaxy/src/waiting/`
  (the bell's Business count)
- `apps/galaxy/src/jev/decisions/` (a fourth decision)
- `apps/galaxy/package.json` (`@modelcontextprotocol/sdk`)

## Problem

Since PRD 748, the loop's own skills read the business through `omni business show`: who we sell to,
where, against whom, and what we never build. But most of the agents that touch the code are not loop
skills. Tom's editor agent, in Cursor or Claude Code, writes `NewQuoteForm.tsx` with
`// TODO: other countries?` and has no way to know that the customer is a 2–50-person owner-run builder
in Belgium and France. It either guesses, or asks Tom, who may not know either.

When nobody on file knows the answer ("Do we sell in Luxembourg?"), the question is lost in a chat.
The business page never learns that an agent needed it.

## Solution

**One read-only link per editor.** On Settings › Business, a **Connect an agent** card:
1. Tom types a name ("Tom's editor") and taps **Make link**.
2. The page shows the token **once** (`omb_…`), with ready-to-paste setup for Cursor, Claude Code and
   any MCP client: the URL `<galaxy>/api/mcp` and the header `Authorization: Bearer omb_…`.
3. Below, the workspace's live tokens: name, who made it, created, last used, and **Revoke** (on your
   own, or on any when you are a workspace owner).

**An MCP server on galaxy,** at `/api/mcp`, stateless Streamable HTTP, with three tools:

| tool | input | answers |
|---|---|---|
| `get_business` | `repo?` (owner/name) | exactly the body `GET /api/business?repo=` returns, which is what `omni business show --json` prints |
| `get_claims` | `kind?`, `repo?` | the same body's claims, filtered to one kind when given |
| `report_unknown` | `question`, `repo?`, `file?` | stores the question on Settings › Business, and answers that it was sent there |

- The tools' descriptions tell the agent to cite claim ids (`region#1`) and to call `report_unknown`
  rather than guess when no claim answers.
- With no `repo`, a workspace with one product reads that product. With several products, the tool
  answers an error naming the workspace's tracked repositories, so the agent can pass one.
- An empty business answers `state: "none"` like the CLI ("No business yet — agents carry on"),
  never an error.

**The database checks the token.** The route hashes the bearer token and passes the hash to
security-definer functions that check it and do the read or the write in the same call. Galaxy gains
no power: no new use of the service-role key (ADR-0051 is untouched). A revoked token is refused on
the very next call.

**Questions agents couldn't answer.** A second card on Settings › Business lists open questions:
the question, who asked ("Tom's editor"), the repository and file, when, and "asked 2×" when the same
question came again. Each has:
- **Answer once:** pick the kind (region, offering, size, trade, rival, never) and type or pick the
  value. It is saved as a **confirmed** claim (source `answer`), the question closes and links to it,
  and every agent reads the claim from the next call.
- **Dismiss:** the question closes with no claim.

Open questions count in the bell's "Business · N to check" group.

**Jev, optional.** Jev gains a fourth decision, **Unknown worth asking** (`unknown-worth-asking`),
Off by default like the others. It reads the question, its repository and file, and the product's
confirmed claims, and says whether a person should be asked. When it is **On** and says no (above the
confidence floor), the question is **set aside**: folded under "▸ Jev set aside N" at the bottom of the
card, with **Bring back**, and not counted in the bell. **Shadow** records what it would have done.
**Off** shows every question, as without Jev.

## Decisions

Settled with the person during the brainstorm:

1. **A remote link, not a local server.** Galaxy serves MCP over HTTP; an editor needs only the URL
   and the header. No `omni mcp` command.
2. **One token reads the whole workspace's business.** Tools take an optional `repo` to pick the
   product.
3. **Any member makes tokens for their own editors** and revokes their own; a workspace owner revokes
   any. Every member sees the workspace's token list.
4. **An unanswered question is a question row,** answered once as a confirmed claim of the kind the
   person picks, or dismissed.
5. **Jev's `unknown-worth-asking` decision** sets a question aside, folded with Bring back, never
   dropped.
6. **The database checks the token,** through security-definer functions given its hash; galaxy uses
   no service-role key for this.
7. **Limits:** a token reports at most 30 questions in 24 hours; a person holds at most 20 live
   tokens.

Made in this spec, recorded here:

8. **`get_business` and `/api/business` are built by one database function** for a product, so the
   two bodies cannot differ. The token read and the person's read differ only in who is checked.
9. **The token is shown once and only its SHA-256 hash is stored,** with its last four characters for
   the list. It is `omb_` followed by 32 random bytes in base64url.
10. **A token works only while its maker is a member of the workspace.** Leaving the workspace stops
    every token they made, without revoking them.
11. **No expiry date.** A token lives until it is revoked. Revoked tokens stay stored, so "asked by"
    still names them.
12. **The same open question is one row:** a report whose text matches an open or set-aside question
    of the workspace (case and surrounding spaces aside) adds one to "asked N×" and records the latest
    asker, repository and file.
13. **Jev runs after the row is stored,** so `report_unknown` never waits on it. The question may
    move to set aside a moment later.
14. **Answer once picks the product** of the question's repository for every kind but region, or the
    only product when there is one, or asks for it when the repository is not tracked.
15. **The official `@modelcontextprotocol/sdk`,** stateless (no session id), in the Next route.
16. **`last used` is written at most once a minute per token,** so reads do not write on every call.
17. **A question is 1 to 300 characters; a token name is 1 to 40,** unique among its maker's live
    tokens.

## User stories

1. As Tom, I make a link named "Tom's editor", paste the snippet into `.cursor/mcp.json`, and my
   editor's agent answers "Who is our customer?" with claim ids, without me typing anything.
2. As Tom's agent, when nothing on file answers "Do we sell in Luxembourg?", I report it and tell Tom
   it is not known yet, instead of guessing.
3. As Sophie, I see "Do we sell in Luxembourg? · asked by Tom's editor · vertuo-app ·
   NewQuoteForm.tsx" on Settings › Business, answer it once, and every agent reads the answer.
4. As Tom, I revoke "Tom's editor" when I change laptops, and the old link stops working on its next
   call.
5. As a workspace owner, I revoke a token someone left behind.
6. As a team that switched Jev's Unknown worth asking On, I see junk questions folded under "Jev set
   aside", and bring one back when Jev was wrong.
7. As a new workspace with no business, my agent connects and is told "No business yet — agents carry
   on", and its questions still reach the page.

## Scope

**In:**
- the token table and its functions (make, revoke, read by hash), the question table and its
  functions (report, answer once, dismiss, bring back, Jev's verdict);
- one product read shared by `business_for_repo` and the token read;
- `/api/mcp` with its three tools, its errors and its limits;
- the two cards on Settings › Business, at 393px and in demo mode;
- open questions in the bell's Business count;
- the `unknown-worth-asking` Jev decision on Settings › Jev.

**Out:**
- a local `omni mcp` server, and any change to the `omni` CLI;
- tokens per repository or per product, and token expiry dates;
- writing claims through MCP (the link is read-only, `report_unknown` aside);
- loop skills reporting unknowns (their gap question stays PRD 822's);
- a live "who asked" feed, per-asker permissions, sales reach (concept 746, killed H);
- OAuth for MCP clients.

## Test seams

Tests follow `omni kb show testing`: beside the code, run by `pnpm test`, never calling GitHub,
Supabase or TypeSafe.

- **SQL** (`supabase/checks/agent_tokens.sql`, `supabase/checks/agent_questions.sql`): a made token reads its workspace's business, and the
  body equals `business_for_repo`'s for the same repository; a revoked token is refused; a token whose
  maker left the workspace is refused; a token never reads another workspace's repository; the 21st
  live token and the 31st report in 24 hours are refused; a repeated question bumps one row; answer
  once makes a confirmed claim and closes the question; only the maker or an owner revokes.
- **Galaxy, the route:** a real MCP client (the SDK's) against `/api/mcp` with a fake store: the three
  tools listed; `get_business` byte-equal to `readBusiness` on the same store answer; `get_claims`
  filtering; `report_unknown` stored; no token, a bad token and a revoked token each refused with the
  one line; several products and no `repo` answered with the repository list; an empty business
  answered `state: "none"`; the limit's line.
- **Galaxy, the cards:** render tests for Connect an agent (empty, token shown once, list, revoke own
  vs owner) and for the questions (none, open, asked 2×, answer once, dismiss, Jev set aside folded
  and Bring back), at 393px and in demo mode.
- **Galaxy, Jev:** the `unknown-worth-asking` entry's state and value; Off stores nothing from Jev,
  Shadow records only, On under the floor keeps the question open, On above the floor sets it aside.
- **Galaxy, the bell:** open questions add to the Business count; set-aside ones do not.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the migration goes to production through the
  Supabase workflow's deploy; the route and cards ship with galaxy. No kit change, so no
  `omni update` is owed.
- **A new public door into the business.** Tokens are bearer secrets: anyone holding one reads the
  workspace's confirmed claims. Mitigations: read-only, hash stored, shown once, revocable, tied to
  the maker's membership, and only confirmed and contradicted claims leave (as for the CLI).
- **A leaked token can fill the questions card.** Mitigation: 30 reports per token per day, dismiss,
  and Jev's set aside.
- **Migration order:** check the latest migration on `main` right before merging (the lesson of
  #771).
- **Rollback:** one SQL line revokes every token (every link stops at once); then revert the PR. The
  tables stay until a follow-up migration drops them; the Jev decision's row is removed with it.
- **Not proven by CI:** a real Cursor or Claude Code session connected to production, and a real Jev
  call. Owed after merge by a person.

## Acceptance criteria

1. On Settings › Business, Make link with a name shows a token once, with setup for Cursor, Claude
   Code and any MCP client; the token is never shown again.
2. The token list shows each live token's name, maker, creation and last use; Revoke works on your
   own, and on any for a workspace owner.
3. An MCP client with the token lists three tools: `get_business`, `get_claims` and `report_unknown`.
4. `get_business` with a tracked repository answers exactly the body `GET /api/business` answers for
   that repository.
5. `get_claims` with a kind answers only that kind's claims.
6. With no `repo`, one product is read; several products give an error naming the tracked
   repositories.
7. An empty business answers `state: "none"`, not an error.
8. A missing, unknown or revoked token, or one whose maker left the workspace, is refused with one
   line saying to make a new link on Settings › Business.
9. `report_unknown` stores the question with its asker, repository and file, and it shows on
   Settings › Business and in the bell's Business count.
10. The same question asked again shows "asked 2×" on one row.
11. Answer once saves a confirmed claim of the picked kind and value, closes the question, and the next
    `get_business` carries the claim.
12. Dismiss closes the question with no claim.
13. A token's 31st report in 24 hours, and a person's 21st live token, are refused with one line.
14. With Jev's Unknown worth asking On, a question Jev says is not worth asking is folded under
    "Jev set aside N", out of the bell, and Bring back reopens it; Shadow records only; Off changes
    nothing.
