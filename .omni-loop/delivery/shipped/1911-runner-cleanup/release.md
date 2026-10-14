---
prd: 1911
title: Runners keep their disk clean on their own
---
When a job ends, the runner deletes the job's local branch unless it was pushed. Once at start and
every hour, it removes the folders, branches and old logs that finished jobs left behind, and keeps
logs for 14 days unless told otherwise.
