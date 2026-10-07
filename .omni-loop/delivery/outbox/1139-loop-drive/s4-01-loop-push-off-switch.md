---
id: s4-01-loop-push-off-switch
prd: 1139
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 3
---

## The question, in plain words

When should sending the loop's state to the Loop page count as switched off?

## The decision, in plain words

It is off only when the repository names no Omni page. It does not follow the dossier switch, so a repository can watch its loops without sending its PRD documents.

## The intro, for fun

Every switch in the house was labelled, except the one for the loop.

## The punchline, for fun

So it follows the main breaker: no Omni page, no light.

## The options, in plain words

A. A. Off only when no Omni page is configured (built).
B. B. Follow the dossier switch as well.
C. C. Add a loop switch of its own to the config, off by default.

## What I had to decide

What `off` means for `omni loop push`: the spec lists `off` among its one-line failures but names no switch. `omni dossier` is off when `dossier.enabled` is false or `ask.url` is unset.

## What I did meanwhile

`omni loop push` prints `off` and exits 1 only when `ask.url` is not set; it does not read `dossier.enabled`, and no new config key was added. A start that fails keeps no loop, so the ticks that follow print `no loop (omni loop push start)` and the loop's actions still run.

## What it costs to change later

A constant: reading `dossier.enabled` too, or a new `loop.enabled` key, is a few lines in the command and the config schema.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec, the plan and the API settle the rest.
