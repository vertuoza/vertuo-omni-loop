---
id: s6-03-app-boundaries-own-shape
prd: 1030
slice: s6
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The App's database reads must be registered for the check that runs them against a real database, but the shape of that registration lives in the arcade, which the App may not import. Where does the App get it?

## The decision, in plain words

The App keeps its own small copy of the registration shape, and registers its three reads: the tracked repositories, and the business and product lines of this repository.

## The intro, for fun

The App wanted to join the database check without borrowing the arcade's form.

## The punchline, for fun

So it photocopied the form, which is allowed.

## The options, in plain words

A. A. A copy of the shape in the App, the reads asking about this repository: the option built.
B. B. Import the arcade's shape, against the plan's rule that the App imports nothing from the arcade.
C. C. Move the shape into a shared package both import, outside this slice's territory.

## What I had to decide

Whether the App's boundary files use a copy of the registration shape kept in the App, or import the arcade's, and which repository the business and product reads ask about.

## What I did meanwhile

A copy of the shape sits in the App, and the two business reads ask about this repository itself, whose business production holds; a database without it answers an empty business, which parses all the same.

## What it costs to change later

Two copies of a four-field shape to keep in step; a change to the check's shape is one more file to touch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The local database check could not be run here: no local database stack on this machine. It runs in the database workflow on the pull request.
- (author) The empty seed holds no repository, so the local run reads only the empty business.
