---
id: s1-01-region-full-name
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When the game names the repository where a slice was built, should it write the owner and the name, or only the name?

## The decision, in plain words

It writes both, the owner and the name, so two repositories with the same name under different owners never mix.

## The intro, for fun

Two repositories walk into a ledger with the same first name.

## The punchline, for fun

Surnames were handed out at the door.

## The options, in plain words

A. Owner and name, the option built: never ambiguous across owners.
B. The bare name only, as before: shorter ids and labels, ambiguous if two owners hold the same repository name.

## What I had to decide

Whether a region in an event id and in the region column is owner/name or the bare name. The spec writes it as the region repo without saying which.

## What I did meanwhile

Full owner/name everywhere: ids read zone:vertuoza/vertuo-ai-domain:vertuoza/vertuo-omni-loop#12:s1:secured. Sectors still match a bare name, so the existing sector rows keep working.

## What it costs to change later

Nothing is written until the rollout's first run. After it, the ids are permanent: changing to bare names then would mean a second id per zone for the same fact, so the choice should be settled before the game is switched back on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the arcade's labels read well with the owner in front of every region name (s4 draws them)
