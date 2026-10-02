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

<!-- omni-outbox-settled: s3-01-close-without-a-keyboard -->

## s3-01-close-without-a-keyboard — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-close-without-a-keyboard
prd: 932
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 2
---

## The question, in plain words

On a phone there is no Esc key. How should someone close the app picker without picking an app?

## The decision, in plain words

A tap on the dark space around the picker closes it, the way most pop-ups work. There is no separate close button, so the keys line and the three things you can move between stay as the spec drew them.

## The intro, for fun

Every arcade has a coin slot. Few of them come with a way out.

## The punchline, for fun

Tap the dark space and the arcade lets you walk away.

## The options, in plain words

A. A tap on the backdrop closes the picker, with no close button (built).
B. Add a visible close button in a corner, which Tab also reaches.
C. Both: a close button and a tap on the backdrop.

## What I had to decide

Whether closing the picker without a keyboard needs its own visible button, or whether a tap outside is enough.

## What I did meanwhile

A tap or click on the backdrop around the picker closes it, the same as Esc. Taps on the pedestals, the toggle or the space between them never close it.

## What it costs to change later

Adding a close button later is a small change to the picker and its styles, with one more stop when you move through it with Tab.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names Esc as the only way to close and says nothing about touch screens (author).

```

<!-- /omni-outbox-settled: s3-01-close-without-a-keyboard -->

<!-- omni-outbox-settled: s4-01-hint-under-both-buttons -->

## s4-01-hint-under-both-buttons — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-hint-under-both-buttons
prd: 932
slice: s4
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The home page has two sign up buttons, one at the top and one in the join form further down. Which of them should show the small line saying where a remembered choice opens?

## The decision, in plain words

Both buttons show the line, with its change link, since both buttons skip the picker once a choice is remembered.

## The intro, for fun

Two sign up buttons, one remembered choice, and a small line that wants to be everywhere.

## The punchline, for fun

If both doors skip the picker, both doors should say where they lead.

## The options, in plain words

A. Show the line under both sign up buttons (built).
B. Show it under the top button only.
C. Show it under the join form button only.

## What I had to decide

Whether the line under the button belongs under the top button only, or under every sign up button on the page.

## What I did meanwhile

Once a choice is remembered, both sign up buttons show the same line and change link, and change under either one opens the picker.

## What it costs to change later

Showing it under one button only is a small change to where the page places the line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec speaks of the button as if there were one, and the page has two.

```

<!-- /omni-outbox-settled: s4-01-hint-under-both-buttons -->
