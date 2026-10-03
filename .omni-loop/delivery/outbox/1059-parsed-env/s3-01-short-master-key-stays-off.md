---
id: s3-01-short-master-key-stays-off
prd: 1059
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the key that locks each workspace's Jev key is set but has the wrong length, should the arcade refuse to start, or keep running with Jev switched off?

## The decision, in plain words

The arcade keeps running and Jev is off, as before: the settings page says Jev is not available here. Only a setting filled in halfway or one that is not even readable stops the start.

## The intro, for fun

A key one tooth short still fits in the pocket.

## The punchline, for fun

It just will not open anything, and the settings page says so.

## The options, in plain words

A. A key of the wrong length keeps Jev off, as today; only a half-set group or an unreadable value stops the start.
B. A key that is not 32 bytes of base64 is a malformed value: the arcade refuses to start, naming the master key setting.

## What I had to decide

Whether a SECRETS_MASTER_KEY that is set but is not 32 bytes of base64 is a malformed value the startup parse refuses, or stays what the feature reads as off.

## What I did meanwhile

apps/galaxy/src/env.ts reads SECRETS_MASTER_KEY as a plain set-or-unset secret; masterKey in src/jev/secret-box.ts still turns a value of the wrong length or alphabet into null, so Settings › Jev says Jev is not available, as .env.example documents.

## What it costs to change later

Answering B is a refine on the group's schema in src/env.ts (32 bytes once decoded from base64) and two test lines: under an hour, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a malformed value fails at startup, and also that a feature's behaviour when its configuration is set stays as it is; a key of the wrong length sits between the two.
- (author) .env.example and Settings › Jev both document the wrong-length key as Jev not being available.
