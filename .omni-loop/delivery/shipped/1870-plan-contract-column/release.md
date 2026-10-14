---
prd: 1870
title: Plans say what each slice changes for its callers
---
A repository can ask every plan to declare, slice by slice, which of its contract kinds a slice changes, or none. Plan check refuses a slice that declares nothing or names a kind the repository does not list, and plan repositories read each target's own kinds.
