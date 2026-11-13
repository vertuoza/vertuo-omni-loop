---
prd: 2746
title: Pull requests wait for the work they depend on
---
A pull request that names another one it must merge after stays a draft until that one is merged and, when its repository says how, until it is served. The loop says what it waits for and checks again on its own.
