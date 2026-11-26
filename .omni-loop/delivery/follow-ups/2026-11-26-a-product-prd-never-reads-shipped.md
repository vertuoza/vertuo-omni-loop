---
source: bug #3371
date: 2026-11-26
---

A product PRD never reads shipped: omni prd <key>-<n> derives its state from its approval alone, so omni-loop-27 and omni-loop-35, both merged into main, still read inbox; recording a product PRD's shipped stage needs a stored stage the server does not keep yet.
