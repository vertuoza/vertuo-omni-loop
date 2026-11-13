# ADR-0117 — The runner reads memory the spec's way on every platform, with one 85 % default limit

**Status:** adopted · **Date:** 2026-10-16 · **PRD:** #2102 · **Decided:** nobody — adopted when raised (medium), 2026-10-16 · **Merged:** @pierrederval, 2026-10-16, PR #2106

## Context

Whether a Mac runner reads its memory used as the spec says (all memory minus the free memory) and pauses at the same default limit, or reads it in a way that leaves the cache out.

## Decision

The runner counts memory used as total minus free memory (MemAvailable on Linux, os.freemem() elsewhere) and pauses at the same 85 % default on every platform. A Mac owner whose cache reads as used raises --max-memory, or sets it to 100 to switch the memory limit off.

The option chosen: A. Keep the spec's reading and the 85 % default on every platform; a Mac owner raises the memory limit, or sets it to 100 to switch it off.

## Consequences

Low. Reading a Mac's memory without its cache is one function in the sampler (parsing `vm_stat`), plus its tests; changing the Mac's default limit is one constant. Nothing is stored differently.

## Source

`.omni-loop/delivery/shipped/2102-runner-health/outbox/settled.md`, entry `s2-01-mac-memory-pauses`
