---
id: s3-02-manifest-host-placeholder
prd: 28
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Which web address should the app's registration file send GitHub's notifications to, when the hosting project does not exist yet?

## The decision, in plain words

It names the address the hosting project will most likely get. The person who registers the app checks it against the real address first and corrects it if needed.

## The options, in plain words

A. A. The likely hosting address with a note to correct it, as built.
B. B. An obvious placeholder host that registration must replace.
C. C. A custom vertuoza domain chosen now.

## What I had to decide

The spec asks for a committed manifest holding the webhook URL, but the Vercel project is a human step not yet taken, so its production domain is unknown.

## What I did meanwhile

`apps/omni-app/app.yml` points `url` at `https://omni-loop.vercel.app` and `hook_attributes.url` at `https://omni-loop.vercel.app/api/github`, with a comment telling the registrant to replace the host. The shape test checks only that the hook path is `/api/github`.

## What it costs to change later

One constant in `app.yml`, edited before or after registration (the webhook URL can also be changed in the app's settings). No stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The Vercel project's real production domain.
- (author) Whether a custom domain under vertuoza is wanted instead of the hosting default.
