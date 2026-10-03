---
prd: 1049
title: Identifiers that can't be mixed up
---
PRD, pull request, issue and comment numbers, slice ids and decision ids now each have their own type,
checked where they are read. An agent that passes one where another belongs is stopped before the
change builds, and a check keeps every new identifier typed.
