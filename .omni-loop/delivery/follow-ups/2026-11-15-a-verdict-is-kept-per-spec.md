---
source: bug #2900
date: 2026-11-15
---

A verdict is kept per spec version and pack commit, so a change to the judge never re-judges a spec it already read red: PRD 2898 keeps its red until its spec gets a new version.
