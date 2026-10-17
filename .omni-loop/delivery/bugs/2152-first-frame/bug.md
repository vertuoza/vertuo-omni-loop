# Bug 2152: OMNI KART: the race freezes on its first frame while the ground is painted and raised

## Triage

- **Domain:** OMNI KART's race start: a circuit's ground (`texture.ts` `paintTrack`, `relief.ts` `heightsOf`, `mode7.ts` `roofedOf` and the tunnel's vault), built by the race's first draw (`art.ts` `createKart`), right after LOADING… (`scenes/kart.ts` `loadKart`)
- **Risk:** high — every player who opens OMNI KART sees the screen freeze for one to one and a half seconds right after LOADING…, and again the first time they switch circuit, the music stuttering, and every race start hitches for a tenth of a second; the race then plays, and nothing gets a player round the wait (Jev, 0.92)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/art.first.test.ts`
- **Red:** AssertionError: first race: the first frame in 962 ms, the frames after it in 8 ms: expected 114.64926106965727 to be less than or equal to 3

## Fix

A race painted its circuit's ground, raised its relief and read its tunnel's vault on its first frame:
about a second on COMET RING and a second and a half on FROST EIGHT on a laptop, the screen frozen.
The tunnel's mask was also read again for each race, and the vault with it, so every later race
started on a frame of a tenth of a second.

The ground is now built before the race is shown: while LOADING… is up, while the CIRCUIT step
still shows the circuit before, and while the grid still shows for a MULTI race. It is built a row
of pixels at a time, the page drawing every 8 ms (`slices.ts`). The mask is kept per circuit, so a
later race on it has nothing left to build. Building takes as long as before, the longest stretch
holds the page about 9 ms, and every texture pixel, height, mask and rendered frame is the same,
bit for bit.

## Guard

The reproduction stays in the suite, timed against the race's own later frames on the same machine:
on every circuit, a race the arcade has loaded draws its first frame in at most three times a frame
after it, on its first race and on a second one. On the base's code it takes 115 and 121 times.

Two tests beside it pin what the fix rests on, with no clock. A race's `ready` pauses between slices
while it builds a circuit no race has read, and not once for a second race on that circuit. The
paint, the relief and the tunnel each stop after every row of pixels. `slices.test.ts` pins when
`inSlices` pauses, and that it waits for the next task. Taking out the mask's memory, a row's stop
in the paint, the slices in `ready`, or the wait in `loadKart`, each fails one of them.

## Mutation

mutation: no changed core file against origin/main (a533dac7): nothing to mutate
