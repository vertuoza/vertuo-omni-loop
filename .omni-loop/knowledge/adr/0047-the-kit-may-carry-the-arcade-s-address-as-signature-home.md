# ADR-0047 — The kit may carry the arcade's production address, as the default of `signature.home`

**Status:** accepted · **Date:** 2026-09-27 · **PRD:** #215 · **Amends:** ADR-0002
(`0002-kit-may-depend-on-a-url.md`), decision 3 · **Decided:** @pierrederval via PRD #215's design,
2026-09-27

## Context

ADR-0002 let the kit depend on a URL the game's app serves, and kept one line: the kit never names the
game. Its decision 3 says `kit/test/no-game-words.test.mjs` fails on "galaxy" in any file under `kit/`
that is not a test, and that "the server is named only in this repository's config, never in the
kit".

PRD 215 makes the line the loop signs its pull requests and issues with link to the Omni Loop home
page, as publicity for the loop: a new key, `signature.home`, and a footer that is a template,
`🦸 {name} by [Omni Loop]({home}) ©`. The person chose the arcade's production address,
`https://vertuo-omni-loop-galaxy.vercel.app`, as the page it links to (PRD 215's spec, Decision 1): its
signed-out visitors see the attract mode, so it works as a landing page for anyone, where the GitHub
repository is private and the omni-loop app's host serves only its webhook. For the link to reach
every repository using the kit, the address must be `home`'s default in the kit, and it holds the
game's word. The person chose to amend ADR-0002 (spec, Decision 6), over a redirect from the omni-loop
app's host and over linking only in this repository's config.

## Decision

1. **ADR-0002's decision 3 is amended.** Its last sentence now reads: "The server is named only in
   this repository's config, never in the kit, with one exception: the kit may carry the arcade's
   production address, `https://vertuo-omni-loop-galaxy.vercel.app`, as the default of
   `signature.home`."
2. **The exception is that address, as a whole host, and nothing else.** Before
   `kit/test/no-game-words.test.mjs` tests a line for the word, it removes each whole occurrence of
   the host `vertuo-omni-loop-galaxy.vercel.app` from it. The word elsewhere on the same line still
   fails, and so does any other host that holds it, a longer host holding the address included. The
   guard's header comment names this record.
3. **The repository-literal guard lets the same host through, in `kit/lib/config.mjs` only.**
   `kit/test/no-literals.test.mjs` refuses the repository's name anywhere in the kit's code, and the
   address holds it. It removes each whole occurrence of the same host from a line of
   `lib/config.mjs`, with the same boundary, before testing the line; every other hit, in that file
   or any other, still fails (PRD 215's outbox item `s1-01`, answered A by @pierrederval on
   2026-09-27).
4. **The kit still never names the game in words.** No identifier, comment, message or skill says
   it; the address is carried only as a value.
5. **Nothing else moves.** `ask.url` still defaults to `null`, so ask mode stays off until a
   repository sets it (ADR-0002, decision 4), and the kit still imports nothing from the game and
   reads none of its tables (decision 2). `signature.home` is a link a reader follows, not a call:
   the kit never fetches it.

## What it amends in ADR-0002

- **Decision 3:** its last sentence, as above. Decisions 1, 2 and 4 are unchanged.

## Consequences

- From PRD 215's merge on, every repository using the kit links its pull requests and issues to the
  arcade by default. A repository sets `signature.home` in its config to link elsewhere, or
  `signature: null` to sign nothing.
- If the arcade moves, every line links to a dead page until the kit's default changes or a
  repository sets `signature.home`. The default is one constant in `kit/lib/config.mjs`; changing it
  moves the guard's exempt host with it.
- Removing the game (ADR-0002's first consequence) now also means changing `signature.home`'s
  default, or every repository's line links to a page that is gone.
- The link is public. The arcade's signed-out view reads nothing and shows the built-in fleets, so it
  exposes no workspace data.
