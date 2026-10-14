---
prd: 1951
title: The decisions form prints the latest 20 records, --all prints every one
blocked-by: none
spec: file
phase0: server
---

## Problem

`omni kb show decisions` prints the decisions form, then every decision record's number and title,
then the next free number. Every agent session that records or looks up a decision reads it, and
`omni check context` holds it to a ceiling (`form:decisions` in `.omni-loop/budgets/context.json`,
PRD 1679). The list grows by one line, about 110 bytes, with every ADR: at 116 records the form is
15,360 bytes, exactly its ceiling, of which about 14 KB is the list. The ceiling was raised from
14,336 to 15,360 bytes in #1871 and a second raise to 16,384 was asked in the same PRD's outbox; the
next ADR turns `check context` red again, on whichever unrelated pull request writes it. Raising the
ceiling every few records spends a person's answer on nothing, and the list itself is mostly records
an agent does not need to read to take the next number.

## Solution

1. **The default view.** `omni kb show decisions` prints the form as today, then, under
   `## Records  [read live from <dir>]`:
   - the **latest 20 records**, the highest numbers, in number order, one line each as today
     (`0116  ADR-0116 — …`);
   - when there are more than 20, one line after them: `… <k> older records: omni kb show decisions
     --all`, `<k>` counted live;
   - every shared-number warning (`! <n> is used by …`), whatever the records' age, as today;
   - `Next free number: <nnnn>`, as today.

   With 20 records or fewer it prints them all and no "older" line, exactly as today.
2. **`--all`.** `omni kb show decisions --all` prints every record, which is today's output. `--all`
   is accepted with the decisions form only: with any other form it is a usage error that names it.
   `--all` and `--json` may be given together.
3. **`--json` is unchanged:** `omni kb show decisions --json` still carries every record, the shared
   numbers and the next free number. A script reads it whole; only the text a session reads is cut.
4. **The measure.** `omni check context` measures `form:decisions` as the default view prints it
   (the measure and the command share `formShowText`, so they stay one). The form then holds at
   about 4 KB however many records exist.
5. **The ceiling** of `form:decisions` goes from 15,360 down to 6,144 bytes, leaving room for the
   form's own text to grow without a raise.
6. **The words.** The Numbering slot of this repository's form (`.omni-loop/knowledge/adr/README.md`)
   and of the kit's template (`kit/templates/playbook/decisions.md`) say the form prints the next
   free number and the latest 20 records, that `omni kb show decisions --all` prints every one, and
   that a decision is looked up there (or searched for in the folder) before a new record is
   written. `omni help kb` and the command's usage line name `--all`.
7. **What reads the records otherwise is untouched:** the harvest's classifier
   (`kit/lib/knowledge/classify.ts`) and the record writer (`kit/lib/knowledge/write.ts`) call
   `readDecisions` directly and keep every record.

## Decisions

- **20 records** (asked): enough to show the recent run of numbers and titles, about 2.6 KB today.
- **The ceiling goes down** (asked) to 6,144 bytes, not kept at 15,360: a ceiling far above the
  form's size would let it grow unseen again. Lowering a ceiling trims; it needs no outbox item.
- **`--json` keeps every record** (assumed, said in the design): it is read by scripts, not by a
  session, and no budget measures it.
- **"Latest" means the highest numbers,** not the newest dates: numbers are handed out in order,
  and a record's date is a line inside it the command does not read.
- **Shared-number warnings stay whole:** a shared number is a mistake to fix at any age, and the
  warning is the only place it shows.
- **Voice objection** (persona:Lead Engineer): "I'm trying to keep the teams cohesive; if agents
  only see the last 20 decisions, they'll re-decide something ADR-0030 already settled without
  knowing it." Settled `accepted`: the "older" line names `--all` every time the list is cut, and the
  Numbering slot tells an agent to look a decision up with `--all`, or search the folder, before
  writing a new record.

## User stories

- As an agent recording a decision, I run `omni kb show decisions` and read the next free number
  and the last 20 records in a form a few KB long.
- As an agent looking up an older decision, the list tells me how many records it left out and the
  command that prints them all.
- As a maintainer, I merge the 117th, 150th and 300th ADR and `check context` stays green without
  anyone raising a ceiling.

## Scope

