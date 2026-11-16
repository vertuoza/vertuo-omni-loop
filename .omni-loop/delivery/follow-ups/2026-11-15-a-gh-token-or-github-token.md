---
source: bug #2914
date: 2026-11-15
---

A GH_TOKEN or GITHUB_TOKEN exported by the runner user's shell profile outranks the job's own gh sign-in under a login shell: the runner guide says to keep them out, but nothing checks it. The runner could refuse to start, or warn, when its login shell exports one.
