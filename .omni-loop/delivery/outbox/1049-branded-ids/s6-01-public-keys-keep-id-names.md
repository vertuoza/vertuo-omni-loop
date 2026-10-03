---
id: s6-01-public-keys-keep-id-names
prd: 1049
slice: s6
rank: high
bears-on: ADR-0056
raised: 2026-10-03
wave: 5
---

## The question, in plain words

Two settings people already write in their own setup files use an identifier's name for something else: one called slice holds a pattern for branch names, one called prd holds a label's name. The new check refuses plain identifiers, so should those settings be renamed?

## The decision, in plain words

The settings keep their names, so no installed setup breaks, and inside the tool their values are described as a branch pattern and a label name. The slice line agents write when they ask for a second opinion on a risky decision keeps its name the same way.

## The intro, for fun

Two settings answer to an identifier's name and have never been one.

## The punchline, for fun

They keep their names; the paperwork now says what they really are.

## The options, in plain words

A. A. Keep the settings' names and describe their values as what they hold (built).
B. B. Rename both settings after what they hold, and move every installed setup file over to the new names.
C. C. Give branch patterns and label names checked types of their own.

## What I had to decide

How the ID guard treats `branches.slice` (a branch template) and `labels.prd` (a label name), public keys of users' `.omni-loop/config.yml`, and the `slice` key of the `omni decide outbox-risk` state file (which holds `s3: its title`), given the guard has no allowlist and no comment escape.

## What I did meanwhile

The keys keep their names. kit/lib/config.ts reads them through named schemas, `branchTemplate` and `labelName`; every view of them (BoardConfig, the ask context and heartbeat branch templates, CreditLabels, the arcade's SyncConfig) is typed `Pick<Config['branches' | 'labels'], ...>` instead of a bare `string`, so the guard (which reads declared annotations and plain `z.string()` chains) sees nothing to refuse. The arcade's outbox-risk reader keeps the file's `slice` key through a named `SLICE_LABEL` schema and hands it on as `sliceLabel`. `number | null` and `string | undefined` forms count as bare.

## What it costs to change later

Renaming a config key later means a config migration (`kit:` version bump, the MIGRATIONS list in kit/lib/config.ts) and a note to every installed repository; renaming the state-file key means changing the do-work skill text and the arcade reader together. No stored data changes either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The guard does not follow a zod field built from a named schema, so a named bare schema for a real ID (`const n = z.number(); { prd: n }`) would pass it; review is what catches that, as ADR-0056 says.
