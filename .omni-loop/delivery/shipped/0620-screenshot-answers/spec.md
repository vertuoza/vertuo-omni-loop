---
prd: 620
title: Screenshots on an Other answer
blocked-by: none
spec: file
---

# Screenshots on an Other answer

**Date:** 2026-09-29 · **PRD:** #620 · **Touches:** `supabase/migrations/` (one new file),
`apps/galaxy/src/ask/answer-model.ts`, `apps/galaxy/src/ask/page/RoundForm.tsx`,
`apps/galaxy/src/ask/page/source.ts`, `apps/galaxy/src/ask/page/attachments.ts` (new),
`apps/galaxy/src/ask/store.ts`, `apps/galaxy/src/ask/api.ts`, the History views under
`apps/galaxy/src/ask/page/`, `kit/lib/ask/hook.mjs`, `kit/lib/ask/client.mjs`,
`kit/lib/ask/local-state.mjs`. No change to the outbox cards, the dossier's quick answers, the game,
or the shape of `answers`.

## Problem

In ask mode, Claude's questions land on a web page, and **Other** takes typed text only. A person
answering "what does it look like now?" or "which of these is broken?" has to describe a screen in
words, or paste a link Claude cannot open. Nothing in the repository stores a file today: no bucket,
no upload, no file input. `ask_rounds.answers` accepts only strings (`ask_answers_valid`), and the
kit's hook refuses any answer that is not a non-empty string (`toolAnswers`).

## Solution

On the ask page, the **Other** option of every question takes up to five screenshots beside its
text. They go into a private Supabase Storage bucket, `ask-attachments`, straight from the browser,
when the person presses **Send**. The round records their paths in a new column,
`ask_rounds.attachments`, next to the answer; the answer itself stays a string. When the terminal's
hook sees the round answered, the wait call hands it a short-lived signed link per screenshot; the
hook downloads each into the checkout's never-committed `.omni-loop/local/` folder and appends the
absolute paths to that question's answer text, so Claude opens them with Read and sees the images.

### The page

- Under the Other textarea, a row of thumbnails and an **Add screenshot** button (a hidden
  `<input type="file" multiple>` accepting PNG, JPEG, GIF and WebP).
- Three ways in: the button, pasting an image into the textarea (Cmd+V / Ctrl+V), dropping files on
  the Other area. Each image becomes a thumbnail with a × that removes it.
- Adding a screenshot switches Other on, as typing does (`toggleOther`/`typeOther` today).
- A refused file is named inline and the others are kept: "PNG, JPEG, GIF or WebP only",
  "5 MB max", "5 screenshots max".
- An Other answer with screenshots and no text is sendable; its answer text is `(see screenshots)`.
- **Send** uploads every screenshot first, one after the other, showing "Uploading 2 of 3…", then
  records the answer and its attachments in one update (`moveRound`). An upload that fails stops
  Send before anything is recorded: "Could not upload 2 of 3 — Send again". Send again reuses the
  files already uploaded and uploads only the rest. When the round turns out already answered (the
  terminal won), the page shows its usual "already answered" note and deletes what it uploaded.
- History and the shared-round page show the answer text and, when there are any, "📎 N screenshots".
  Thumbnails in History are out of scope.

### Storage and data

- **Bucket** `ask-attachments`: private, `file_size_limit` 5 MB, `allowed_mime_types` PNG, JPEG,
  GIF, WebP. An object's path is `<round id>/<n>.<ext>`, `n` from 1 to 5.
- **Row-level rules on `storage.objects`** for that bucket, keyed on the path's first segment:
  - *insert:* whoever may answer that round while it is open — the session's owner, or a member the
    round is shared with (`ask_shared_with_me`) — the same people the answer's update policy lets in;
  - *select:* whoever may select the round (every member of its workspace);
  - *delete:* the uploader, while the round is open; *update:* nobody.
- **Column** `ask_rounds.attachments jsonb`, null by default:
  `{ "<question text>": ["<round id>/1.png", …] }`. A check (`ask_attachments_valid(round, a)`)
  requires an object whose every value is an array of 1 to 5 strings, each under that round's own
  folder. `authenticated` gets `update (attachments)`. The existing guard makes it final with the
  answer: it may be set only in the same update that answers the round, and never changed after.
- **Deleting a session** (`DELETE /api/ask/sessions/:id`) removes every object under its rounds'
  folders through the Storage API before it deletes the rows. A plain SQL delete would leave the
  files behind.

### The contract

`GET /api/ask/rounds/:id/wait`, when the round is answered and has attachments, also returns

```json
{ "status": "answered", "answers": { "…": "…" },
  "attachments": { "<question text>": [{ "name": "1.png", "url": "https://…signed…" }] } }
```

Each `url` is a signed link valid 10 minutes, made with the caller's rights; one that cannot be made
is `null`. A round without attachments returns no `attachments` field, as today. A kit that does not
know the field ignores it.

### The kit

- On an answered wait with `attachments`, `preHook` downloads each link to
  `.omni-loop/local/ask/shots/<round id>/<name>` (the folder's `.gitignore` already keeps it out of
  git; inside the checkout, Read asks no permission).
- It appends to that question's answer, after one blank line:

  ```text
  Screenshots (open each with Read):
  - <absolute path to 1.png>
  - <absolute path to 2.png>
  ```

