# Bug 1813: OMNI KART's tunnel hides the view on entering and is drawn cyan blue

## Triage

- **Domain:** galaxy arcade — OMNI KART's renderer (`apps/galaxy/src/arcade/kart/mode7.ts`, the tunnel of PRD 1775)
- **Risk:** high — every OMNI KART player on COMET RING (the default circuit) loses the view at each tunnel entry, the screen filling with the portal colour, and drives the tunnel half-blind; the race still finishes, since the tunnel is a straight (Jev, 0.58)
- **Regression:** new bug — no evidence this ever worked: the tunnel arrived with #1776 and has drawn this way since

## Reproduction

- **File:** `apps/galaxy/src/arcade/kart/mode7.test.ts`
- **Red:** AssertionError: kart at tile 56.5: expected 0.48333333333333334 to be greater than 0.5

## Fix

The portal's frame was tested *across* its edge instead of *along* it, so every pixel of a portal counted as
frame. When the chase camera crossed it, that one solid wall filled the screen, and inside, the exit portal
hid the road. The side walls were also taken for portals, because the texture paints the road's neon edge on
the void's first pixels. Now `edgeAt` reads each edge's orientation in the roofed mask, finds the portal
half a tile past the edge (beyond the neon), and tests the frame's posts under the roof. `paintRoof` closes
the gaps the ceiling left on the far side of the tunnel's hump. The tunnel's palette is written `#rrggbb`
through `pack`, so the portal frame and the porthole rims are the pale yellow and amber they were meant to
be, not cyan.

## Guard

`apps/galaxy/src/arcade/kart/palette.test.ts` fails when any source of OMNI KART's engine writes a colour
packed (`0xff` and six hex digits) instead of `#rrggbb` through `pack`, the byte order that turned the
portal cyan. It is red on main's `mode7.ts` (15 packed literals) and green here. The frames driving into
COMET RING's tunnel (the reproduction) hold the view itself.

## Mutation

mutation: no changed core file against origin/main (0ce91d2f): nothing to mutate
