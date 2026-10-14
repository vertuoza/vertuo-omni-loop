---
prd: 1894
title: Runner jobs sign in to Claude on a headless server
---
When the Claude sign-in token from setup-token is exported before the runner starts, every job it
runs gets that token and signs in to Claude with it. Without the token, jobs keep using Claude's
stored sign-in, as before.
