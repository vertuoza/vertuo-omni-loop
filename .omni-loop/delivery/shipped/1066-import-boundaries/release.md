---
prd: 1066
title: Each part of the code stays in its lane
---
The rules for which part of Omni Loop may use which are now checked on every change. Code that reaches
across a boundary, or browser code that reaches server-only code, is stopped before it builds, with the
path that led there.
