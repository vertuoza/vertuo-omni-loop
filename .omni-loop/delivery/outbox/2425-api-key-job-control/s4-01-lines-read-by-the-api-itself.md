---
id: s4-01-lines-read-by-the-api-itself
prd: 2425
slice: s4
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The spec says how a key pages through a job's log lines but not where the API reads them from, nor what the marker for the next page holds. Should the API read the lines itself, and should each marker work for one job only?

## The decision, in plain words

The API reads a job's lines itself, only after the runners' rule has found a job this key may read, and each next-page marker holds the job and the number of the last line, so it works for that job alone. A marker from a list or from another job is refused like any other bad marker.

## The intro, for fun

Every list had its bookmark, and the log wanted one of its own.

## The punchline, for fun

A bookmark for one book is no use in another.

## The options, in plain words

A. The API reads the lines itself, after the runners' rule has found a job the key may read, and each next-page marker works for one job only.
B. The runners' own code gets a read of the lines for the API to call, as it does for the job: the same rules in one place, but it changes code another slice of this wave builds on.

## What I had to decide

The spec gives the route, the paging and the key rules, not where the read lives or what the cursor holds. The runners' files belong to other slices of waves 2 and 3, so the lines are read by a new `jobLines` in the public API's own repository, filtered by workspace and job, after `runners.keyJob` has applied the key rules: any key of the workspace reads the job, a key off its repository list gets 403, a person's job and another workspace's get 404. A line has no creation time and no id of its own, so the cursor cannot be the one the PRD and bug fix lists use: it is the opaque base64url of `['lines', job, seq]` and a page reads `seq > last`, oldest first. It is tagged with its job, as the lists' cursors are tagged with their list, so another job's cursor, a list's cursor and a tampered one all answer 422 with the lists' own message. A job past the PRD 1904 retention reads as an empty `data` with no cursor, and its `log_tail` stays on the job. An id that is no uuid is 404 before the database sees it.

## What I did meanwhile

Built the route, the read and the cursor in the public API's own files, with tests for paging by 50 and by 100, a line added between two pages, a job whose first lines were trimmed, an empty page past the retention, a second key of the workspace, a key off its list, a person's job, another workspace's job and each kind of bad cursor.

## What it costs to change later

Moving the read into the runners' code later means moving one function and its tests; no stored data changes. A cursor handed out before the move would still decode, because its shape would not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a client that reads a running job should be told that the job is still writing, so it knows to read again: the spec does not ask for it, and the page does not say it.
- (author) Whether a cursor held across the retention, whose lines have since been deleted, should answer an empty last page or an error: the spec says an empty page for a job past the retention, so it reads as an empty last page.
