# Settled outbox items — PRD 932

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-app-landing-without-outcome -->

## s1-01-app-landing-without-outcome — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-app-landing-without-outcome
prd: 932
slice: s1
rank: medium
bears-on: none
raised: 2026-10-02
wave: 1
---

## The question, in plain words

When someone picks the Omni app and signs in, should the board page get the same little 'you are signed in' note the Arcade gets on its return?

## The decision, in plain words

The Omni app opens on the plain board page, with no note added. The board does not read that note today, and the Arcade still gets it as before.

## The intro, for fun

Two doors, one sign-in: the Arcade gets a welcome note, the board gets a quiet entrance.

## The punchline, for fun

Nobody reads a welcome note on a page that never looks for one.

## The options, in plain words

A. A. Open the plain board page, with no sign-in note (built).
B. B. Pass the same sign-in note to the board, for it to show later.
C. C. Pass the note and have the board show a short welcome.

## What I had to decide

Whether the board should greet a fresh sign-in, the way the Arcade does.

## What I did meanwhile

A person who picks the Omni app lands on the board with nothing extra in the address.

## What it costs to change later

Adding the note later is a one-line change in the sign-in return, plus whatever the board would show for it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the board wants to show anything on a fresh sign-in is not covered by the spec (author).

```

<!-- /omni-outbox-settled: s1-01-app-landing-without-outcome -->
