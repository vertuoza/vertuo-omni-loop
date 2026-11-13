---
id: s4-02-upload-link-two-hours
prd: 2809
slice: s4
rank: medium
bears-on: none
raised: 2026-11-13
wave: 3
---

## The question, in plain words

The plan asks for an upload link that works for a few minutes, but the storage service gives every upload link two hours and offers no way to shorten it. Is two hours acceptable for sending a job's saved work?

## The decision, in plain words

The link lives the storage's fixed two hours, and the app says so when it hands it out. It is good for one upload to one place only, cannot replace what is already there, and only the job's own runner gets one.

## The intro, for fun

We asked for a five-minute pass and the storage handed us a two-hour wristband.

## The punchline, for fun

At least the wristband opens exactly one door, once.

## The options, in plain words

A. A. Keep the storage's two-hour upload link, for one upload of one path, and say so in the reply
B. B. Refuse to record a save uploaded more than a set number of minutes after its link was signed

## What I had to decide

A keeps the storage's two hours as built. B shortens it: the app would refuse to record a save whose upload came more than a set number of minutes after its link (a constant in the service), which limits what a late upload can do but not the link itself.

## What I did meanwhile

checkpointsService().link() answers expiresAt two hours after it signs (SIGNED_UPLOAD_MS in apps/galaxy/src/runners/runners.service.ts). The link names one path, <workspace>/<job>/<random id>.bundle, under the private bucket runner-checkpoints; a second upload on it was refused (400) on a local stack, and an anonymous download of the bundle was refused.

## What it costs to change later

A constant in the service and one check before the record: no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Supabase's createSignedUploadUrl (storage-js 2.117.1) takes no lifetime, and the storage service fixes it at two hours: no setting in this repository changes that. (author)
- Whether a two-hour window for one upload of one path is within what the spec's Risks line ('signed links of minutes') meant to promise is the PRD author's call. (author)
