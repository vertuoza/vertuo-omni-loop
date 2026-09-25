---
id: s5-01-where-this-repository-asks
prd: 71
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

This repository must name the address of the page its questions go to, but that address is written nowhere here and could not be checked from this computer. Which address should it name?

## The decision, in plain words

It names the address the hosting service gives the page's project by default. A person checks it once against the real address, and corrects it if the page lives elsewhere.

## The intro, for fun

A letter needs an address, and this envelope was sealed before anyone read the doorplate.

## The punchline, for fun

So it goes to the likeliest door, with a note to check the number.

## The options, in plain words

A. Name the address the hosting service gives the project by default, and have a person check it, the option built.
B. Leave the address empty, so ask mode stays off in this repository until a person fills it in.
C. Name a custom address under the company's own domain, chosen now.

## What I had to decide

The spec: "this repository sets `ask.url` to the galaxy's production URL". No file in the repository names that URL: `apps/galaxy/vercel.json` gives only the region, and the deploy steps in `apps/galaxy/README.md` write it as `https://<production host>`. The deployed app could not be reached from this container either (the egress proxy refuses `*.vercel.app`).

## What I did meanwhile

`.omni-loop/config.yml` sets `ask.url: https://vertuo-omni-loop-galaxy.vercel.app`, the default production domain Vercel gives the project `vertuo-omni-loop-galaxy` (the name the Vercel bot's comments on this PRD's sub-PRs give it, in team `vertuoza-a88dca1a`), with a comment saying so. Nothing in the kit depends on the value. A sign-in is kept under the host of `ask.url`, so after a correction each person runs `omni signin` once more.

## What it costs to change later

One line of `.omni-loop/config.yml`. A sign-in kept under a wrong host is simply never read again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The galaxy project's real production domain: Vercel gives `<project>.vercel.app` only when it is free, else a suffixed one, and a custom domain may be attached.
- (author) Whether the production Supabase redirect allow-list and the Google sign-in already accept this host for `/ask/signin` and `/ask/<id>/callback`.
