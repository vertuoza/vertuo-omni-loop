# Settled outbox items — PRD 251

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-terminal-post-takes-objections -->

## s1-01-terminal-post-takes-objections — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-27
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-27
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-terminal-post-takes-objections
prd: 251
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

When someone answers in the terminal, may their reply also object to a decision that was already adopted?

## The decision, in plain words

Yes. The terminal only asks the blocking questions, but the reply it posts may also carry an objection to an adopted decision, exactly as a reply typed on the pull request can.

## The intro, for fun

The terminal asks only the urgent questions, but it still listens when you have more to say.

## The punchline, for fun

Nobody is asked about the settled ones, and nobody is stopped from reopening them.

## The options, in plain words

A. Accept an objection to an adopted decision in the terminal's reply, as the pull request does.
B. Refuse any number the terminal did not ask, so its reply answers only the blocking questions.

## What I had to decide

The spec says the terminal never asks the adopted, medium questions. It does not say whether the posting command must refuse an answer to one when the answers file carries it.

## What I did meanwhile

The posting command accepts every number the pull request comment lists that is still open or adopted, the same set the reply reader answers. The asking command still lists only the open human-action and high questions.

## What it costs to change later

One filter in the posting command: dropping the adopted questions from the set it accepts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person at the terminal would ever want to object there, rather than on the page or the pull request

```

<!-- /omni-outbox-settled: s1-01-terminal-post-takes-objections -->
