---
id: s3-02-codeowners-follows-the-amended-law
prd: 1890
slice: s3
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-14
wave: 2
---

## The question, in plain words

The amended install rule names one more test as its proof, so the list of files only the rule's owner may approve gained that test, a list outside this slice's ground. Is it fine that this slice updated it?

## The decision, in plain words

The slice regenerated the owners list with the kit's own command, which added the new proof test and changed nothing else, so the repository's checks stay green.

## The intro, for fun

A new test joined the club, and someone had to update the guest list.

## The punchline, for fun

The bouncer only added one name, and spelled it right.

## The options, in plain words

A. A. Keep the owners list regenerated in this slice, so the checks stay green (built)
B. B. Drop the line here and let the wave regenerate the list after merging

## What I had to decide

Keep the regenerated owners list in this slice (A), or leave it to the wave to regenerate after merging (B).

## What I did meanwhile

Ran omni kb owners: .github/CODEOWNERS gained the line /kit/lib/agents/write.test.ts @pierrederval inside its generated block; no line outside the markers changed. Without it, omni check knowledge is red.

## What it costs to change later

One generated line; reverting it is one commit, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no slice for the owners list; whether the wave would rather regenerate it once after merging (author).
