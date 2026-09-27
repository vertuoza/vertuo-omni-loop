# Settled outbox items — PRD 215

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-literal-guard-lets-the-home-link-through -->

## s1-01-literal-guard-lets-the-home-link-through — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-09-27T07:52:05Z
- Channel: feature pull request #217
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: ADR-0047
- Raised: 2026-09-27
- Slice: s1
- Wave: 1
- Became: ADR-0047

### The answer, as it was given

```text
A. Let the home page link through the name check in the kit's default settings only, and keep refusing the company's name everywhere else. This is what was built.
```

### The item, as it was raised

```text
---
id: s1-01-literal-guard-lets-the-home-link-through
prd: 215
slice: s1
rank: high
bears-on: ADR-0047
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The kit has a second safety check that refuses the company's name anywhere in its code, and the new home page link holds that name. Should that check make room for this one link?

## The decision, in plain words

I let that one link through, only in the place where the kit keeps its default settings. The company's name anywhere else in the kit's code is still refused.

## The intro, for fun

Two guards at two doors, and one link wearing both of the names they were told to stop.

## The punchline, for fun

It now gets waved through at one door only, and only when it shows up whole.

## The options, in plain words

A. Let the home page link through the name check in the kit's default settings only, and keep refusing the company's name everywhere else. This is what was built.
B. Let the company's name through anywhere in the kit's default settings, the way that check already makes room for a few other words there.
C. Give the kit no home page link by default, and set the link only in this repository's own settings, so other repositories get no link until they add one.

## What I had to decide

The spec puts the arcade's address in `kit/lib/config.mjs` as `signature.home`'s default (AC 1, AC 7) and plans the game-words exemption for it (ADR-0047). It does not mention `kit/test/no-literals.test.mjs`, which also refuses `/vertuo/i` anywhere in `kit/lib`, so the preflight went red on `lib/config.mjs`. That guard is outside s1's territory. The question: whether, and how narrowly, it lets the address through.

## What I did meanwhile

Built A. `kit/test/no-literals.test.mjs` removes each whole-host occurrence of `vertuo-omni-loop-galaxy.vercel.app` from a line of `lib/config.mjs` before testing it, using the same host boundary as the game-words guard. Every other `/vertuo/i` hit still fails, in that file or any other. Fixture cases pin it, and the guard's comment cites ADR-0047.

## What it costs to change later

A constant: one regular expression and its fixture cases in one test file. Nothing stored and no behaviour of the kit changes. B is a one-line exemption in the same file. C moves one default in the kit and adds one line to this repository's config.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person, deciding that the kit may carry the address (ADR-0047), meant it to pass the repository-literal guard too, or only the game-words guard: the spec names only the latter (author).

```

<!-- /omni-outbox-settled: s1-01-literal-guard-lets-the-home-link-through -->
