---
id: s1-03-released-label-not-created-by-init
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

Should setting up the kit in a repository create the new released label, as it creates the other loop labels?

## The decision, in plain words

The kit names the released label in its settings but does not create it when a repository is set up, so a person creates it in each repository a runner works in, as the spec's risks say.

## The intro, for fun

A brand new label, and nobody has hung it on the wall yet.

## The punchline, for fun

Until someone does, a dead claim waits its 240 minutes like before.

## The options, in plain words

A. A. A person creates the label in each repository a runner works in; setup stays as it is.
B. B. Setup creates the label with the other loop labels, in a follow-up change.

## What I had to decide

Leave it to a person (A), or have `omni init` and `omni update` create it with the others (B).

## What I did meanwhile

Where the label is missing, a runner cannot add it and a released claim falls back to the 240-minute quiet rule; nothing breaks.

## What it costs to change later

B is one row in the list of label styles used to set a repository up, and the label lists its tests pin, outside every slice of this PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any repository a runner works in turns label creation on: this one does not (author).
