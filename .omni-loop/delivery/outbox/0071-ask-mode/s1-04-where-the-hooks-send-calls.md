---
id: s1-04-where-the-hooks-send-calls
prd: 71
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The saved session holds the link to its page, but the hooks also need the address of the server to talk to. Where should they take it from, and what if the two disagree?

## The decision, in plain words

The hooks take the server's address from the repository's settings, and stay silent when the setting is empty or points at another server than the one the session was opened on. Emptying the setting therefore switches the mode off at once.

## The intro, for fun

The note on the fridge says where the party is, but the invitation says somewhere else.

## The punchline, for fun

When in doubt, the hooks stay home and let the terminal host.

## The options, in plain words

A. Take the server's address from the settings, and stay silent when it is empty or disagrees with the session, the option built.
B. Keep the server's address in the saved session as well, so the hooks never read the settings.

## What I had to decide

The spec gives `.omni-loop/local/ask.json` as `{sessionId, url, host}` and says `omni ask status` prints "the link", so `url` reads as the session page, not the base of the `/api/ask/*` calls. The calls need `ask.url`, whose path is not recoverable from the page link.

## What I did meanwhile

`activeSession` in `kit/lib/ask/hook.mjs` reads `ask.json`, then `ask.url` from `.omni-loop/config.yml`: the mode is on only when both exist and the host of `ask.url` equals `ask.json`'s `host`. Every call goes to `<ask.url>/api/ask/...`, a path under `ask.url` kept. s5, which writes `ask.json` with `writeSession`, must store the page link as `url` and the host of `ask.url` as `host`.

## What it costs to change later

A few lines in `activeSession` if s5 stores the base URL in `ask.json` instead.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5 means `url` in `ask.json` to be the page link or the base of the calls
