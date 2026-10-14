---
id: s5-02-circuit-names-its-board
prd: 1923
slice: s5
rank: medium
bears-on: none
raised: 2026-10-14
wave: 3
---

## The question, in plain words

The registry of circuits and the registry of games each name OMNI KART's two time tables, but COMET RING's circuit id is not its table's id. How should the circuit say which table its times go to?

## The decision, in plain words

Each circuit now carries the name of its table beside its own id, so COMET RING keeps its id and sends its times to the existing table, and FROST EIGHT sends its times to the new one.

## The intro, for fun

Two lists, one race track, and a name tag that did not match.

## The punchline, for fun

So each circuit now wears its table's name badge.

## The options, in plain words

A. A. A circuit keeps its id and carries its table's id in a field of its own (built).
B. B. The circuit ids become the table ids (kart, kart-frost-eight), which changes what slice s4 stores and sends.

## What I had to decide

Confirm that a circuit keeps its own id and carries its table's id as a separate field, or ask for the circuit ids to become the table ids.

## What I did meanwhile

The register holds both circuits with a `board` field; the test holds them equal to the registry's two tables by table and name, in order.

## What it costs to change later

Changing it later is a rename of one field and the stored `track` option values, which are small text values.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The slice's done-when says to compare the register to the registry by id and name; COMET RING's id (comet-ring, set by slice s4 and already stored in options and sent in MULTI's start) differs from its table id (kart), so the comparison is by table id and name. (author)
