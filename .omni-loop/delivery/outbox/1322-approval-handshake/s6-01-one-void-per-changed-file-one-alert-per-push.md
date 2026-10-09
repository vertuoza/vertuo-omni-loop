---
id: s6-01-one-void-per-changed-file-one-alert-per-push
prd: 1322
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When one push changes two approved files, is the approval voided once or once per file, and how many alerts does the approver get?

## The decision, in plain words

Each changed file leaves its own void record, so the page can show exactly what changed, but the approver gets one alert and one email per push, listing every changed file. A later push does not void the same approval again.

## The intro, for fun

Two files changed in one push, and the approver's phone braced for twins.

## The punchline, for fun

It got one buzz with a list instead.

## The options, in plain words

A. A. A void per changed file, one alert per push listing them (built).
B. B. One void per approval, naming only the first changed file, and one alert.
C. C. A void and an alert per changed file.

## What I had to decide

How many approval_voids rows a push writes and how many notifications follow, and how the push route learns which voids its own push left.

## What I did meanwhile

dossier_push reads the approval in force once before adding versions, then appends one approval_voids row per added version of a pinned kind with another sha256. approval_voids gained version_id (the version that voided), so approval_voids_of_push(dossier) names the caller's voids whose version is still the latest of its kind; the route sends one message per push to the approver through approval_void_recipients() (service role). Push payload {title: `approval voided by <pusher>'s push`, body: `PRD <n> · <title>` and each `<kind> <old7>→<new7>`, url /prd/<dossier>}.

## What it costs to change later

Low: one loop in dossier_push and one function of the service; the column is additive and nothing read the table before.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names one void per approval (the kind, the old and new hash) but not a push that changes several pinned files at once.
