---
id: s3-02-slice-named-fields-hold-no-slice-id
prd: 1049
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

Two pieces of information in the arcade are named after a slice but are not a slice's short code: one is the pattern of a slice's branch name, the other a slice's code followed by its title. What should become of them?

## The decision, in plain words

Both stay plain text with their names, since neither holds a slice's code alone. The check the last step of this work adds will notice them, and that step decides whether to rename them.

## The intro, for fun

Two fields answer to the name slice and neither is one.

## The punchline, for fun

They keep their name tags until the bouncer arrives in the last step.

## The options, in plain words

A. Leave both as plain text for s6's guard to settle (built).
B. Rename them now in the arcade after what they hold (a branch pattern, a slice label), leaving the kit's own names to its own step.

## What I had to decide

s6's guard refuses a property named `slice` declared as a bare `string`. In apps/galaxy two such fields hold no `SliceId`: `SyncConfig.branches.slice` (src/stages/sync/core.ts), the `branches.slice` branch shape read from a repository's config, and the `slice` field of Jev's outbox-risk state (src/jev/decisions/outbox-risk.ts), which the decide command writes as `"s3: its title"`. Branch names are out of the PRD's scope, and the state file's shape is the kit's.

## What I did meanwhile

Both left as strings, unchanged. A third false match, `pr` in the business rival suggestions (the product's id), was renamed `product` inside its module, since nothing outside it reads that name.

## What it costs to change later

A rename inside apps/galaxy (and, for the state file, the kit's decide command and its readers): no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s6's guard should exempt a branch shape (the kit's own config schema names `branches.slice` too), or s5/s6 rename the fields (author).
