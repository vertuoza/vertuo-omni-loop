---
id: s4-03-engine-zone-browser-packages
prd: 1108
slice: s4
rank: high
bears-on: ADR-0058
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The new animation code runs in a browser. Which outside libraries may it use besides React?

## The decision, in plain words

Besides the kit's shared code, it may use React and the checking library the kit already uses for every input, and nothing written for servers. Its tests are free of that limit.

## The intro, for fun

A browser is a small kitchen: not every appliance fits.

## The punchline, for fun

React and the input checker got a counter; the server tools stay in the garage.

## The options, in plain words

A. A. React, React DOM and the kit's checking library, nothing written for servers (built).
B. B. React and React DOM only, the page trusting its input unchecked.
C. C. Any library at all, like the other parts of the repository.

## What I had to decide

Whether the animation code may also use the kit's checking library, or React alone as first said, which would leave the page unable to check what it is given.

## What I did meanwhile

The import check refuses any other library and anything written for servers in the animation code, naming the line; the page checks its input with the same rules the kit uses everywhere.

## What it costs to change later

A name in one list of the import check and a line of the decision record; dropping the checking library would also mean checking the input elsewhere.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The slice's brief says React and the kit's shared code only; the checking library is one the kit's shared code already uses, so the page carries it either way.
