# Plan: Screenshots on an Other answer

PRD #620, specified in `spec.md` beside this plan. The feature branch `feat/screenshot-answers`
goes into `main` through one feature PR (`Closes #620`); each slice is a sub-PR from
`feat/screenshot-answers--<slice>` into the feature branch (`Part of #620`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A round's screenshots reach Claude: the private `ask-attachments` bucket and its policies, the `ask_rounds.attachments` column with its check and grant, `moveRound` recording attachments with the answer, `wait` returning signed links, and the hook downloading each into `.omni-loop/local/ask/shots/<round>/` and appending the paths (with the 7-day cleanup) | `supabase/` `apps/galaxy/src/ask/store.ts` `apps/galaxy/src/ask/store.test.ts` `apps/galaxy/src/ask/api.ts` `apps/galaxy/src/ask/api.test.ts` `apps/galaxy/src/ask/attachments-sql*` `apps/galaxy/app/api/ask/` `kit/lib/ask/` `kit/dist/` | — | 1 |
| s2 | Other takes screenshots on the ask page: the button, paste and drop, thumbnails with ×, inline refusals, Other switched on, `(see screenshots)`, upload on Send with progress, retry that reuses uploads, and cleanup when the terminal answered first | `apps/galaxy/src/ask/answer-model` `apps/galaxy/src/ask/page/RoundForm.tsx` `apps/galaxy/src/ask/page/source.ts` `apps/galaxy/src/ask/page/source.test.ts` `apps/galaxy/src/ask/page/attachments` `apps/galaxy/src/ask/page/render.test.ts` `apps/galaxy/src/ask/ask.css` | s1 | 2 |
| s3 | Deleting a session deletes its screenshots from the bucket before its rows | `apps/galaxy/src/ask/api.ts` `apps/galaxy/src/ask/api.test.ts` `apps/galaxy/src/ask/store.ts` `apps/galaxy/src/ask/store.test.ts` | s1 | 2 |
| s4 | History, the workspace history and the shared-round page show "📎 N screenshots" on an answer that has them | `apps/galaxy/src/ask/page/source.ts` `apps/galaxy/src/ask/page/source.test.ts` `apps/galaxy/src/ask/page/view` `apps/galaxy/src/ask/page/History.tsx` `apps/galaxy/src/ask/page/history` `apps/galaxy/src/ask/page/WorkspaceHistory.tsx` `apps/galaxy/src/ask/page/workspace-history` `apps/galaxy/src/ask/page/question` `apps/galaxy/src/ask/page/AskQuestion.tsx` `apps/galaxy/src/ask/page/render.test.ts` `apps/galaxy/src/ask/page/demo` `apps/galaxy/src/ask/ask.css` | s2 | 3 |

**Shared ground.**
- `apps/galaxy/src/ask/api.ts`, `api.test.ts`, `store.ts` and `store.test.ts` belong to s1 and s3;
  s3 waits for s1, in wave 2.
- `apps/galaxy/src/ask/page/source.ts`, `source.test.ts`, `page/render.test.ts` (which renders the
  question form and History together) and `ask.css` belong to s2 and s4; s4 waits for s2, in wave 3.
- s2 and s3 share nothing, so they run side by side in wave 2.
- `kit/dist/` is s1's alone: only s1 changes the kit, and it rebuilds the bundle (`pnpm kit:build`).

## Per slice: done when

**s1**
- One new migration creates the private `ask-attachments` bucket (5 MB, PNG/JPEG/GIF/WebP), its
  insert, select and delete policies (no update policy), `ask_rounds.attachments` with
  `ask_attachments_valid`, and `grant update (attachments)`. A test over the SQL text checks each one.
- `moveRound` sends `attachments` with the answer in the same update (`store.test.ts`).
- `GET /api/ask/rounds/:id/wait` returns `attachments: { question: [{ name, url }] }` with
  10-minute signed links, `url: null` for a link that can't be made, and no field when there are no
  attachments (`api.test.ts`, stubbed Supabase).
- The hook downloads into `.omni-loop/local/ask/shots/<round>/` and appends
  "Screenshots (open each with Read):" plus one absolute path per file. A `null` link or a failed
  download gives "Screenshot n could not be downloaded", and the answer still goes through. Folders
  older than 7 days are removed before a new round opens, and an answer with no attachments is
  unchanged (`hook.test.mjs`).
- `kit/dist/omni.mjs` is rebuilt, and `kit/test/dist.test.mjs` passes.

**s2**
- Other takes a screenshot by the button, by pasting into its textarea and by dropping a file, each
  shown as a thumbnail with a × that removes it (`render.test.ts`).
- A non-image, a file over 5 MB and a sixth screenshot are each refused with their inline reason,
  and the others stay. Adding a screenshot switches Other on. No text plus screenshots sends
  `(see screenshots)` (`answer-model.test.ts`).
- Send uploads first with "Uploading n of m…", then records the answer with `attachments`. A failed
  upload records nothing, and Send again uploads only what's missing. "Already answered" deletes the
  uploads (`page/attachments.test.ts`, stubbed storage client).

**s3**
- `DELETE /api/ask/sessions/:id` removes every object under its rounds' folders before deleting the
  rows
  (`api.test.ts`).

**s4**
- An answered round with attachments shows "📎 N screenshots" in History, in the workspace history
  and on the shared-round page. One without shows nothing new (`history-render.test.ts`,
  `workspace-history.test.ts`, `render.test.ts`).
- Manual browser pass (owed at acceptance): paste, drop and the button on a real round, then Claude
  in a real terminal describes the screenshot.
