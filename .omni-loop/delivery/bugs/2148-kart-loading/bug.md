# Bug 2148: OMNI KART takes too long to load

## Triage

- **Domain:** OMNI KART loading: the circuit bake (`apps/galaxy/src/arcade/kart/track.ts`, `parseTrack`), the track's texture and relief (`texture.ts` `paintTrack`, `relief.ts` `heightsOf`), run by `createKart` and its first draw (`art.ts`)
- **Risk:** high — every player who opens OMNI KART waits seconds on a frozen screen, the music stuttering, before the first race shows, longer on a slower machine; the game does load, with no way around the wait (Jev, 0.65)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/track.cost.test.ts`
- **Red:** AssertionError: 2254, 2262, 2283 ms: expected 2262.1795839999995 to be less than 1000

## Fix

LOADING… reads every circuit for the CIRCUIT step's cards, and a race's first frame paints its
ground and raises its relief. All three asked, for each pixel of the map, where it sits against the
centre line, and `locate` (`line.ts`) answered by measuring every piece of the line, a new object
each. Reading a circuit asked it up to three times per pixel: for its road, its gaps and its roof.

`locate` without a hint now measures only the pieces a point can be nearest to. The pieces are
listed once per square tile, the first time a point of that square is asked about, and a piece
that cannot come nearer than the nearest so far is skipped. It remembers the last point asked, so
the three questions about one pixel cost one search. `roadWithin` (`texture.ts`) and `floorOf`
(`track.ts`) stop building an array or measuring a disc that cannot hold the pixel.

Reading both circuits went from about 2.2 s to about 0.3 s on a laptop. Painting and raising a
circuit's ground on the first frame got about three times faster too. Every road, gap, roof, floor,
texture pixel and height is the same, bit for bit.

## Guard

The reproduction stays in the suite as a budget: every circuit read afresh three times, the middle
time under a second. It is red on the base's code (about 2.2 s) and green on the fix (about 0.3 s),
so a margin of more than twice either way. The first frame's paint and relief got only about three
times faster, too little for a timed budget that CI's slower machines would keep, so they have none.

A unit test in the same file pins what the speed rests on: on every circuit, at a point every third
of a tile from 3 tiles beyond the map on every side, and at points far off it, `locate` finds what
measuring every piece in order finds, to the last bit. Without the square's diagonal in the
shortlist, it fails on 133 points of COMET RING and 203 of FROST EIGHT.

## Mutation

mutation: no changed core file against origin/main (a533dac7): nothing to mutate
