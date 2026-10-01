---
id: s3-03-fleet-schema-in-the-kit
prd: 725
slice: s3
rank: high
bears-on: ADR-0002
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The plan asks for the shape of a team to live with the tool's shared shapes, but an earlier rule says the tool never knows about the game. Which wins?

## The decision, in plain words

The team's shape now lives with the tool's shared shapes, as the plan asks, and the game reads it from there. The tool itself still never uses it.

## The intro, for fun

The plan asked the toolbox to hold the game's team jerseys.

## The punchline, for fun

The toolbox agreed, on condition it never has to wear them.

## The options, in plain words

A. The team's shape lives with the tool's shared shapes, as the plan asks, and the tool never uses it
B. Keep the team's shape with the game, and leave it out of the tool's shared types, as the earlier rule reads
C. Amend the earlier rule to say the tool may describe a game shape but never read the game's data

## What I had to decide

The spec's s3 asks kit/lib/types.ts to export Fleet, and every shape read from outside to be a schema in kit/lib/schema/. A fleet is a row of the game's public.teams. ADR-0002 says the kit never names the game and reads none of its tables.

## What I did meanwhile

Wrote kit/lib/schema/fleet.ts (the sector, fleet, roster and repository rows game/config.ts parsed) and kit/lib/schema/dossier.ts (the dossier rows game/dossiers/store.ts parsed); game/ now imports them from the kit, and kit/lib/types.ts exports Fleet, FleetRow, Dossier and DossierRow. No kit code reads them: the kit still reads none of the game's tables.

## What it costs to change later

Cheap: move kit/lib/schema/fleet.ts back under game/ and drop Fleet from kit/lib/types.ts; two imports change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the PRD's author meant to amend ADR-0002 by listing Fleet among the kit's types (author)
