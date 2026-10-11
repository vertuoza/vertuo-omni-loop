---
id: s2-02-token-from-environment
prd: 1628
slice: s2
rank: high
bears-on: ADR-0057
raised: 2026-10-11
wave: 1
---

## The question, in plain words

How does every terminal command learn that a cloud token is set, when most commands were never handed the environment's settings?

## The decision, in plain words

The shared sign-in store reads the token from the environment itself, through the one module allowed to, whenever a command does not hand it a test folder. Commands did not have to change one by one.

## The intro, for fun

Twenty commands, one front door, and nobody wanted to rewire twenty doorbells.

## The punchline, for fun

So the front door learned to check the doormat for a key.

## The options, in plain words

A. The store reads the token from the environment when no folder is given, the option built.
B. Every command passes the token it was handed down to the store, touching each command.
C. The program's entry point hands every command a ready-made store, so commands never build one.

## What I had to decide

Whether homeTokens (and so signedInClient and every command that falls back to it) reads OMNI_TOKEN from the process environment through kit/lib/env/read.ts when no home is given, rather than every command passing the OMNI_TOKEN group from main()'s vars down to it, which would change some fifteen command files outside this slice's territory.

## What I did meanwhile

processOmniToken() in kit/lib/env/read.ts is the default when both home and omniToken are left out; a test hands its own home (no token) or an explicit omniToken, and never writes process.env. signin, whoami, signout and the status line read vars.omniToken as main() hands it.

## What it costs to change later

Threading vars through each command later is mechanical: one argument per call site, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the default path (no home, no omniToken) is covered by reasoning, not by a test, since a test may not write process.env (author)
