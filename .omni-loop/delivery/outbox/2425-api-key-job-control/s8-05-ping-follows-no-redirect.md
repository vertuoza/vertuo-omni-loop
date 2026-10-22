---
id: s8-05-ping-follows-no-redirect
prd: 2425
slice: s8
rank: medium
bears-on: none
raised: 2026-10-22
wave: 6
---

## The question, in plain words

A link may answer a ping by sending the server somewhere else. Should the server follow that, or count the ping as not delivered?

## The decision, in plain words

It follows nothing: the ping goes to the address the server just checked, and an answer that points elsewhere counts as a failed try, so a public link can never lead the server to a private address.

## The intro, for fun

A public link could politely point the server at a private door.

## The punchline, for fun

The server only ever knocks where it checked first.

## The options, in plain words

A. No redirect followed: a redirect counts as a failed try.
B. Follow a few redirects, each hop checked as the first was.

## What I had to decide

The spec says the host is checked again before every ping, which a redirect would defeat, since the next address is never checked. I pin the connection to the address vetted for this try (the certificate and the Host header keep the link's own name), follow no redirect, and treat a 3xx like any other answer that is not a success: a failed try, retried up to three times within about 30 seconds.

## What I did meanwhile

Built the post over node's https with the connection pinned to the checked address and no redirect handling, and tested it on a stand-in for the transport: the response is dropped as soon as its status is read, and a failure says only an error code, never the link.

## What it costs to change later

Following redirects later means vetting each hop with the same rules and a cap on their number; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether apps put their link behind a redirecting front door, which would make every ping fail until they send the final address.
