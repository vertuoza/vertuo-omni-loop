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

Owed: run before merge. The slice that added the script had no signed-in session at hand, so the
baseline is still to be measured and pasted here (outbox item for slice s1).

| page | first byte, median | first byte, p75 | full load, median | full load, p75 |
| --- | --- | --- | --- | --- |
| /prd | owed: run before merge | owed | owed | owed |
| /app | owed: run before merge | owed | owed | owed |
| /app/workspace | owed: run before merge | owed | owed | owed |
| /app/fleet | owed: run before merge | owed | owed | owed |

## After

Measured after the merge, on production, with the same command.