- Downloads share the hook's existing total budget (540 s), 30 s per file. A link that is `null` or a
  download that fails puts `- Screenshot <n> could not be downloaded` in its place; the answer still
  goes through.
- Before a new round is opened, screenshot folders older than 7 days are removed. `omni ask off`
  removes nothing.
- A terminal answer (`postHook`) carries no attachments: unchanged.

## Decisions

- **Surface: the ask page's Other only.** Outbox cards (GitHub PR comments) and the dossier's quick
  answers are out of scope.
- **Upload straight from the browser to Storage**, under row-level rules. An API route was ruled out:
  Vercel caps a function's request body near 4.5 MB, under the 5 MB per-screenshot limit. Base64 in
  Postgres was ruled out: rows of up to 25 MB and heavy waits.
- **Answers stay strings.** Attachments live in their own column, so `ask_answers_valid`, the
  AskUserQuestion shape and every reader of `answers` are unchanged.
- **Claude gets file paths, not links.** Read shows an image; a link would reach Claude as text.
- **Limits:** images only (PNG, JPEG, GIF, WebP), 5 per Other answer, 5 MB each.
- **Pictures alone are an answer:** `(see screenshots)`.
- **Workspace members read the screenshots,** as they read the round.
- **Local copies expire after 7 days;** the bucket keeps them until the session is deleted.

## User stories

1. As someone answering a question on the ask page, I paste a screenshot into Other and press Send,
   so Claude sees exactly what I see.
2. As someone answering, I drop three screenshots and add one line of text, and all four reach
   Claude.
3. As someone answering, I pick Other with only a screenshot and no text, and Send works.
4. As someone answering, when an upload fails I press Send again and it goes through, without
   retyping or re-adding anything.
5. As a teammate a round was shared with, I can attach screenshots the same way.
6. As Claude in the terminal, I get the answer text with absolute paths I can Read.
7. As a session owner, deleting my session deletes its screenshots.

## Scope

**In:** the Other option on the ask page (`RoundForm`) in single- and multi-select questions; the
bucket, its policies and the column; signed links in `wait`; the kit's download and answer text;
"📎 N screenshots" in History; file removal on session delete; the 7-day local cleanup.

**Out:** outbox cards and quick answers; thumbnails in History; non-image files; images on a chosen
option (only Other); editing an answer's screenshots after Send; image resizing or compression.

## Test seams

Every test runs on fixtures: no test calls Supabase or GitHub.

- `apps/galaxy/src/ask/answer-model.test.ts` — accepting and refusing a file (type, 5 MB, sixth
  file), adding a screenshot switches Other on, `(see screenshots)` when there is no text, the
  attachments map a round sends.
- `apps/galaxy/src/ask/page/attachments.test.ts` (new) — against a stubbed storage client: upload
  then record, in order; progress counts; a failed upload records nothing and a retry uploads only
  what is missing; "already answered" deletes the uploads.
- `apps/galaxy/src/ask/api.test.ts` — `wait` returns `attachments` with signed links; a link that
  cannot be made is `null`; no field without attachments; session delete removes the objects first.
- `apps/galaxy/src/ask/store.test.ts` — `moveRound` sends `attachments` with the answer.
- A migration check over the SQL text: the bucket's limits, the four policies, the column's check and
  its grant.
- `kit/lib/ask/hook.test.mjs` — downloads into `.omni-loop/local/ask/shots/<round>/`, the appended
  text exactly, a `null` link and a failed download, a 7-day-old folder removed, an answer with no
  attachments unchanged.
- **Manual browser pass:** paste, drop and the button on a real round, then Claude in a real
  terminal describes the screenshot.

## Risks

Merging publishes a migration to the production Supabase project (a new bucket, four storage
policies, one column, a check and a grant) and a new kit through the plugin and the install. Every
database change adds and removes nothing, so rolling back is reverting the PR; the bucket and column
may stay, unused. A kit from before this PRD ignores `attachments`: its user gets the text only.
Screenshots may show private screens: they sit in a private bucket readable only by the round's
workspace, and nothing publishes them.

## Acceptance criteria

1. On the ask page, Other takes a screenshot by the button, by pasting into its textarea, and by
   dropping a file on it; each shows as a thumbnail with a × that removes it.
2. A file that is not PNG, JPEG, GIF or WebP, a file over 5 MB, and a sixth screenshot are each
   refused with their reason shown inline, and the others stay.
3. Adding a screenshot switches Other on; an Other with screenshots and no text sends, as
   `(see screenshots)`.
4. After Send, the round's `attachments` names each screenshot under the round's folder, and the
   bucket holds each file.
5. A failed upload records no answer, and Send again completes it without re-adding anything.
6. The terminal receives the answer text followed by "Screenshots (open each with Read):" and one
   absolute path per screenshot, and each file exists at its path.
7. A screenshot that cannot be downloaded appears as "Screenshot n could not be downloaded" and the
   answer still reaches Claude.
8. Someone outside the round's workspace cannot read its screenshots; someone who may not answer the
   round cannot upload to its folder.
9. Deleting a session removes its screenshots from the bucket.
10. History shows "📎 N screenshots" on an answer that has them.
