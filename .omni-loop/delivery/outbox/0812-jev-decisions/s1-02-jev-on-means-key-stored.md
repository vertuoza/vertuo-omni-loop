---
id: s1-02-jev-on-means-key-stored
prd: 812
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Is switching Jev on a setting of its own, or does it just mean a key is saved?

## The decision, in plain words

Jev is on exactly when a key is saved: switching it off removes the key and turns every decision off, and no decision can leave Off without a key. Members see only whether it is on, not the last four characters of the key.

## The intro, for fun

One switch, one key, one less thing to keep in sync.

## The punchline, for fun

No key, no Jev: the switch cannot lie about it.

## The options, in plain words

A. Jev is on exactly when a key is stored, and a decision needs a key to leave Off.
B. Store a separate on/off flag, so the owner can pause Jev without removing the key.

## What I had to decide

Whether the page's Jev switch is its own stored flag or simply shows whether a key is stored, and whether a decision may be Shadow or On with no key.

## What I did meanwhile

No separate flag is stored: the switch reads the key's presence, and set_jev_decision refuses a mode other than Off without a key. The key's last four and its date are shown to the owner only.

## What it costs to change later

A separate on/off flag later is one column and a change to two database functions, in a new migration; nothing stored today would need moving.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec says members never see the key; showing them its last four was not asked either way (author)
