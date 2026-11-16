---
prd: 2915
title: Jobs sent with an API key run as that key's own GitHub App
---
When an API key holds its own GitHub App, every job it sends gets its GitHub access from that App, and its bot signs the work. A key with no App still runs as the Omni App. A send is refused when the key's App is not installed on a repository the job would reach.
