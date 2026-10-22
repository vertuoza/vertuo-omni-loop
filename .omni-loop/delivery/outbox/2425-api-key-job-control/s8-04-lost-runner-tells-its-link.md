---
id: s8-04-lost-runner-tells-its-link
prd: 2425
slice: s8
rank: medium
bears-on: none
raised: 2026-10-22
wave: 6
---

## The question, in plain words

When a runner registers again, the jobs it was holding end as lost. Should the apps that asked for those jobs be pinged, given that the spec says a change the database makes alone sends nothing?

## The decision, in plain words

Yes for those jobs, because the server's own code ends them and each pings its new status. No for the scheduled sweep in the database that ends a silent runner's jobs, as the spec says.

## The intro, for fun

A runner starts over, and the jobs it was holding are written off.

## The punchline, for fun

Only the endings the server writes itself get announced.

## The options, in plain words

A. Ping the jobs the server ends when a runner registers again, and none for the database's sweep.
B. Ping nothing for lost jobs at all, as for the sweep.
C. Ping both, by letting the database call out when its sweep ends a job.

## What I had to decide

The spec says a change the database makes alone, a stale claim its scheduled sweep ends, sends no ping. A runner registering again ends the jobs it held as lost from this server's own code, a change this process makes and stores, so each one pings `status`. Pinging the sweep's changes too would need a database trigger that calls out to an address an app named, which the spec rules out: polling, slowly, stays the truth.

## What I did meanwhile

Wired the ping into the registration's own rule and left the database's sweep alone, with a test for each: the registration pings the status of every job it ends, and the sweep's path pings nothing.

## What it costs to change later

Removing the registration's pings is one line and a test; adding the sweep's would mean a trigger in the database and a way for it to reach the network, which is a new design.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an app that waits on a ping would rather be told about every lost job, sweep included, even at the price of a database that calls out.
