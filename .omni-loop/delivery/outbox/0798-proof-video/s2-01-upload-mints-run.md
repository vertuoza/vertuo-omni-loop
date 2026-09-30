---
id: s2-01-upload-mints-run
prd: 798
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Which step names a new proof run, and how does the page know a run has a moving preview?

## The decision, in plain words

Asking for upload links starts a new run and hands back its number, and a run has a moving preview when a file called preview.gif was uploaded with it.

## The intro, for fun

Every proof run needs a name tag before it walks into the party.

## The punchline, for fun

The door hands out the tags, and the GIF brings its own.

## The options, in plain words

A. The upload call mints the run and a file named preview.gif is the GIF, the option built.
B. The kit mints the run id itself and sends it on both calls, with the GIF named in the register call.

## What I had to decide

The spec's upload call carries no run id, yet files land under <dossier>/<run>/ and the register call sends `run`. Who mints the id, and how a run's GIF is recognised.

## What I did meanwhile

POST /api/proofs/uploads mints a random UUID and answers {run, files: [{name, path, url}]}; POST /api/proofs records `preview.gif` as the GIF when the run's folder holds it; the register call answers the link <origin>/prd/<dossier id>?tab=proof. Scripts upload as text/plain named .ts or .txt; a name whose extension is not its type's is refused 400.

## What it costs to change later

A change of response shape in two routes and s3's client; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s4 reads the Proof tab from ?tab=proof or wants a run named in the link (author)
