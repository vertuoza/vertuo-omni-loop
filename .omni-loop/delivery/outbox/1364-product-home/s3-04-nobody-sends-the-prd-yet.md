---
id: s3-04-nobody-sends-the-prd-yet
prd: 1364
slice: s3
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

The server can now read a PRD's own product when a call names the PRD, but the app and the kit do not send the PRD number yet. Which slice teaches them to?

## The decision, in plain words

The server takes the PRD as an optional extra, so everything deployed keeps working and reads the repository's only product as before; no slice of the plan sends the number yet, so a follow-up change in the app and the kit does.

## The intro, for fun

The new door opens for anyone who says the password.

## The punchline, for fun

Nobody has been told the password yet.

## The options, in plain words

A. Land the server side now with the PRD optional, and send it from the app and the kit in a follow-up, the option built.
B. Add a slice to landing 2 that sends the PRD from the app's routes and the kit.

## What I had to decide

Whether the server change waits for the calls that send the PRD, or lands first with the PRD optional.

## What I did meanwhile

Landed first: the customer voice, the pitch, the constituents and an agent's link accept the PRD number, and without it read the repository's only product. Approvals already know their PRD and read its product now.

## What it costs to change later

One optional parameter per call in the app's routes and the kit's requests, in a later change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives the kit's calls that know their PRD to no slice of landing 2
- (author) until they send it, a PRD in a repository of two products reads no product's claims, personas and pitch from a terminal
