---
prd: 1675
title: validate-e2e follows the native login
---
The e2e validation no longer stops on a test made only of exact steps, because only a test that calls the agent must have a recording. The guide now starts from the framework's own login, and the skill writes that login setup when a repository has none.
