# Settled outbox items — PRD 1233

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s2-01-e2e-test-id-match -->

## s2-01-e2e-test-id-match — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-08
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-08
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-e2e-test-id-match
prd: 1233
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

How should a recorded step be tied back to the test it belongs to, when the recording format does not say how tests are named?

## The decision, in plain words

A test is a file under the e2e folder that carries the PRD's tag, named by its path there; a recording belongs to it when its test name is that path, or that path followed by a colon, arrow or hash and a title.

## The intro, for fun

Matching a recording to its test is a bit like matching socks without a drawer.

## The punchline, for fun

For now the file path is the pair tag.

## The options, in plain words

A. A. Match by file path, with an optional title after a separator (built).
B. B. Parse each test call and match by its title.

## What I had to decide

The recording schema and the tag syntax are not fixed by the spec; a different rule is one function and its tests.

## What I did meanwhile

status reads every .ts, .js and .mjs file under the e2e folder for the tag prd-<n> as a whole word and matches by path.

## What it costs to change later

A test file holding several tests counts as one test; a framework that names tests otherwise needs the rule changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the exact shape of a trace-1 file was taken from the spec's field names, not from a real recording

```

<!-- /omni-outbox-settled: s2-01-e2e-test-id-match -->
