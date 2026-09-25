---
id: s3-03-signout-forgets-on-this-computer
prd: 71
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

When a person signs the terminal out, should the sign-in also be ended on the server, or only forgotten on this computer?

## The decision, in plain words

Signing out forgets the sign-in on this computer only. The server is not told, so a copy taken before the sign-out would keep working until it runs out on its own.

## The intro, for fun

Throwing the key away takes a second, but the lock never hears about it.

## The punchline, for fun

For the lock to hear, the list of calls would need one more line.

## The options, in plain words

A. Forget the sign-in on this computer only, the option built.
B. Also end the sign-in on the server, through a new call added to the list of calls the page serves.
C. Also end it on the server, with the terminal asking the sign-in service directly.

## What I had to decide

The spec: "`signout` deletes them" (the tokens), and the contract under `/api/ask/*` has no call that ends a sign-in on the server. Ending it there would need either a new contract call, which this slice may not add on its own (the plan: a slice that needs to change the contract raises an item), or the kit calling Supabase Auth's logout directly, which would tie the kit to Supabase instead of to the contract.

## What I did meanwhile

`omni signout` removes the host's entry from `~/.config/omni/credentials.json` (the file goes with its last host, and stays at mode 0600 otherwise) and prints `signed out of <host>`, or `signed out` when there was nothing to forget; exit 0. `omni whoami` prints the email kept for the host of `ask.url`, or `signed out`, exit 0 both ways, from the file alone, with no call. With `ask.url` null, all three commands exit 1 with `ask mode is not set up for this repository (ask.url)`.

## What it costs to change later

Adding a server-side sign-out later is one new contract call, one route and a few lines in the command; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how long a refresh token lives under the production Auth settings, which bounds how long a copied one keeps working; they could not be read from here
