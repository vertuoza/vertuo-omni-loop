---
id: s14-01-malformed-answers-now-fail-by-name
prd: 725
slice: s14
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When GitHub or the database answers the credits report or the personas import in a shape it should never have, should the tool stop and say which part was wrong, or carry on as it used to?

## The decision, in plain words

It stops and names the part that was wrong. A well-formed answer, which is every answer seen so far, gives exactly the same result as before.

## The intro, for fun

GitHub once answered with a pull request that had no number. Nobody believes it either.

## The punchline, for fun

Now the tool says so out loud, instead of tripping three steps later.

## The options, in plain words

A. A malformed answer stops the run with an error naming the field; well-formed answers behave exactly as before
B. Keep passing malformed answers through as before, and parse only for the types
C. Stop on malformed answers, but turn the error into the command's usual one-line refusal

## What I had to decide

PRD 725 asks every value read from a process or the network to pass a schema, failing with an error naming its field. In omni credits the rows of gh search and gh pr view were read field by field with fallbacks; a row with no number or repository was passed through and could crash later in the classifier. In scripts/personas-import.ts the Supabase rows were trusted as they came, and a refusal body that was not an object would have thrown a TypeError while reading its fields.

## What I did meanwhile

kit/lib/credits/schema.ts parses each gh row before use: a row's number and repository (a commit's sha and repository) are required, every other field may be missing and keeps its old fallback. scripts/personas-import.ts parses the workspace, product and persona rows Supabase answers, and reads a refusal's code, message and hint through a loose schema, so a body that is not an object reads as empty instead of throwing. Each failure names its path, e.g. 'gh search prs printed an unexpected shape: 0.labels.0.name: Required'.

## What it costs to change later

Cheap: loosen a field in the folder's schema file to nullish, or drop the parse; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether gh ever prints a search row without its repository; its JSON output always has so far (author)
- Whether a refusal from PostgREST ever carries a body that is not an object (author)
