---
prd: 942
title: Fewer unchecked shortcuts, and a limit that only goes down
---
The code now holds 222 places that tell the compiler to stop checking, down from 552, and each one says why. A check counts them per part of the repository and fails if a count rises, so the number can only go down. Nothing changes for people using the loop.
