---
id: s1-01-proof-url-shape
prd: 798
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The design says proof videos are filmed either on the pull request's preview or on a fixed address, but not which fixed addresses are allowed.

## The decision, in plain words

The setting takes the preview keyword, or any full web address starting with http or https, so a local server on this computer also works. The setting for the preview password only takes the name of a variable, never the password itself.

## The intro, for fun

Where does the camera crew set up?

## The punchline, for fun

Anywhere with a web address, apparently, even the back garden.

## The options, in plain words

A. github-deployment, or any absolute http or https URL (built)
B. github-deployment, or https anywhere and plain http only on the loopback address, as ask.url does
C. github-deployment, or https only

## What I had to decide

Whether a fixed proof address may be plain http on any host, or must be https like the ask page's address.

## What I did meanwhile

Plain http is accepted on any host; the preview keyword and https work as the design says.

## What it costs to change later

A constant: tightening the rule later is one line in the config schema, and no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names github-deployment or a fixed URL, and says nothing about http, localhost or the shape of bypassEnv (author).
