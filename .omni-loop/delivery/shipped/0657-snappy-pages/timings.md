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

Measured after the merge, on production, with the same command.
