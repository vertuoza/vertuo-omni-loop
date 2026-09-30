# Plan: readable long questions and Claude's message

PRD #752, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/readable-questions` into `main`, and the feature PR says `Closes #752`. Each slice is a sub-PR
from `feat/readable-questions--<slice>` into the feature branch, saying `Part of #752`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Makes a long question readable. A question over 280 characters shows its lead (the first paragraph, else the first sentence plus the final "?" sentence) in bold at 18 px, and folds the rest under "Read the full question · N steps · N words". Question text and option descriptions render as safe markdown, with inline `(1) … (2) …` steps as a numbered list. A short question looks as today. It shows on the open, answered and shared round | `apps/galaxy/src/ask/long-question.ts` `apps/galaxy/src/ask/long-question.test.ts` `apps/galaxy/src/ask/page/` `apps/galaxy/src/ask/ask.css` `apps/galaxy/src/dossier/markdown.ts` `apps/galaxy/src/dossier/markdown.test.ts` | — | 1 |
| s2 | Sends and stores the lead message. The kit reads only the text blocks of Claude's last message before the question from the transcript, capped at 16 KB with the shortened note, and the hook sends it as `lead` on the open-round call. The API accepts it (text or null, anything else is refused with 400) and stores it in the new `ask_rounds.lead`. ADR-0002 states the exception | `kit/lib/ask/` `kit/bin/ask-hook.test.mjs` `kit/test/fake-ask-server.mjs` `kit/dist/omni.mjs` `supabase/migrations/20261018090000_ask_round_lead.sql` `apps/galaxy/src/ask/api.ts` `apps/galaxy/src/ask/api.test.ts` `apps/galaxy/src/ask/store.ts` `apps/galaxy/src/ask/store.test.ts` `.omni-loop/knowledge/adr/0002-kit-may-depend-on-a-url.md` | — | 1 |
| s3 | Shows "Claude wrote before asking" on the page. The round's `lead` is read with the round and shown once above its questions as safe markdown, folded after about 12 lines behind "Show all", on the open, answered and shared round and on a round opened from a dossier. A round with no lead shows no block | `apps/galaxy/src/ask/page/` `apps/galaxy/src/ask/ask.css` | s1, s2 | 2 |

**Shared ground.**
- **`apps/galaxy/src/ask/page/` and `apps/galaxy/src/ask/ask.css`:** s1 and s3. Both change
  `RoundForm.tsx`, the round's view and `page/render.test.ts`. s3 is blocked by s1 and comes one wave
  later.
- **`apps/galaxy/src/dossier/markdown.ts`:** s1 alone. It makes the renderer usable in the browser
  with the same settings (`html: false`, `linkify: false`), and s3 imports it as s1 left it.
- **`kit/dist/omni.mjs`:** s2 alone rebuilds it (`pnpm kit:build`), because `kit/test/dist.test.mjs`
  fails on a stale bundle.
- **The database:** the only SQL is s2's single migration. s3 only adds `lead` to the columns the page
  reads.

## Per slice: done when

**s1**
- The ERP question from the issue shows "The two customer-facing screens … dist." and "Has that been
  done?" as its lead, with its three steps as a numbered list inside a closed fold whose summary says
  "3 steps".
- A question over 280 characters with a blank line shows its first paragraph as the lead.
- A question of 280 characters or fewer renders exactly as before (the existing render tests pass
  unchanged).
- Backticked paths render as code, and `<b>x</b>` in a question or an option description renders as
  the literal text.
- `long-question.test.ts` covers the paragraph rule, the sentence fallback, a question whose first
  sentence is its question, and the step count.

**s2**
- The lead reader, given a transcript holding a user message, thinking, a tool call, a tool result and
  two text blocks before the AskUserQuestion call, returns only the two text blocks, joined by a
  blank line.
- Over 16 KB, it is cut and ends with "… (shortened, the rest is in the terminal)". A missing or
  unreadable transcript gives `null`, and the question still opens.
- The hook's open-round body, seen by the fake server, carries `lead`, and carries none when there is
  no lead.
- `POST /api/ask/sessions/:id/rounds` stores `lead` and refuses a non-string `lead` with 400. A body
  without `lead` still opens a round.
- The migration adds a nullable `ask_rounds.lead text` and changes no policy.
- ADR-0002's contract paragraph names `lead` and says no other transcript text leaves the machine.
- `pnpm test` is green, with the kit bundle rebuilt.

**s3**
- A round with a lead shows "Claude wrote before asking" above its first question, rendered as
  markdown. A lead over about 12 lines is folded, and "Show all" opens it.
- A round without a lead shows no block.
- The block shows on the answered round, on `/ask/q/<round>`, and on a round opened with
  `?from=<dossier>`.
- HTML in a lead renders as text.
