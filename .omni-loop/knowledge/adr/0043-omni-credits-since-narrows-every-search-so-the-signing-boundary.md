# ADR-0043 — omni credits --since narrows every search, so the signing boundary is the first signed item inside the window

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #99 · **Decided:** nobody — adopted when raised (medium), 2026-09-26 · **Merged:** @pierrederval, 2026-09-26, PR #103

## Context

Whether `--since` narrows every query `omni credits` runs, or only some. The spec says `--since` narrows to items created from that month on, and that `--since` and `--repo` narrow the searches so they stay under GitHub's 1,000-result cap (Risks, Search limits). It also says an unsigned pull request is `before signing` or `missed` around its repository's first signed item (How each one is classified). When every search is narrowed, a repository's first signed item before the window is never read, so an unsigned pull request early in the window, created before any signed one inside it, reads as `before signing` although signing had begun.

## Decision

With --since, every pull request and commit search omni credits runs is narrowed to the window, and an unsigned pull request is judged against the first signed item found there. Without --since, the real start of signing is used.

The option chosen: A. A. Narrow every search to the window, and judge against the first signed item inside it, the option built.

## Consequences

Two arguments in `kit/lib/credits/reader.mjs`: leaving `--created` off the body search and `--committer-date` off the commit search reads the signed items of the whole history, at the price of more search results against the cap and the rate limit. No stored data, no migration.

## Source

`.omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md`, entry `s3-01-since-narrows-signing-boundary`
