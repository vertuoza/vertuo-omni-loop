---
prd: 1646
title: Vercel builds only what a change can reach
---
Each merge now deploys the arcade and the GitHub App at most once, and only the one it changes; a merge of documents deploys nothing. Previews build for ready pull requests once their pushes settle, not on every push. A failed release still deploys.
