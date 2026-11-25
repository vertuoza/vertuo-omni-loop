---
source: bug #3288
date: 2026-11-25
repos: [vertuoza/vertuo-omni-loop]
---

apps/galaxy/src/business/reveal-render.test.ts fails on main today: the saved reveal still renders the 'business-found' check rows ('not seen since 30 Sep'), so the test looks date-dependent.
