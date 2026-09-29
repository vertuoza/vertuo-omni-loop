# Timings — PRD 691

Production (`https://vertuo-omni-loop-galaxy.vercel.app`), signed in, measured from Chrome with
same-origin `fetch` calls from a signed-in tab (`cache: no-store`), the same way as PRD 657's
timings. Times are in milliseconds. The first load is cold. The ten loads after it are warm.

## Before

2026-09-29, `main` at `7a4ede1` (PRD 657 shipped).

| page | first load | median | p75 | worst |
| --- | --- | --- | --- | --- |
| /bugs | 4372 | 446 | 615 | 3910 |
| /visual | 1028 | 452 | 461 | 1284 |

## After

Measured after the merge, the same way.
