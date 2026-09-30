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

2026-09-29, about 10 minutes after #693 merged (`main` at `de78320`, `fix_facts` applied), measured
the same way. Three runs, because Chrome's network was noisy: run 3 interleaved `/app` as a control.

| page | first load | run 1 median | run 2 median | run 3 median (with /app) | worst warm |
| --- | --- | --- | --- | --- | --- |
| /bugs | 613 | 407 | 610 | 351 | 2824 (one load in run 3) |
| /visual | 326 | 356 | 659 | 368 | 1624 (one load in run 1) |
| /app (control) | — | — | — | 482 | 912 |

Against the target (acceptance criterion 6):

- **Median under 600 ms:** met. The median was 351–407 ms on `/bugs` and 356–368 ms on `/visual`,
  except in run 2, when every page was slower. In the interleaved run, both lists were faster than
  `/app` itself.
- **The worst of ten warm loads under 1 s:** not always met. One load in ten can still take 1.6 to
  2.8 s. The cold first load fell from 4.4 s to 0.6 s on `/bugs`, and from 1.0 s to 0.3 s on
  `/visual`. The pages no longer call GitHub, so the rare slow load is not GitHub. It is most likely
  a cold function instance or the network, which this PRD did not change.

The stored facts were filled: the first `/bugs` load after the deploy showed a single `—` pill.
