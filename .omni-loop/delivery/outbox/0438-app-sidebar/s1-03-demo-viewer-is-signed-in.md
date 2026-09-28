---
id: s1-03-demo-viewer-is-signed-in
prd: 438
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

On a local run with no database, should the app's sidebar and top bar act as if someone is signed in?

## The decision, in plain words

Yes: on a local run with no database, the app shows the demo player as signed in, with no workspace name, and For me counts the demo's one shared question.

## The intro, for fun

Nobody is really home in the demo, but the lights are on.

## The punchline, for fun

So the demo player gets to sit in the chair.

## The options, in plain words

A. Signed in as the demo player, the option built.
B. Signed out, so the demo shows Sign in with GitHub in the top bar.

## What I had to decide

What the viewer read returns in the demo mode (no Supabase, not production).

## What I did meanwhile

viewerLive() returns signedIn true, name DAM-DEV, login dam-dev, no avatar, no workspace name, and forMe from the demo's For me list; a closed deployment is signed out.

## What it costs to change later

One branch in viewerLive.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether anyone relies on the demo showing Sign in, not asked (author)
