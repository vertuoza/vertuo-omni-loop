---
id: s17-01-cli-gh-replies-parsed-by-name
prd: 725
slice: s17
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The command line reads what GitHub's tool prints. Should a reply of the wrong shape now stop with a message naming the wrong field, rather than going on with a blank value?

## The decision, in plain words

Every GitHub reply the command line reads now goes through a check first. A well-formed reply works exactly as before; a malformed one stops at once and names the field that is wrong.

## The intro, for fun

GitHub's replies used to walk straight in; now there is a doorman with a clipboard.

## The punchline, for fun

Regulars get waved through; only the oddly dressed get asked their name.

## The options, in plain words

A. A: parse every gh reply the CLI reads through a schema, failing by field name on a malformed one
B. B: keep the schemas but fall back to the old reading when a reply does not parse
C. C: leave the gh reads unparsed, as typed values only

## What I had to decide

Whether the CLI's reads of `gh` JSON (issue comments, a pull request, `gh pr list`, `gh pr view --json commits`, the GraphQL answers of `omni care`) are parsed through Zod schemas, which turns a malformed reply from a later undefined into an immediate error naming the field.

## What I did meanwhile

kit/bin/schema.ts holds looseObject schemas for each of those replies; kit/bin/github.ts, commands/board.ts and commands/care.ts parse through them. The ask server's replies (business, decide, dossier, ask) keep the hand checks they had, read field by field with the ask module's own field() helper, as s16-01 settled for hand checks. The release script and the build parse package.json through a small schema of their own.

## What it costs to change later

Dropping a schema is one line per call site; the schemas keep every field GitHub sends, so no well-formed reply changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec forbids output changes; a reply GitHub never sends malformed now fails differently than before, and no test can show which old failure a real malformed reply produced
