---
source: bug #3309
date: 2026-11-25
repos: [vertuoza/vertuo-omni-loop]
---

The App's product PRD record reader takes the newest approval of any kind, so a Tech Approval newer than the product approval would read as the approval in force; galaxy's judge filters on approval_kind = 'product'.
