---
id: s8-02-links-refused-at-send
prd: 2425
slice: s8
rank: medium
bears-on: none
raised: 2026-10-22
wave: 6
---

## The question, in plain words

Besides a host that is not public, which other links should a key be told no to when it sends a job: a link that carries a user name and password, a host name that does not exist yet, or any link at all on a server that has no way to ping?

## The decision, in plain words

All three are refused with a 422 when the job is sent, so the key learns at once that its link could never be pinged, and the job is not queued.

## The intro, for fun

A link that can never be reached is easier to refuse than to wait for.

## The punchline, for fun

The key hears no at the door, not silence three tries later.

## The options, in plain words

A. Refuse all three at send, with a 422 that names the link and says why.
B. Refuse only what the spec names, a host that is not public, and let the rest fail quietly when the ping is tried.

## What I had to decide

The spec refuses a host that resolves to a loopback, private or link-local address, checked again before every ping. It says nothing of a link with credentials in it, a name that does not resolve at send time, or a server wired without a way to ping. I refuse each with a 422 on `notify_url` that says why, and I read every spelling of an address (decimal, hex, short, bracketed, the IPv4-mapped IPv6 form) as the address it is. A log line never says more than the job, the event and the host, since a path or a query may hold a secret.

## What I did meanwhile

The check at send and the check before each ping are the same rules, so a link accepted at send is the link vetted again later. A runners' service built with no notifier refuses every link rather than accept one it cannot ping.

## What it costs to change later

Loosening it is a change to one vetting function: a key that sends a link with credentials or a host that does not exist yet would then be accepted instead of refused, which breaks no client.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an app can create its host name after sending a job and expects the ping to wait for it, which the spec does not say.
