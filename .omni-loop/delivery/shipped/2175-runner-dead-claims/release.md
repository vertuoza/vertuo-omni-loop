---
prd: 2175
title: Runner jobs pick up where a stopped job left off
---
When a runner job stops while building, its runner releases the slices it held and says so on the Runners page and on each pull request. The next run reuses that work when it still matches the plan, or rebuilds it, and a runner job never waits on a question.
