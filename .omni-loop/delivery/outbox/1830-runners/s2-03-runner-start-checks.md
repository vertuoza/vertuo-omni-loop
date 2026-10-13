---
id: s2-03-runner-start-checks
prd: 1830
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The spec says how a runner signs in but not which Omni page it talks to, nor how it tells that Claude is signed in. How should it find both?

## The decision, in plain words

The runner talks to the page named in the settings of the folder it starts in, else of the first repository it holds. It asks Claude whether it is signed in, and also refuses to start without the terminal tool every job runs in.

## The intro, for fun

A new courier asked which depot to report to.

## The punchline, for fun

We said: the one on the first parcel's label.

## The options, in plain words

A. A. The page from the settings here or of the first repository held, with claude and tmux checked before registering.
B. B. A required --url flag naming the Omni page.
C. C. Check the sign-in by running a one-word prompt through claude.

## What I had to decide

Where omni runner reads ask.url, and how it checks that claude is installed and signed in before it registers.

## What I did meanwhile

ask.url comes from the config of the folder omni runner runs in, else of the first checkout under --repos that sets one; none, it refuses in one line. claude --version checks it is installed, claude auth status (exit 0 and no "loggedIn": false) that it is signed in, and tmux -V that tmux is there; each missing tool is one line and no registration.

## What it costs to change later

A --url flag, or another check, is a few lines in kit/bin/commands/runner.ts and kit/lib/runner/terminal.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) claude auth status was not run on this machine: the check relies on it exiting non-zero, or printing loggedIn false, when Claude Code is signed out; to be checked by hand on the agent server.
