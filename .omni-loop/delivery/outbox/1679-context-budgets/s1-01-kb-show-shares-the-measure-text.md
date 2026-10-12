---
id: s1-01-kb-show-shares-the-measure-text
prd: 1679
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

To count what an agent reads, the size check needs the exact page the playbook command prints. Should both share one piece of code, even though that touches the playbook command, which this slice was not meant to change?

## The decision, in plain words

Both now share one piece of code that writes a playbook page, so the size counted is always the size an agent reads. The playbook command prints exactly what it printed before.

## The intro, for fun

Two rulers measuring the same page will one day disagree.

## The punchline, for fun

So now there is one ruler, and it lives with the budgets.

## The options, in plain words

A. A. One shared function in the budgets module, used by kb show and the measure (built).
B. B. Move the shared function into the playbook module, where the form resolver lives.
C. C. Keep two copies, held equal by a test, and silence the duplication gate.

## What I had to decide

Whether kit/bin/commands/kb.ts may take its form text from formShowText in kit/lib/budgets/measure.ts, a file outside s1's territory, rather than keep its own copy of the same ten lines.

## What I did meanwhile

Moved the form-to-text code out of kb.ts into kit/lib/budgets/measure.ts as formShowText, and made kb.ts import it; kb show's output is unchanged (kit/bin/kb.test.ts green). Keeping a copy was refused by the repository's duplication gate.

## What it costs to change later

A constant: moving formShowText to kit/lib/playbook/ later is one file move and two import lines; no stored shape or public command changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether kit/lib/playbook/ is the better home for formShowText: it was outside the territory too, so the function stayed beside the measure.
