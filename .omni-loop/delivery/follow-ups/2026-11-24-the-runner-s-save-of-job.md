---
source: bug #3236
date: 2026-11-24
repos: [vertuoza/vertuo-omni-loop]
---

The runner's save of job 2e88de82 failed on `git add -A` with its worktree excludes, the job's folder was then removed, and the PM's five question items were lost.
