---
id: s1-01-device-requests-server-only
prd: 1660
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Who may touch the waiting sign-in requests in the database: only the Omni page's own server, or also a signed-in person directly?

## The decision, in plain words

Only the Omni page's server touches them, with its own clock. Without its private database key the device sign-in is simply off, and the page answers that it is not available.

## The intro, for fun

A sign-in request waits ten minutes in a locked drawer.

## The punchline, for fun

Only one key opens the drawer, and it never leaves the server.

## The options, in plain words

A. A. Server only: every function runs for the service role, with the server's clock; no key, no device sign-in (503).
B. B. The approval step also runs as the signed-in person, so a deployment without the service role key still approves requests.
C. C. As A, and the kit treats 503 like 404: it falls back to the loopback on a page without the key.

## What I had to decide

Keep the requests reachable through the server alone (A), or open the approval step to a signed-in person's own database access (B).

## What I did meanwhile

Built as A: the table is closed to every role, the service role included, and seven functions granted to the service role only are the one way in. Galaxy passes its own clock to each call, so expiry and slow_down are its rules, proven on a fake.

## What it costs to change later

B is a new migration that grants the approve and find functions to authenticated and binds them to auth.uid(): a constant-sized change, no data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The table has two columns the spec does not list: payload_expires_at (a kit token's own expiry, for s3, whose territory has no migration) and poll_interval (the spec's interval, renamed: interval is a SQL type name). (author)
- Without SUPABASE_SERVICE_ROLE_KEY both routes answer 503; the spec's kit falls back to the loopback on 404 only, so s4 should treat 503 the same way or a deployment without the key strands a cloud session. (author)
