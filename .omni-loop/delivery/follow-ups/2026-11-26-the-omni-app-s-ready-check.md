---
source: bug #3320
date: 2026-11-26
repos: [vertuoza/vertuo-omni-loop]
---

The Omni app's ready check reads a live mission's scope.prds as numbers only, so it fails for a repository that holds a mission scoped by product PRD ids.
