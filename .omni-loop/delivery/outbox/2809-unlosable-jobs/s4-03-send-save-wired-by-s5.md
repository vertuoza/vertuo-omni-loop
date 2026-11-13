---
id: s4-03-send-save-wired-by-s5
prd: 2809
slice: s4
rank: medium
bears-on: none
raised: 2026-11-13
wave: 3
---

## The question, in plain words

The runner can now send a job's saved work to the app, but the place where a job ends and its folder is cleaned up belongs to another slice of this plan, so nothing calls the send yet. Should the next slice that owns that place (s5) switch it on?

## The decision, in plain words

The send is built and tested on its own, and left switched off: a runner keeps every save on its own disk, as before, until the cleanup calls it. The plan's s5 already changes that same file and needs the saves on the server to restore them.

## The intro, for fun

The parcel is packed, labelled and weighed, but the door it leaves by belongs to the neighbour.

## The punchline, for fun

The neighbour moves in next wave, so we left the parcel by the door with a note.

## The options, in plain words

A. A. Leave switching it on to slice s5, which already changes the runner's cleanup
B. B. Widen this slice to the runner's cleanup and its hourly sweep, and switch the send on now

## What I had to decide

A leaves the call to s5, whose territory holds kit/lib/runner/runner.ts: at cleanUp, after saveJob, call sendSave with checkpointApi(...), the job's handoff note and its tokens, and let the sweep retry a kept save whose manifest has no `sent`. B widens s4's territory now and adds that call here.

## What I did meanwhile

kit/lib/runner/checkpoint.ts exports sendSave(): it asks checkpointApi().link(), puts the bundle, records it portable and marks the runner's own manifest `sent`; a failed save, a bundle over 100 MB, a refused link or a failed upload records it local, saying why; it never throws. Tested on temporary git repositories with a nested worktree (kit/lib/runner/checkpoint.test.ts). runner.ts and sweep.ts are unchanged, so the runner behaves as after s2.

## What it costs to change later

One call in cleanUp and one in the sweep's pass, in s5 or a follow-up slice; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives s4 the upload but gives runner.ts and sweep.ts to s2 and s5 only, so who switches it on is not settled. (author)
- A bundle uploaded whose portable record then fails is recorded local with no storage path: only a forget job that also deletes any bundle 7 days old by its age in the bucket (s6's done-when says so) removes it. (author)
