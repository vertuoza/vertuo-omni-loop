---
id: s1-02-fun-line-refusal-shape
prd: 50
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

When the command that raises an item is handed an intro or a punchline that breaks the rules, how should it say so?

## The decision, in plain words

It refuses at once with a one-line error naming the field, the way it refuses any other bad field, and writes nothing. In its structured mode that is an error line rather than the structured answer a badly worded question gets.

## The options, in plain words

A. Refuse at once naming the field, as for any other bad field, the option built.
B. Refuse after drafting the item, naming the section, and answer in the structured form.
C. Name the field and answer in the structured form as well.

## What I had to decide

Where `omni item new` grades `introFun` and `punchlineFun`. Acceptance criterion 2 asks that it "names the field". The pre-write `checkItemText` pass would name the section heading (`## The intro, for fun`) and, under `--json`, print `outcome: null` with the reason on stdout. The input schema names the JSON field but, like every schema error, prints one line on stderr and nothing on stdout, `--json` or not.

## What I did meanwhile

The input schema holds each field to `funLineProblems` (a zod refinement), so the error reads `"introFun" — introFun is 125 characters long — keep it to 120 characters at most.`, exit 2, nothing written or adopted. `checkItemText` still grades the rendered item as well, as a second net. Giving one field without the other is the same kind of error, naming the missing field.

## What it costs to change later

Moving the refusal to the pre-write pass is deleting the two schema refinements and adjusting a few tests in `kit/bin/item.test.mjs`; no stored shape changes. Answering in JSON as well is a special case in `readItemInput`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a caller of `--json` (the `/omni:do-work` skill) needs a JSON answer for this refusal, or reads the stderr line as it already does for a missing field
