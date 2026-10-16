---
id: s4-02-pr-sender-line-needs-kit-change
prd: 2022
slice: s4
rank: medium
bears-on: none
raised: 2026-10-16
wave: 4
---

## The question, in plain words

The pull request a key's job opens should say it was sent by the API key, but the line is written by the kit, which this feature may not change. Should the kit be changed to write it?

## The decision, in plain words

The runner now receives the sender as the key's name and its maker, but the kit still puts an at-sign in front of it, so the pull request line will read slightly wrong until the kit is changed.

## The intro, for fun

The job now signs its name with a key, but the stamp it uses was made before keys.

## The punchline, for fun

Until the stamp learns about keys, the pull request line wears a stray at-sign.

## The options, in plain words

A. A. Leave the kit as it is; the pull request line has a stray at-sign for a key's job (built).
B. B. Change the kit's sender line to leave a sender that starts with API key unchanged, in a follow-up pull request.

## What I had to decide

The runner's `next` answers `sentBy` as `API key <name> (@<login>)` for a key's job, which the runner passes as OMNI_SENT_BY. `senderLine` in kit/lib/runner/sender.ts adds `@` in front of any sender, so the pull request would read `by @API key <name> (@<login>) on runner <runner>`. The kit is outside this feature's territory and the spec's scope, so it is left unchanged. The follow-up is one line in senderLine: keep a sender that already starts with `API key ` as it is.

## What I did meanwhile

The Runners page and the job route name the key correctly; only the pull request's sender line carries a stray at-sign.

## What it costs to change later

One small kit change and a rebuild of the kit bundle, in a follow-up pull request.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the kit may be changed for this is not settled by the spec (author).
