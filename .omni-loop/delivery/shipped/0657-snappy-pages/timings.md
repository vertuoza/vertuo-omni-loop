# Timings — PRD 657

Production (`https://vertuo-omni-loop-galaxy.vercel.app`), signed in, ten loads per page, in
milliseconds. "First byte" is the time to the response's first byte; "full load" is the time to the
whole HTML document (streamed chunks included, no scripts or images).

Measured with:

```bash
node apps/galaxy/scripts/timings.mjs --cookie <file>
```

where `<file>` holds the `cookie` request header of a signed-in page load, copied from the browser's
developer tools (the script prints how when run without it). Keep that file out of the repository.

The target (spec, acceptance criterion 11): after merging, a median first byte under 200 ms and a
warm full load of about 1 s or less on `/prd` and `/app`.

## Before

Measured 2026-09-29 on production (`main` at v0.0.93, before this PRD), signed in as a Vertuoza
member, ten warm loads per page in a row, from Chrome in Belgium. The loads ran as same-origin
`fetch` calls from a signed-in tab, with the browser's own session and `cache: no-store`, rather than
through the script with a pasted cookie, which measures the same thing. Nothing streams today, so
the first byte comes only once the whole page is rendered, and it equals the full load.

| page | first byte, median | first byte, p75 | full load, median | full load, p75 |
| --- | --- | --- | --- | --- |
| /prd | 788 | 904 | 788 | 905 |
| /app | 819 | 846 | 819 | 847 |
| /app/workspace | 730 | 750 | 730 | 750 |
| /app/fleet | 744 | 770 | 744 | 770 |

The slowest single load was 1042 ms, on `/prd`. These are warm numbers: the instance and the
GitHub summaries' 60-second cache were already warm after the first load.

## After

Measured 2026-09-29, about 20 minutes after #664 merged (main at `7a4ede1`, migrations applied),
the same way as Before: signed in, from Chrome in Belgium, same-origin `fetch` from a signed-in tab.
Ten warm loads per page came after one warm-up load, which is not counted.

| page | first byte, median | first byte, p75 | full load, median | full load, p75 | vs before (median) |
| --- | --- | --- | --- | --- | --- |
| /prd | 386 | 439 | 387 | 441 | −51 % |
| /app | 392 | 402 | 399 | 411 | −51 % |
| /app/workspace | 364 | 376 | 365 | 378 | −50 % |
| /app/fleet | 384 | 405 | 387 | 406 | −48 % |

Against the target (acceptance criterion 11):

- **Warm full load of about 1 s or less:** met, at about 0.4 s on every page.
- **Median first byte under 200 ms:** not met, at about 0.39 s. The layout still waits for the
  viewer and the bell's questions before it sends the frame (decision s4-03), so the first byte
  arrives with the first streamed flush. Moving the bell into its own streamed block is the next
  step if the frame must paint sooner.

Sidebar navigation was checked in the same session. `/app/workspace` → `/prd` → `/app/fleet` changed
page without a document load, and the router's request answered 200. Just after the deploy, one click
fell back to a full load, because the router's request answered 503. It did not happen again.
