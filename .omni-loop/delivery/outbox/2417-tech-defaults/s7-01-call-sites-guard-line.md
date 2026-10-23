---
id: s7-01-call-sites-guard-line
prd: 2417
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 4
---

## The question, in plain words

The new writer that opens pull requests in the settings repository must be listed by the check that watches every place the app talks to GitHub, and that check sits outside this slice's ground: may the slice add its line there?

## The decision, in plain words

The slice added one line to that check, naming the new writer and why it may write as the Omni app, and changed nothing else in it.

## The intro, for fun

Every door to GitHub has a name on the guard's list, and we just built a new door.

## The punchline, for fun

So we wrote our name on the list, in pen, and left the rest of the page alone.

## The options, in plain words

A. Keep the writer as its own file and list it in the call-sites check (built).
B. Move the writes into the area's existing GitHub reader, already listed, and leave the check untouched.

## What I had to decide

Whether the new pull-request writer stays its own file, listed by the GitHub call-sites check, or moves into the area's existing GitHub reader, which the check already lists.

## What I did meanwhile

apps/galaxy/src/github-call-sites.test.ts lists apps/galaxy/src/omni-settings/omni-settings.pull-request.ts as a `client` site, with one comment line; the file reaches GitHub only through @omni/github, as the check's second test proves.

## What it costs to change later

Folding the writer into omni-settings.github.ts later is a file move and one line removed from the check; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for s7 names the omni-settings folders only; the wave's prompt asked for the registration, but no plan line covers the check's file.
