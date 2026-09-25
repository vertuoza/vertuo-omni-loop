---
id: s1-01-live-proof-not-run
prd: 71
slice: s1
rank: high
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

This slice was meant to prove, in a real Claude session, that an answer given on the page reaches Claude and the terminal question never shows. That proof could not be run here, so should the build carry on before a person runs it?

## The decision, in plain words

Everything the proof sits on is built and tested against a stand-in server, and the live proof is left for a person to run on their own computer. The next slices carry on, and the feature is not shipped until the proof has passed.

## The intro, for fun

Everything is wired up and tested, except the one check that needs a real person at the keyboard.

## The punchline, for fun

The doorbell is built and wired, but nobody here was allowed to press it.

## The options, in plain words

A. Carry on, and have a person run the live proof before the feature is shipped, the option built.
B. Hold the slice that turns the mode on until a person has run the live proof.
C. Stop the whole feature now and send it back to design until the proof has been run.

## What I had to decide

Whether slice s1 can finish without its live tracer. The plan makes the tracer s1's gate: "a live Claude Code session with the plugin loaded and `ask.json` pointing at the fake server receives the fake's answer as its `AskUserQuestion` result, and the terminal prompt never shows. When this fails, the slice stops with an outbox item." Here it could not run at all, which is not the same as failing. In this container `claude -p` runs a live session but does not offer `AskUserQuestion` in headless mode (the model found no such tool, even through tool search), and driving an interactive `claude` session from a terminal multiplexer was refused by this session's permission policy.

## What I did meanwhile

Built and tested against `kit/test/fake-ask-server.mjs`: `ask.url`, the local state under `.omni-loop/local/`, the contract client and its token store, `omni ask hook pre|post|prompt`, and `kit/plugin/hooks/hooks.json`. `claude plugin validate` passes on the plugin with its hooks. A live headless run (`claude -p --plugin-dir kit/plugin` in a scratch checkout carrying the built bundle as `.omni-loop/bin/omni.mjs`, with ask mode on against the fake server) loaded the plugin and ran the `UserPromptSubmit` hook, which returned the context line with exit 0; the pre and post hooks were never reached, since that mode has no `AskUserQuestion`. To run the proof by hand: in a checkout whose `.omni-loop/bin/omni.mjs` is this branch's `kit/dist/omni.mjs` and whose config sets `ask.url: http://127.0.0.1:47831`, start `node kit/test/fake-ask-server.mjs --port 47831` (it prints a session id and answers every round with each question's first option), write `.omni-loop/local/ask.json` as `{sessionId, url, host: "127.0.0.1:47831"}` and `~/.config/omni/credentials.json` as `{"127.0.0.1:47831": {"access_token": "access-1", "refresh_token": "refresh-1"}}`, run `claude --plugin-dir kit/plugin`, and ask Claude to call `AskUserQuestion`. Pass: no terminal prompt, and Claude reports the first option as the answer. For the post hook, restart the fake with `--answer none`: after nine minutes without an answer the terminal prompt shows, and an answer typed there appears in the fake's log as a call to `/answers` with `via: "terminal"`.

## What it costs to change later

If the hook cannot answer `AskUserQuestion`, the spec sends the PRD back to design. The hooks here would be reworked or dropped, s5 (which turns the mode on) would wait, and the server and page slices would stand only if the redesign keeps the same contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a PreToolUse hook's `updatedInput.answers` answers `AskUserQuestion` in a live interactive session without showing the terminal prompt — the load-bearing assumption the spec names
- the exact shape of the PostToolUse `tool_response` for `AskUserQuestion`: the post hook reads `tool_response.answers` (question text to label) and falls back to `tool_input.answers`, unverified live
