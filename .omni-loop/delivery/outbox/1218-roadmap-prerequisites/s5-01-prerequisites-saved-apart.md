---
id: s5-01-prerequisites-saved-apart
prd: 1218
slice: s5
rank: high
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

When a roadmap is sent to the app, should its prerequisites be saved in a separate step, and should a roadmap sent without any prerequisites keep the ones saved before?

## The decision, in plain words

Prerequisites are saved in their own step right after the roadmap. A roadmap sent without prerequisites keeps the ones saved before, so a roadmap whose prerequisites section is deleted still shows the old list until a later send carries an empty one.

## The intro, for fun

Two pieces of news arrive by the same post, but in two envelopes.

## The punchline, for fun

The second envelope only gets opened when it is actually in the box.

## The options, in plain words

A. Save the prerequisites in a second step after the roadmap; a push without them keeps the saved ones (built).
B. Same second step, but a push without prerequisites clears the saved ones.
C. Fold the prerequisites into the roadmap's own save function, redefined on top of the human-work change already on main.

## What I had to decide

Whether a roadmap sent without prerequisites should keep or clear the prerequisites saved before.

## What I did meanwhile

Roadmaps sent by an older kit, or without the section, store exactly as they did; a removed section leaves its old rows on the page.

## What it costs to change later

Option B is a one-line change in the app's save step; option C rewrites the roadmap's save function in a new migration on top of the human-work change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The kit (s3) leaves the prerequisites out of a push when the roadmap has no section, so the app cannot tell a deleted section from an older kit. (author)
- The two save steps are not one transaction: if the second fails the roadmap is saved and the push answers an error; the next push repairs it. (author)
