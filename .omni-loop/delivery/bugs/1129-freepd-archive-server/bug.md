# Bug 1129: a pitch's FreePD music fails behind the archive's redirect and the video renders silent

## Triage

- **Domain:** pitch music — `kit/lib/pitch/providers/music/freepd.ts` (PRD 1108, s5)
- **Risk:** medium — anyone making a pitch with FreePD music gets a silent video; the workaround is copying a track into the run's assets by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `kit/lib/pitch/providers/music/freepd.test.ts`
- **Red:** AssertionError: promise rejected "Error: the archive answered 500 for "Adve…" instead of resolving

## Fix

The provider downloaded only through `archive.org/download/freepd/…`, which redirects to a mirror that answered 500 for every track. After its attempts on that address, it now reads `archive.org/metadata/freepd` and downloads from the item's own servers (`d1`, then `d2`), keeping the download address's refusal when none answers. Checked live: the track downloads while the mirror still fails.

## Guard

The reproduction test is the guard: it fails on the default branch's code and passes on the fix, with a second test for the second server and for metadata that cannot be read.

## Mutation

mutation: no changed core file against origin/main (d380e29a): nothing to mutate
