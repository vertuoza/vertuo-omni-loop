---
prd: 752
title: Readable long questions and Claude's message on the ask page
blocked-by: none
spec: file
---

# Readable long questions and Claude's message on the ask page

**Date:** 2026-09-30 · **PRD:** #752
**Touches:**
- `kit/lib/ask/` (a new lead reader, `hook.mjs`, `client.mjs`), `kit/test/fake-ask-server.mjs`
- `supabase/migrations/` (one new file: `ask_rounds.lead`)
- `apps/galaxy/src/ask/` (`api.ts`, `store.ts`, `answer-model.ts`, a new long-question module)
- `apps/galaxy/src/ask/page/` (`RoundForm.tsx`, `source.ts`, `view.ts`, `ask.css` rules)
- `apps/galaxy/src/dossier/markdown.ts` (shared with the ask page)
- `.omni-loop/knowledge/adr/0002-kit-may-depend-on-a-url.md` (amended)

## Problem

A question on the ask page is drawn as one bold 22 px heading, whatever its length. A long question
of several sentences, with inline steps "(1) … (2) … (3) …" and package names and file paths, becomes
a wall of bold text. The steps are not a list, and the names are not set apart. The question someone
has to answer is lost at the end.

When Claude asks someone to approve something it just wrote in the terminal, like a design in
`/omni:brainstorm` or a plan, the page shows only the question ("Does this design look right?"). The
design is in the terminal. The person answering on the page has to switch back to the terminal to
read what they are approving, which defeats the page.

## Solution

**The long question.** A question longer than 280 characters is drawn as a lead plus a fold:

- The **lead** is its first paragraph when the text has a blank line in it. Otherwise it is its
  first sentence, followed by its last sentence that ends in "?" when that is a different sentence.
  The lead is bold, at 18 px.
- The rest of the text folds under "Read the full question · N steps · N words", closed at first.
  "N steps" appears only when there are steps.
- Question text and option descriptions are rendered as safe markdown (raw HTML off, as the
  dossier's renderer). Inline steps written `(1) …; (2) …; (3) …` become a numbered list.
- A question of 280 characters or fewer looks exactly as today: one heading, plain text.

**Claude's message before the question.** When Claude asks, the ask hook reads the session's
transcript and takes the **lead message**: only the text blocks of Claude's last assistant message
before the AskUserQuestion call. It never takes tool calls, tool results, file contents, thinking, or
the person's own messages. The text is capped at 16 KB. When it is cut, it ends with "… (shortened,
the rest is in the terminal)". The hook sends it as an optional `lead` on the open-round call. The
server stores it in `ask_rounds.lead`. The page shows it once, above the round's questions, in a
block titled "Claude wrote before asking", rendered as the same safe markdown and folded after about
12 lines behind "Show all".

## Decisions

1. **Where the design comes from:** Claude's last message before the question, read by the hook, so
   no skill has to change (the person chose it over skills pasting the design into the question and
   over embedding the before/after page).
2. **ADR-0002 is amended** (the person chose it, over a switch and over keeping the rule): names and
   counts leave the machine, plus the text blocks of the last assistant message before a question, as
   that round's lead. No other transcript text leaves. The classifier never reads the lead.
