# ADR-0055 — `signature.home` defaults to the Omni Loop domain, and the kit's guards keep no host exception

**Status:** accepted · **Date:** 2026-10-02 · **PRD:** #983 · **Amends:** ADR-0047
(`0047-the-kit-may-carry-the-arcade-s-address-as-signature-home.md`), decisions 1 to 3 ·
**Decided:** @pierrederval via PRD #983's design, 2026-10-02

## Context

ADR-0047 let the kit carry the arcade's production address, `https://vertuo-omni-loop-galaxy.vercel.app`,
as the default of `signature.home`. Because that host holds both the game's word and the
repository's name, it also gave the kit's two guards one exception each:
`kit/test/no-game-words.test.ts` removed the host from a line before looking for the word, and
`kit/test/no-literals.test.ts` removed it from the lines of `lib/config.ts`.

The same app now has its own domain, `https://www.omni-loop.xyz`. PRD 983 moves everything that
names the Omni Loop home onto it, and keeps the vercel.app host serving with no redirect, so links
already posted and the `ask.url` of repositories already installed keep working.

## Decision

1. **`signature.home` defaults to `https://www.omni-loop.xyz`.** `omni init` writes the same
   address as a new repository's `ask.url`, as it wrote ADR-0047's.
2. **The guards keep no host exception.** The new host holds neither the game's word nor the
   repository's name, so ADR-0047's decisions 2 and 3 lapse: `HOME_ADDRESS` and `EXEMPT_VALUES`
   are removed, and the old host is refused in kit code like any other line that holds those words.
3. **ADR-0002's decision 3 reads again without its exception:** "The server is named only in this
   repository's config, never in the kit." The kit carries the Omni Loop domain as a value, which
   names neither the game nor the repository.

## What holds from ADR-0047

- **Decision 4:** the kit never names the game in words.
- **Decision 5:** the kit's own `ask.url` default stays `null`, and `signature.home` is a link a
  reader follows, never a call.

## Consequences

- New installations and every repository that does not set `signature.home` sign with
  `https://www.omni-loop.xyz` from the kit release that carries this change.
- A repository whose config names the vercel.app address keeps working. `docs/guide/troubleshooting.md`
  says how to switch.
- If the domain lapsed, every default link would break. Each repository can still set
  `signature.home`, and the vercel.app host stays as a fallback for as long as the arcade's Vercel
  project keeps it.
