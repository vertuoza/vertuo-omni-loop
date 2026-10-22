# Settled outbox items — bug 2398

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-never-rule-names-the-mutation-floor -->

## s1-01-never-rule-names-the-mutation-floor — agreed

- Verdict: agreed
- Approved by: pierrederval
- Approved at: 2026-10-22T12:32:48Z
- Channel: fix pull request #2399
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/2399#issuecomment-6340828583
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: playbook/briefing#never
- Raised: 2026-10-22
- Slice: s1
- Wave: 1
- Stays here: the answer keeps what the fix built; the briefing's never slot now names the mutation floor.

### The answer, as it was given

```text
1:A
```

### The item, as it was raised

```text
---
id: s1-01-never-rule-names-the-mutation-floor
prd: 2398
slice: s1
rank: high
bears-on: playbook/briefing#never
raised: 2026-10-22
wave: 1
---

## The question, in plain words

One of the rules every agent reads said never to lower a coverage floor, but the project keeps no coverage floor: the floors it keeps are mutation floors. The rule now names the mutation floor. Is that the rule you want?

## The decision, in plain words

The rule keeps its meaning and names the floor that exists. The other entry file no longer repeats the list, and points to the one list instead.

## The intro, for fun

A rule was guarding an empty room.

## The punchline, for fun

It now stands at the door that has something behind it.

## The options, in plain words

A. Name the mutation floor in the rule, and keep the list in one place (built).
B. Keep the old wording, and only stop the second file repeating the list.

## What I had to decide

The briefing's Never rule about floors, in its never slot: "coverage floor" becomes "mutation floor (`mutation/floor.json`)".

## What I did meanwhile

The branch holds the new wording, AGENTS.md's Never section pointing to the briefing, and the test that guards both.

## What it costs to change later

One line of the briefing and a few lines of AGENTS.md, reverted with this pull request.

## What I could not know

- Whether a coverage floor was once meant to be added; nothing in the repository sets one. (author)
```

<!-- /omni-outbox-settled: s1-01-never-rule-names-the-mutation-floor -->
