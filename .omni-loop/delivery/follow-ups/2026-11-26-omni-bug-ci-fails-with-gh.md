---
source: bug #3330
date: 2026-11-26
repos: [vertuoza/vertuo-omni-loop]
---

omni bug ci fails with gh failed: no output when a CI job's log is over 1 MB: its gh call has no maxBuffer, so Node throws ENOBUFS (seen on the supabase check job of #3331).
