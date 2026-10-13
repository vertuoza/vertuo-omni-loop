---
prd: 1804
title: Builds across repositories install before they test
---
A repository the loop builds in can name its install command in its own config. Builds across several repositories run it before that repository's tests, so the tests run locally on real dependencies. Setting up a repository proposes the command from its lockfile.
