# Plan: Connect any agent

PRD #855, specified in `spec.md` beside this plan. Built on the feature branch `feat/agent-connect`
into `main`, whose feature PR says `Closes #855`; each slice is a sub-PR from
`feat/agent-connect--<slice>` into the feature branch, saying `Part of #855`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Tokens: a member makes a named read-only link on Settings › Business, sees it once, lists the workspace's tokens and revokes their own (an owner any); the database reads the business by a token's hash through the same product read as `business_for_repo` | `supabase/migrations/20261028090000_agent_tokens*` `supabase/checks/agent_tokens.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/agent-connect/tokens/` `apps/galaxy/app/api/agent-tokens/` `apps/galaxy/src/business/BusinessScreen.tsx` `apps/galaxy/src/business/BusinessView.tsx` `apps/galaxy/src/business/load.ts` `apps/galaxy/src/business/render.test.ts` `apps/galaxy/app/app/settings/business/page.tsx` | — | 1 |
| s2 | The MCP link: `/api/mcp` answers an MCP client holding a token with `get_business` (byte-equal to `GET /api/business`) and `get_claims`, refuses a missing, unknown or revoked token with one line, reads the only product without `repo` and names the tracked repositories when there are several | `apps/galaxy/app/api/mcp/` `apps/galaxy/src/agent-connect/mcp/` `apps/galaxy/package.json` `pnpm-lock.yaml` | s1 | 2 |
| s3 | Questions agents couldn't answer: `report_unknown` stores a question (one row per open question, asked N×, 30 a token a day), the card on Settings › Business answers it once as a confirmed claim or dismisses it, and open questions count in the bell's Business group | `supabase/migrations/20261028100000_agent_questions*` `supabase/checks/agent_questions.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/agent-connect/questions/` `apps/galaxy/src/agent-connect/mcp/` `apps/galaxy/app/api/agent-questions/` `apps/galaxy/src/waiting/business-count` `apps/galaxy/src/waiting/business-live.ts` `apps/galaxy/src/business/BusinessScreen.tsx` `apps/galaxy/src/business/BusinessView.tsx` `apps/galaxy/src/business/load.ts` `apps/galaxy/src/business/render.test.ts` `apps/galaxy/app/app/settings/business/page.tsx` | s2 | 3 |
| s4 | Jev's Unknown worth asking: a fourth decision on Settings › Jev that, when On, sets a question aside (folded under "Jev set aside N", Bring back, out of the bell), records only in Shadow, and changes nothing when Off | `supabase/migrations/20261028110000_unknown_worth_asking*` `supabase/checks/agent_questions.sql` `apps/galaxy/src/jev/decisions/` `apps/galaxy/src/agent-connect/questions/` `apps/galaxy/src/agent-connect/mcp/` | s3 | 4 |

**Shared ground.**
- `.github/workflows/supabase.yml` (one step per SQL check file): s1 and s3, waves 1 and 3.
- The Business page's wiring (`BusinessScreen.tsx`, `BusinessView.tsx`, `load.ts`, `page.tsx`) and
  its render test `render.test.ts`: s1 (Connect an agent card) and s3 (questions card), waves 1
  and 3.
- `apps/galaxy/src/agent-connect/mcp/`: s2 makes it, s3 adds `report_unknown`, s4 runs Jev after a
  report; waves 2, 3 and 4.
- `apps/galaxy/src/agent-connect/questions/` and `supabase/checks/agent_questions.sql`: s3 makes them,
  s4 adds the set-aside fold, Bring back and the Jev verdict; waves 3 and 4.
- The other render tests that read `BusinessScreen` or `BusinessView` (`never-render`,
  `personas-render`, `reveal-render`, `check-render`) must keep passing unchanged: s1 and s3 add
  cards without changing what those tests render.
- Migration file names are fixed here so the slices never clash; check the newest migration on
  `main` before the feature PR merges (#771), and rename when one landed after 20261027090000.

## Per slice: done when

**s1, tokens**
- `supabase/checks/agent_tokens.sql` passes in the supabase workflow: a made token reads its
  workspace's business, and `business_for_token` equals `business_for_repo` for the same repository;
  a revoked token and a token whose maker left the workspace are refused; a token never reads
  another workspace's repository; a person's 21st live token is refused; only the maker or an owner
  revokes; only the hash and the last four characters are stored.
- Settings › Business shows Connect an agent: Make link with a name shows the `omb_…` token once,
  with setup for Cursor, Claude Code and any MCP client; the list shows name, maker, created and last
  used; Revoke shows on your own tokens, and on all for an owner. Render tests cover empty, token
  shown once, list, own versus owner, 393px and demo mode.
- Every existing Business render test passes unchanged.

**s2, the MCP link**
- A test runs the SDK's MCP client against the route with a fake store: three tools are listed
  (`report_unknown` may answer "not yet" until s3); `get_business` with a repository is byte-equal
  to `readBusiness`'s body on the same store answer; `get_claims` with a kind answers only that kind.
- No token, a malformed token, an unknown token and a revoked token each get the one line saying to
  make a new link on Settings › Business.
- With no `repo`: one product is read; several products give an error naming the tracked
  repositories. An empty business answers `state: "none"`.
- `last used` is written at most once a minute per token.

**s3, questions**
- `supabase/checks/agent_questions.sql` passes: a report stores the question with its asker,
  repository and file; the same question (case and spaces aside) bumps one row; the 31st report of a
  token in 24 hours is refused; a question over 300 characters is refused; answer once makes a
  confirmed claim (source `answer`) of the picked kind, on the question's product, and closes the
  question linked to it; dismiss closes it with no claim; a member of another workspace sees nothing.
- `report_unknown` through the MCP client stores the question and answers that it was sent to
  Settings › Business; the limit answers its one line.
- The questions card renders none, open, asked 2×, answer once (kind and value) and dismiss, at
  393px and in demo mode; after answer once, the next `get_business` carries the claim.
- The bell's Business count adds open questions.

**s4, Jev**
- Settings › Jev lists Unknown worth asking, Off by default, with what it sends.
- With the decision Off, a report never calls Jev. Shadow records Jev's answer and leaves the question
  open. On above the confidence floor with a "no" sets the question aside; On under the floor keeps it
  open. Jev runs after the report has answered.
- A set-aside question is folded under "Jev set aside N" with Bring back, which reopens it; set-aside
  questions are not counted in the bell.
- `supabase/checks/agent_questions.sql` covers the verdict and Bring back.
