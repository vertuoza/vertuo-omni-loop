---
id: s3-02-service-address-belongs-to-the-service-key
prd: 1059
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The arcade's own database address for its back-office access is only useful with the back-office key. If someone sets the address without the key, should the arcade refuse to start, or ignore the address?

## The decision, in plain words

The address and the key are one group: the address alone is a half-filled setting, and the arcade refuses to start, naming the missing key. With neither, the back-office access is off, as before.

## The intro, for fun

An address with no key to the door is a postcard, not a visit.

## The punchline, for fun

Better to be told at the gate than to knock all night.

## The options, in plain words

A. The address alone is half set: the arcade refuses to start and names the missing key.
B. The address is optional on its own: set without the key, it is ignored and nothing stops.

## What I had to decide

Whether SUPABASE_URL belongs to the service role's group (set alone, it is half set) or stands as an optional value of its own.

## What I did meanwhile

apps/galaxy/src/env.ts groups SUPABASE_SERVICE_ROLE_KEY with an optional SUPABASE_URL: the key alone is fine (the season cache falls back on the public address), the address alone is refused at startup. pnpm releases:sync still needs both.

## What it costs to change later

Answering B moves SUPABASE_URL into a group of its own in src/env.ts and changes one test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the Supabase pair as a half-set example but does not say whether the service role's own address counts as part of it.
- (author) Whether any deployment sets SUPABASE_URL without the service key today is not known from the repository: the settings are checked before merging, as the spec's risks ask.
