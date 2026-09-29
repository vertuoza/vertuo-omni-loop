---
prd: 598
title: Tests and a dead-code check on every ready pull request
---
A ready pull request into main now runs the tests and a Fallow check for any unused or duplicated
code it adds. Runs wait three minutes, so a burst of pushes costs one. Claude runs the same check
before every commit and push.
