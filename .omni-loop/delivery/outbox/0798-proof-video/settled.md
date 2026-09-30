# Settled outbox items — PRD 798

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-proof-url-shape -->

## s1-01-proof-url-shape — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-proof-url-shape
prd: 798
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The design says proof videos are filmed either on the pull request's preview or on a fixed address, but not which fixed addresses are allowed.

## The decision, in plain words

The setting takes the preview keyword, or any full web address starting with http or https, so a local server on this computer also works. The setting for the preview password only takes the name of a variable, never the password itself.

## The intro, for fun

Where does the camera crew set up?

## The punchline, for fun

Anywhere with a web address, apparently, even the back garden.

## The options, in plain words

A. github-deployment, or any absolute http or https URL (built)
B. github-deployment, or https anywhere and plain http only on the loopback address, as ask.url does
C. github-deployment, or https only

## What I had to decide

Whether a fixed proof address may be plain http on any host, or must be https like the ask page's address.

## What I did meanwhile

Plain http is accepted on any host; the preview keyword and https work as the design says.

## What it costs to change later

A constant: tightening the rule later is one line in the config schema, and no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names github-deployment or a fixed URL, and says nothing about http, localhost or the shape of bypassEnv (author).

```

<!-- /omni-outbox-settled: s1-01-proof-url-shape -->

<!-- omni-outbox-settled: s2-01-upload-mints-run -->

## s2-01-upload-mints-run — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s2-01-upload-mints-run -->
