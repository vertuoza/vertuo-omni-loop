---
id: s4-01-the-server-event-reuses-the-stage-secret
prd: 1548
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

The web app now tells the GitHub app when a product PRD is approved or its approval is voided. Which shared secret proves the message came from the web app, and where does it send it?

## The decision, in plain words

It signs with the secret the two apps already share for their stage messages, and sends to the GitHub app's production address, written into the web app. Nobody has to set anything new.

## The intro, for fun

Two apps already share one secret handshake, so we taught them a second move with it.

## The punchline, for fun

Same handshake, new dance, and no new key under the doormat.

## The options, in plain words

A. Reuse the stage events' secret and a fixed production address (built).
B. A secret of its own for server events, set in both apps.
C. Reuse the secret, but read the App's address from a new variable, defaulting to production.

## What I had to decide

Confirm reusing STAGE_EVENT_SECRET (galaxy and omni-app already share it, signing in the same x-omni-signature-256 header) for the new server event, and the fixed address https://omni-loop.vercel.app/api/server-event (app.yml's url) in apps/galaxy/src/server-event/server-event.service.ts, rather than a secret and an OMNI_APP_URL of its own.

## What I did meanwhile

galaxy signs { event, dossier, at } with an HMAC-SHA256 of the exact body under serverEnv().stageEventSecret and POSTs it to OMNI_APP_URL + /api/server-event; omni-app verifies it with env.stageEvents.secret and answers 401 to a bad or missing signature. Without the secret galaxy sends nothing and logs one line, and omni-app refuses every event. A preview of galaxy also posts to the production App.

## What it costs to change later

A secret of its own is a new group in both env.ts files, their README and .env.example lists, and a value set in both Vercel projects. An address variable is one group in galaxy's env.ts and its docs; the constant stays as its default.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the event is signed but not with which secret; the PRD, the registers and the glossary name no address for the App on galaxy's side, and galaxy's env.ts (outside this slice) has none.
