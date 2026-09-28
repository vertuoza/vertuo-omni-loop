---
id: s4-02-plugin-and-signin-already
prd: 420
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

How does the install command know the plugin is already installed or the computer already signed in, and what does it do when the repository has no Omni page address?

## The decision, in plain words

It asks Claude Code which plugins are installed, and counts any kept sign-in as signed in, even an old one. With no Omni page address set, it skips the sign-in and says so.

## The intro, for fun

The plugin moved in last week, and the install command came knocking again.

## The punchline, for fun

The install command checks the list before ringing the bell again.

## The options, in plain words

A. A. Ask Claude Code for its plugin list, count any kept sign-in, and skip the sign-in when there is no Omni page address (built).
B. B. Always run both plugin commands and read their output for already, and renew an old sign-in before saying already.
C. C. As A, but with no Omni page address still print omni signin as a later step.

## What I had to decide

How init detects an installed plugin and a held sign-in, and what the sign-in step does when `ask.url` is null in a kept config.

## What I did meanwhile

`claude plugin list --json` naming `omni@omni-loop` means already installed; `claude plugin marketplace add` runs only when `claude plugin marketplace list --json` lacks the marketplace. Any entry in the credentials file for the `ask.url` host counts as signed in, whatever its expiry (the hooks renew it). With `ask.url` null the step prints `signin  skipped: ask.url is not set` and nothing to type.

## What it costs to change later

A constant: a condition in each of the two step modules and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a plugin already installed or a sign-in already held prints already, but not how either is detected, nor what happens when a kept config has no ask.url.
