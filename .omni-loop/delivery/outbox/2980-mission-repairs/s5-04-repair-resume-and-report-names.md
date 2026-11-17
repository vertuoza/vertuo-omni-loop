---
id: s5-04-repair-resume-and-report-names
prd: 2980
slice: s5
rank: medium
bears-on: none
raised: 2026-11-17
wave: 3
---

## The question, in plain words

After a person resumes a mission, what happens to work its repair stopped for a person or for an Omni Loop bug, and which names does the public bug report hide?

## The decision, in plain words

In the new round that work runs its step again, since the person has acted, and while a repair runs the mission's status line says so. The public report hides the owner and name of every repository of the workspace and every person named on the mission's history, on top of what the first scrub removes.

## The intro, for fun

A person said carry on, and the mission wondered how far back to rewind.

## The punchline, for fun

One step back, and the names stay home.

## The options, in plain words

A. The step again after a Resume, names from repositories and the mission's events, repairing shown in the status line.
B. A new repair after a Resume, and every workspace member's login read for the scrub.

## What I had to decide

Three choices of apps/omni-app/src/missions/. In a newer round, a PRD whose repair ended stopped (a person's question, an Omni Loop bug, a code cause with no fix) is sent its step again rather than a new repair. scrub()'s known list is the mission's repository, every repository of the workspace (owner and name) and the logins on the mission's events (store.names), not every member of the workspace, which the App's mission store does not read. A repairing PRD is named in the mission's waiting_on, as a provider-limit wait is, so a waits event may say a PRD is repairing.

## What I did meanwhile

Built as decided and tested on the fake fleet (repair.test.ts, store.repair.test.ts).

## What it costs to change later

Each is a line: send a repair instead of the step after a Resume, read the workspace's members' logins too, or leave repairing out of waiting_on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say what a Resume does to a PRD stopped by a person's question or an Omni Loop bug.
- (author) The slice's notes ask for the workspace's login names, and the mission store reads no member list.
