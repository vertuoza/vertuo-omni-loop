---
id: s4-02-device-link-from-ask-url
prd: 1660
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The terminal prints the link to approve the sign-in. Should it print the address the Omni page sends back, or build it from the address the repository's settings give for the Omni page?

## The decision, in plain words

It builds the link from the repository's own setting, the address the terminal already trusts and talks to, and only takes the short code from the page's answer.

## The intro, for fun

Two addresses for the same door walked into a terminal.

## The punchline, for fun

It picked the one written in its own notebook.

## The options, in plain words

A. A. Build the link from the configured address
B. B. Print the address the page sends back

## What I had to decide

Keep the link built from the configured address (A), or print the address the page answers with (B).

## What I did meanwhile

Built as A: deviceLink in kit/lib/ask/device.ts makes the ask device page under ask.url with the user code, and the page's url field is not read.

## What it costs to change later

B is one line in the device module and its test, at any time.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec prints the link under ask.url while the page's answer also carries its own url, built from the server's own origin, which may differ behind a proxy.
