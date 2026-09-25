---
id: s5-02-switching-when-the-page-is-away
prd: 71
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Turning ask mode on or off talks to the page's server, which may be unreachable or may refuse the sign-in. What should each do then?

## The decision, in plain words

Turning it on changes nothing unless a new session was opened, so a session already on stays on. Turning it off always stops sending questions to the page from this computer, and says so when the page could not be told.

## The intro, for fun

Flipping a switch is easy, until the wire on the far end goes quiet.

## The punchline, for fun

Now the near side always obeys, and the switch admits when the far side did not hear.

## The options, in plain words

A. Turning on changes nothing unless a new session opened, and turning off always works on this computer with a warning, the option built.
B. Turning off fails too when the page cannot be told, and the mode stays on until it can.
C. Turning on closes the old session before opening the new one, so two are never open at once.

## What I had to decide

The spec: `off` "closes the session and deletes the file", and a second `on` "replaces the first session and closes it". It does not say what either does when a call fails, in which order a second `on` opens and closes, what `off` does when `ask.url` is null or names another host than the session's, what the title is on a detached HEAD or without a repository slug, nor what `/omni:ask` does when the computer has no sign-in.

## What I did meanwhile

`turnOn` in `kit/lib/ask/mode.mjs` opens the new session first; only once it has an id and a link does it write `ask.json` (and clear `ask-round.json`), then close the session it replaced. When opening fails (unreachable, a 401 the refresh cannot cure, a 403), nothing changes and `omni ask on` exits 1 with one line, naming `omni signin` for a missing or refused sign-in. `turnOff` tries to close the session, then deletes `ask.json` and `ask-round.json` whatever happened: when the close failed, or `ask.url` is null or names another host, `omni ask off` still prints `off` and exits 0, with one stderr line saying the session was left open and closes by itself after 12 hours without a call. A 404 on close counts as closed. `omni ask status` reads only the checkout, as the hooks do, and calls nothing. The title is `<repo.slug, else the folder's name> · <branch, else the short commit>`, cut at 200 characters (the server's limit). `/omni:ask on`, told to sign in, asks the person to run `omni signin` themselves and never runs it for them, since it opens a browser and waits.

## What it costs to change later

A few lines in `kit/lib/ask/mode.mjs` and `kit/plugin/skills/ask/SKILL.md`, and their tests; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person would rather see `omni ask off` fail when the page could not be told, since the page then shows the session open for up to 12 hours.
- (author) Whether `omni ask status` should ask the server, so that a session closed on the page reads as off at once.
