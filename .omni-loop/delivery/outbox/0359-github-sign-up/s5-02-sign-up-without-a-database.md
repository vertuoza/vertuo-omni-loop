---
id: s5-02-sign-up-without-a-database
prd: 359
slice: s5
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

When the front page runs without its database, as in the demo, there is nobody to sign up with. What should the sign-up button do there?

## The decision, in plain words

It opens the game, just like the start button, instead of showing an error.

## The intro, for fun

A sign-up desk with no guest book behind it.

## The punchline, for fun

So the clerk just waves you through to the arcade.

## The options, in plain words

A. A: open the game at /play (built)
B. B: keep the button disabled on the demo
C. C: show a message that sign-up needs the real deployment

## What I had to decide

What SIGN UP WITH GITHUB does when the build has no Supabase configured.

## What I did meanwhile

signUp() in apps/galaxy/src/home/sign-up.ts goes to /play when the browser has no Supabase URL and key; with them, it starts the GitHub sign-in back to /auth/callback.

## What it costs to change later

A constant: one branch in signUp() and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec describes the button only on a deployment with Supabase
