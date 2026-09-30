---
id: s1-02-recheck-runs-as-the-service
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The weekly recheck runs with nobody signed in. May it start a draft and propose claims on its own, while every button a person presses stays for members only?

## The decision, in plain words

Yes: the recheck may start, update and finish a draft and propose drafted claims. Confirming, rejecting and web pages stay for members.

## The intro, for fun

Sunday night, nobody is signed in, and the recheck still has work to do.

## The punchline, for fun

It may suggest; only a member may say yes.

## The options, in plain words

A. The recheck writes as the server's key, for drafts and proposals only
B. The recheck writes as a stored member of each workspace
C. The recheck only reads; proposals wait for a member to open the page

## What I had to decide

Whether the unattended recheck should be allowed to write proposed claims and draft rows, and nothing else.

## What I did meanwhile

The four draft functions accept the server's own key as well as a member; every other function refuses it.

## What it costs to change later

Taking the permission back is one grant line in a follow-up migration; s4's recheck would then need another way in.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the recheck runs as galaxy with a secret, not which database identity it writes as (author).
