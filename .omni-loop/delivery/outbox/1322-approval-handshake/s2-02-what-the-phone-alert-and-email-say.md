---
id: s2-02-what-the-phone-alert-and-email-say
prd: 1322
slice: s2
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The spec says the phone alert and the email show the PRD's one-line before and after, but nothing writes such a line down, and the phone's page must read what the alert carries. What do they hold?

## The decision, in plain words

The before and after line is the first sentence of the spec's Problem, then the first sentence of its Solution. The phone alert carries a title, the spec's title with that line, and the PRD page's link; the email adds the repository, the file hashes and the whole Problem and Solution.

## The intro, for fun

A one-line summary was promised, and nobody had written the line.

## The punchline, for fun

So the spec's own first sentences were asked to speak up.

## The options, in plain words

A. A. First sentences of Problem and Solution; push payload {title, body, url} as s9's service worker reads it (built).
B. B. Add a one-line before → after field to the spec's front matter, and show it only when present.
C. C. Leave the line out and show only the title, the repository and the hashes.

## What I had to decide

Where the notification's one-line before → after comes from, and the payload the service worker (s9) reads from a push.

## What I did meanwhile

approvals.service.ts builds the message: title `PRD <n> waits for your approval`; lines: the spec's title, `<first sentence of Problem> → <first sentence of Solution>` (each cut at 140 characters, a line dropped when the spec has neither section), and `<repo> · spec <7 chars> · plan <7 chars> · before-after <7 chars>` from the latest version of each kind. The push payload is exactly the JSON {title, body, url} that s9's service worker reads (item s9-01-push-payload-shape): body the spec's title and the before → after line, url the path /prd/<dossier id>. The email's subject is `PRD <n> waits for your approval: <title>`, its text and HTML hold the same lines, then the Problem and Solution sections, then the link.

## What it costs to change later

Low: the payload is built in one function and read by one service worker; nothing is stored in this shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names a one-line before → after but not where it is written; the before/after page has no such line either.
- (author) The payload follows s9's item s9-01-push-payload-shape, relayed by the wave while both slices ran.
