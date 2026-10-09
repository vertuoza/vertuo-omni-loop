---
id: s4-02-law-issue-opens-before-its-entry
prd: 1342
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

When a rule is judged worth a test, in what order should the harvest open its tracking issue and write the rule down?

## The decision, in plain words

The harvest works out every rule first and lists the issues to open, opens them, then writes each rule pointing at its issue. A rule the final checks refuse after its issue opened leaves that issue open with no rule, which a person closes.

## The intro, for fun

Which comes first, the rule or the ticket that says the rule needs a test?

## The punchline, for fun

The ticket, so the rule never points at a number that does not exist yet.

## The options, in plain words

A. Open the issues first from a first pass, then write the rules pending them in a second pass (built).
B. Write the rules with a placeholder number, then replace it once each issue is open.
C. Write the rules first as untested, and point them at their issues in a later pull request.

## What I had to decide

How the harvest learns each law issue's number before it writes 'pending' with that number, while staying a pure function that returns edits as data.

## What I did meanwhile

finishHarvest returns the law issues to open and writes no entry for them; the caller opens them and calls it again with their numbers, and the same entries, with the same ids, are written pending those issues. A 'no' is written as a 'not worth a law' note in the ledger, even when nothing else became knowledge, with who decided and Jev's score when Jev decided.

## What it costs to change later

A small change in two functions and the command that calls them: the second call could become one call with a placeholder, or the issues could open after the knowledge is written.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the harvest opens the law issue and writes pending #<issue>, not how it learns the number before writing it.
- (author) The spec's note reads 'not worth a law (<decided by> <score>)'; the classifier has no score, so its note reads 'not worth a law (classifier)'.
