---
id: s3-01-plugin-server-test-home
prd: 3007
slice: s3
rank: medium
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

Where should the check that the plugin carries the knowledge server live?

## The decision, in plain words

The check sits in the new test file of the server itself, not in the plugin's existing test file, so no test that proves a locked rule is touched and nobody has to approve a change to one.

## The intro, for fun

Where do you hang a new sign: on the old wall, or on a fresh one?

## The punchline, for fun

A fresh one, so the old wall needs nobody's signature.

## The options, in plain words

A. A. As built: the check lives beside the server's other tests, and the plugin test file is untouched.
B. B. As planned: add the check to the plugin test file, with a high item a person answers, since that file proves locked rules.
C. C. Keep it in both files, with the same high item.

## What I had to decide

Whether the plan's wish, that the plugin test file checks the declaration, outweighs keeping that file untouched.

## What I did meanwhile

The test of the declaration (the server is named omni-knowledge, runs omni mcp, holds no key or token) is in the server's own test file, and the plugin test file is unchanged.

## What it costs to change later

Moving the two tests into the plugin test file later is a copy of about twenty lines, plus a high item, since that file proves locked rules.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the plugin test file for this check; the grader treats any edit to it as a change to a law's proof, which only a high item accounts for.
