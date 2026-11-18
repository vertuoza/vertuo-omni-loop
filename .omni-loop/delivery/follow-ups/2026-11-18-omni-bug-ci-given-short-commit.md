---
source: bug #3041
date: 2026-11-18
---

omni bug ci given short commit ids finds no run (gh run list --commit needs the full sha), waits its whole --wait and says "the runs did not finish", though both runs had finished.
