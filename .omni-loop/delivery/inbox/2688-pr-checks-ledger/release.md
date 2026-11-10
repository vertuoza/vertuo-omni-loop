---
prd: 2688
title: Merge gates that stay on, whatever a vendor's quota
---
The outbox, inbox, approval and budget checks now run on Omni's own job queue, so every pull request into a default branch gets them again. A check that cannot run shows as delayed on the pull request, then ends as a failure rather than staying in progress.