3. **The look is C:** lead + fold (the person picked it from five drawn versions).
4. **The lead rule is both:** first paragraph when there is a blank line, else the first sentence
   plus the final question (the person's pick).
5. **`lead` is a top-level field of the round body, not a `context` field:** `context` holds names
   and counts only. An older kit sends no `lead`, and an older server ignores it: the contract
   holds both ways.
6. **The page renders markdown in the browser.** The ask page reads rounds from the database in the
   browser and polls every 2 s, so there is no server step to render in. `src/dossier/markdown.ts`
   is shared with the same markdown-it settings (`html: false`, `linkify: false`), and the dossier
   keeps rendering on the server. The alternative, storing rendered HTML, would put markup in the
   database and is not taken.
7. **Threshold 280 characters, fold after 12 lines, cap 16 KB:** chosen here and easy to change.
   Each is one named constant.

## User stories

1. As someone answering on the ask page, I read a long question as a short lead and the question
   itself, and open the detail only when I need it.
2. As someone answering on the ask page, I see steps as a numbered list and file paths and package
   names as code.
3. As someone asked "does this design look right?", I read the design right above the question, on
   the page, without switching to the terminal.
4. As someone reading an answered round later (history, a shared round, a round opened from a
   dossier), I see the same lead and fold.
5. As the owner of a repository, I know exactly which transcript text leaves my machine: the text
   of Claude's last message before each question, and nothing else.

## Scope

In:
- The lead reader in the kit and the hook sending `lead`.
- The `lead` field on `POST /api/ask/sessions/:id/rounds`, and the `ask_rounds.lead` column.
- The long-question lead and fold, markdown in questions and option descriptions, and the "Claude
  wrote before asking" block, on the open round, the answered round, the shared round
  (`/ask/q/<round>`) and a round opened from a dossier.
- The ADR-0002 amendment.

Out:
- The terminal's own question, which is unchanged.
- Previews (`preview` stays a monospace panel).
- The history list's one-line summary of a round, which stays plain text.
- The question classifier, which never gets the lead.

## Test seams

- **Kit, the lead reader:** a pure function over transcript JSON lines, with fixtures. It takes the
  text blocks of the last assistant message before the AskUserQuestion tool use. It skips tool use,
  tool results and thinking, joins several text blocks with a blank line, and cuts at 16 KB with the
  shortened note. A missing or unreadable transcript gives `null`, never a throw.
- **Kit, the hook:** against `kit/test/fake-ask-server.mjs`, the open-round body carries `lead`, and
  carries none when the reader gives `null`. The question still opens when the reader throws.
- **App, the long-question rule:** a pure function from question text to `{lead, rest, steps, words}`
  or `null` for a short question. It covers the paragraph rule, the sentence fallback, a question
  whose first sentence is its question, and inline steps to a list.
- **App, the API:** `lead` is accepted as text up to 16 KB plus the note, or null. A non-string is
  refused with 400. It is stored and read back with the round.
- **App, the page:** render tests for the fold (closed at first, and the counts), for a short
  question looking as today, for the "Claude wrote before asking" block and its "Show all", and for
  raw HTML in a question or lead shown as text.
- **Migration:** the column exists, is nullable, and changes no row-level security.
- Tests never call GitHub or Supabase: fixtures only.

## Risks

- **Transcript text leaves the machine.** This is the deliberate change. It is limited to the text of
  one message per round, is readable by the round's workspace members exactly as the questions are,
  and is recorded in ADR-0002. Rollback: a kit release that stops sending `lead`. Rows already stored
  keep theirs until deleted with their session.
- **Markup injection.** A lead or question containing HTML must never become markup on the galaxy's
  origin. markdown-it runs with `html: false` and refuses `javascript:`, `data:` and similar links,
  and a render test pins it.
- **What a merge publishes:** a migration applied to production Supabase (an added nullable column,
  so safe to leave in place on rollback), a kit change handed out by the install and the plugin, and
  the galaxy's pages. Rolling back is a revert PR. The column may stay.
- **Bundle size:** markdown-it joins the ask page's browser bundle, at about 30 KB gzipped.

## Acceptance criteria

1. A question over 280 characters with a blank line shows its first paragraph bold, with the rest
   folded under "Read the full question · … words".
2. The ERP question from the issue (no blank line) shows "The two customer-facing screens … dist."
   plus "Has that been done?" as the lead. Its three steps are a numbered list inside the fold, and
   the summary reads "3 steps".
3. A question of 280 characters or fewer renders exactly as before.
4. `libs/vertuo-workflow-ui/README.md` written in backticks in a question renders as code. `<b>x</b>`
   in a question renders as the literal text `<b>x</b>`.
5. When Claude writes a design and then asks, the page shows that design above the question, under
   "Claude wrote before asking", folded after about 12 lines with "Show all".
6. The open-round body sent by the hook never contains tool input, tool output, thinking or a user
   message. The kit test pins it with a transcript that holds all four.
7. An older kit that sends no `lead`, and a transcript that cannot be read, both open the question
   with no "Claude wrote" block.
8. ADR-0002 states the lead exception in its contract paragraph.
