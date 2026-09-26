---
form: setup
form-version: 1
state: blank
points-to: null
evidence: []
invaded: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:README.md#getting-started — changes in kit/porting/templates--setup.md -->

# Setup

Use this page when getting a checkout ready to build, test, and run locally.

## Prerequisites
<!-- slot: prerequisites · required -->
The versions the repository pins (its engines field, a version file) win over any number written on
a page. A single check that says whether a machine is ready beats a list of steps that drifts.

## Install
<!-- slot: install · required -->
Install exactly what the lockfile pins, with the package manager that wrote it. An install that
rewrites the lockfile is a change to review, never a side effect.

## Run
<!-- slot: run · optional -->
Each app has a fixed local port of its own, listed in one table. Check that table before giving a
new app its default, so two apps never collide on the next free number.

## Environment
<!-- slot: env · optional -->
Settings come from the environment. The repository keeps an example file listing every variable,
with a note on where its value comes from. A secret is never committed, and never printed.
