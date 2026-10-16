---
id: s2-01-mac-memory-pauses
prd: 2102
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

On a Mac, the memory figure counts the memory the system keeps for its own cache as used, so a Mac runner often reads near 90 % used while it is fine, and would pause at the default limit. Should a Mac read its memory another way, or keep the reading the spec gives?

## The decision, in plain words

I kept the reading the spec gives and the default limit of 85 %. A Mac runner that pauses for no reason can be started with a higher memory limit, or with the memory limit switched off, and the page shows why it paused.

## The intro, for fun

A Mac hoards spare memory in its cache and then swears it has none left.

## The punchline, for fun

The runner believes it and takes a nap.

## The options, in plain words

A. Keep the spec's reading and the 85 % default on every platform; a Mac owner raises the memory limit, or sets it to 100 to switch it off.
B. On a Mac, read memory used without the cache (the active and wired memory only), in a follow-up change to the sampler.
C. On a Mac, leave the memory limit off by default, and pause there on disk and load only.

## What I had to decide

Whether a Mac runner reads its memory used as the spec says (all memory minus the free memory) and pauses at the same default limit, or reads it in a way that leaves the cache out.

## What I did meanwhile

pressure() and the pause use the sample s1 built, unchanged: on Linux, memory used is the total minus MemAvailable; elsewhere, the total minus os.freemem(). On the laptop this slice was built on (macOS, 32 GB), that reads 89 % used, so `omni runner` with no flag would pause at once. The kit README says that `--max-memory 100` switches the memory limit off. The command tests and the loop tests sample a fixed machine, never the real one, so they pass on any laptop.

## What it costs to change later

Low. Reading a Mac's memory without its cache is one function in the sampler (parsing `vm_stat`), plus its tests; changing the Mac's default limit is one constant. Nothing is stored differently.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names `total − os.freemem()` for every platform but Linux, and its user stories name Linux runners (vertuo-agents); whether anyone runs a runner on a Mac today is not written anywhere.
