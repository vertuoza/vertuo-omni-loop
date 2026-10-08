---
id: s6-01-hud-command-name
prd: 1208
slice: s6
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

The spec says people turn the band off by typing /omni:hud, but Claude Code does not let a plugin's own command have a colon in its name. What should the command be called?

## The decision, in plain words

The command is called /omni-hud, after the plugin itself: typing it once hides the band in this and later sessions, and typing it again shows it.

## The intro, for fun

The spec asked for a colon, and Claude Code said colons are for skills only.

## The punchline, for fun

So the band answers to a hyphen instead, which is almost the same punctuation.

## The options, in plain words

A. A. Keep /omni-hud, the plugin's own name, registered by the mod itself.
B. B. Add a skill named hud to the omni plugin so that /omni:hud exists and flips the same switch, which changes the omni plugin the spec leaves untouched.
C. C. Drop the command and leave the switch to the enabled plugins list in the settings file: turning omni-hud off there hides the band.

## What I had to decide

Whether /omni-hud is the name people type to hide or show the band, or whether the toggle should live somewhere else.

## What I did meanwhile

The band, its tests and its marketplace entry all use /omni-hud; the spec and the kit README (slice s7) should say /omni-hud too.

## What it costs to change later

A rename is one string in the mod, its reply line and its tests: no stored data changes, and the off switch kept in the person's settings stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Not tried in a live session: whether Claude Code lists a plugin-registered command bare (/omni-hud) or prefixed with the plugin's name was not checked, because loading the mod into this session was out of bounds.