In: `omni kb show decisions` (its text view and `--all`), the shared text builder and the measure
(`kit/lib/budgets/measure.ts`), the command (`kit/bin/commands/kb.ts`), its help entry
(`kit/lib/help/entries.ts`), the decisions form's Numbering slot here and in the kit template, the
`form:decisions` ceiling, the tests, and the rebuilt `kit/dist/omni.mjs`.

Out: `--json`, `readDecisions` itself, the classifier and the record writer, the other forms and
their ceilings, the ADR files, and any page of the Omni app.

## Test seams

- **The command** (`kit/bin/kb.test.ts`, through `main()` on a `makeRepo()` fixture): a folder of
  25 records prints the 20 highest in order, the line `… 5 older records: omni kb show decisions
  --all`, and the next free number; `--all` prints all 25 and no "older" line; a folder of 20 prints
  all 20 and no "older" line; a shared number among the five older records still prints its
  warning; `--json` carries all 25; `kb show testing --all` is a usage error naming `--all`.
- **The measure** (`kit/lib/budgets/measure.test.ts`): `form:decisions` equals the bytes the default
  view prints, on the same 25-record fixture.
- **The budget** (`omni check context`): green on this repository with the ceiling at 6,144.
- **The bundle** (`kit/test/dist.test.ts`): `kit/dist/omni.mjs` rebuilt with the change.
- No test calls GitHub or Supabase (testing › Never).

## Risks

Merging publishes the kit: the release commit after the merge carries the new `omni kb show`
output in `kit/dist/omni.mjs` to every repository that updates the kit (releasing). Rollback is
reverting the merge commit: the change is one command's output, two paragraphs of a form, a
ceiling and tests, with no state, no migration and no API change.

- **An agent misses an older decision.** It no longer sees records below the latest 20 unless it
  runs `--all`; the "older" line and the Numbering slot both name it (the objection above).
- **A skill that expected the whole list.** No skill parses the list: they read the form for the
  format and the next number (`yolo-fix`), and the harvest reads the folder directly.
- **The ceiling too tight.** At 6,144 bytes the form has about 2 KB of room for its own text; a
  form that later grows past it is red, and its PR raises the ceiling through an outbox item, as
  today.

The locked laws: the files this PRD changes show, store or guard none of them; it changes what one
command prints. Changing any of them needs @pierrederval to approve the pull request on GitHub.

- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch unseen.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what it sees.
- BR-PRODUCT-29: a stranger could read a team's questions and answers.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner lose it.
- BR-PRODUCT-59: a member could copy the paid AI key and run up the bill.
- BR-PRODUCT-63: an agent could read another team's private work.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent.
- BR-PRODUCT-94: an agent could answer a question in a person's name.
- N-PRODUCT-3: a badly ranked question slips past the person who answers it.
- N-PRODUCT-4: a change could switch its own gate off behind a green check.
- N-PRODUCT-7: a person is locked out of their own terminal by a broken hook.
- N-PRODUCT-8: questions and answers could go to a server the person never chose.
- N-PRODUCT-13: the install could overwrite a person's own settings.
- N-PRODUCT-14: a rule quietly loses its test until the server refuses the PR.
- N-PRODUCT-15: unreviewed work reaches every user with nobody choosing to ship it.
- N-PRODUCT-16: scores and history could change after the fact.
- N-PRODUCT-17: anyone opening the arcade could read a key that controls the database.

## Acceptance criteria

- With more than 20 records, `omni kb show decisions` prints the 20 highest-numbered records in
  number order, then `… <k> older records: omni kb show decisions --all` with `<k>` the rest, then
  every shared-number warning, then `Next free number: <nnnn>`.
- With 20 records or fewer, it prints them all and no "older" line.
- `omni kb show decisions --all` prints every record and no "older" line.
- `omni kb show <any other form> --all` exits with a usage error naming `--all`.
- `omni kb show decisions --json` carries every record, as today.
- `omni check context` measures `form:decisions` as the default view prints it, and is green on this
  repository with the `form:decisions` ceiling at 6,144 bytes.
- The Numbering slot of `.omni-loop/knowledge/adr/README.md` and of
  `kit/templates/playbook/decisions.md`, and `omni help kb`, name `--all`.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green, and `kit/dist/omni.mjs` is rebuilt.
