---
name: ask
description: Switches ask mode on or off in this checkout, or says whether it is on. While it is on, every question Claude asks through AskUserQuestion goes to a web page the person reads and answers, a tab per terminal, and the terminal takes over whenever the page cannot answer. Runs omni ask on, off or status and prints the page's link. Triggers on "ask mode on", "ask me on the page", "turn ask mode off", "is ask mode on", "/omni:ask on", "/omni:ask off", "/omni:ask status".
---

# Ask: questions on a web page

`omni` below is `node .omni-loop/bin/omni.mjs`. This skill only runs `omni ask` and reports what it
printed. The plugin's hooks do the rest: while the mode is on they send each `AskUserQuestion` to
the page, wait for the answer, and hand it back; when the page cannot answer, the question shows in
the terminal as it always did.

The mode is switched on per checkout, and covers every Claude Code terminal open in it. Each
terminal gets its own session, opened by its first question, and shows as its own tab on the
person's page; the tab goes away when that terminal exits.

## Input

One word after the command: `on`, `off` or `status`. With none, run `status`. Anything else: say
the three words it takes, and stop.

## on

Run `node .omni-loop/bin/omni.mjs ask on`.

| exit | what you do |
|---|---|
| `0` | Its output is the person's page, one line. Print it as is, then one sentence: ask mode is on in this checkout, each terminal's questions show on that page in a tab of their own, and the terminal takes over whenever the page cannot answer. |
| `1`, naming `omni signin` | Print its line as is. This computer has no sign-in for the page yet (or it expired). Tell the person to sign in once, themselves, in their browser: `! node .omni-loop/bin/omni.mjs signin` in this session, then `/omni:ask on` again. Never run `omni signin` for them. |
| `1`, any other line | Print it as is and stop. With `(ask.url)` in it, this repository has not set up ask mode: its config has no `ask.url`. |
| `2` | The kit is not installed here, or its config does not read. Print the line and stop. |

`on` replaces nothing: run again, or in another terminal of the same checkout, it prints the same
page and leaves every terminal already asking exactly as it was.

## off

Run `node .omni-loop/bin/omni.mjs ask off`. It closes every terminal's session of this checkout,
prints `off`, and the hooks are silent again in all of them. When it also printed lines saying a
session could not be closed, print them: the mode is still off here, and the page closes those
sessions by itself after 12 hours without a call.

## status

Run `node .omni-loop/bin/omni.mjs ask status`. Print the page it gives with "ask mode is on in this
checkout", or "ask mode is off".

## Never

- Never write, edit or delete anything under `.omni-loop/local/`, nor read or print the sign-in
  kept in the person's home folder: `omni ask` and `omni signin` own them.
- Never ask a question some other way because the mode is on or off: `AskUserQuestion` stays the
  one way to ask, and the hooks decide where it is answered.
