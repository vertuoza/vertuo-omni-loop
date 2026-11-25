---
source: bug #3315
date: 2026-11-25
repos: [vertuoza/vertuo-omni-loop]
---

A page already written with a diagram left as source in a `<details>` is not redrawn by `omni before-after render`, which only finds `<pre class="mermaid">`: the page's author must put the source back in a `<pre class="mermaid">` and render again.
