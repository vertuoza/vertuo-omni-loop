---
source: bug #3330
date: 2026-11-26
repos: [vertuoza/vertuo-omni-loop]
---

omni runner log does not point at a lost job's saved work (its checkpoint): /omni:repair reads the line, status, reason and log tail, and the work GitHub holds.
