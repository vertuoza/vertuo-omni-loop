---
id: s1-01-draft-choice-guards
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec says a push numbers the draft this Claude session opened, or else the only unnumbered draft on the computer. That second rule can take a draft another brainstorm opened at the same time: should the push be stricter?

## The decision, in plain words

Yes, a little: a terminal that knows its Claude session never takes a draft another session opened, and once a PRD was numbered from this computer, a later push of it takes no other draft. Without a session id, the spec's rule stands as written.

## The intro, for fun

Two brainstorms shared one notebook of drafts, and a push came looking for its page.

## The punchline, for fun

It now reads the name on the page before tearing it out.

## The options, in plain words

A. Keep both guards: never another session's draft, and no other draft once the PRD was numbered here
B. Follow the spec to the letter: this session's draft, else the only unnumbered one, whoever opened it
C. Keep only the first guard, and still take the only unnumbered draft after the PRD was numbered here

## What I had to decide

Follow the spec's second rule to the letter, or keep a push from numbering a draft another brainstorm opened, which would merge that brainstorm into the wrong PRD.

## What I did meanwhile

A push takes this session's own draft first. From a terminal with a session id it never takes a draft another session opened, and after PRD n was numbered on this computer, later pushes of n reach its dossier by its key.

## What it costs to change later

One small function in the kit and its tests: dropping a guard is deleting two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a brainstorm ever runs across two Claude sessions (after clearing the conversation, say) is unknown; then the second session's push leaves the first session's draft unnumbered (author).
