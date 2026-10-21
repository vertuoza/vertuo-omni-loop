---
prd: 2275
title: Bug fixes that see what only breaks in production
---
When a bug does not show in tests, a bug fix now checks the built app with a check each repository commits. Without that check it stops and keeps what reproduces the bug, so nothing ships unproven. Its triage appears at once, with the release the bug first showed in.
