---
prd: 1737
title: Critical flows decide which tests block a deploy
---
Each product can list its critical flows, and every end-to-end test is now marked critical or standard by the flow it covers. The status report shows each test's level and flow, and refuses a critical test that covers no known flow.
