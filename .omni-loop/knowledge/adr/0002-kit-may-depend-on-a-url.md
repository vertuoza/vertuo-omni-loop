# ADR-0002 — The kit may depend on a URL the game's app serves, and still never names the game

**Status:** accepted · **Date:** 2026-09-25 · **PRD:** #71 · **Amends:** PRD 3's spec
(`.omni-loop/delivery/shipped/0003-omni-loop-kit/spec.md`), §2 principle 7

## Context

PRD 3's principle 7 reads: "**The game stays a projection** of what this kit writes, and the kit never
mentions the game." The kit writes; the game only reads what it wrote, and the kit knows nothing of it.

Ask mode (PRD 71) puts the questions Claude asks through `AskUserQuestion` on a web page. The page
needs a host, a sign-in restricted to the crew and a small database. The galaxy app (`apps/galaxy`)
already has all three: a Google sign-in (`hd=vertuoza.com`, `is_crew()`), a Supabase project and a
Vercel deployment. The person chose to host the page there, over a separate project or the
`omni-loop` GitHub App's server (spec, Decision 3). The kit's hooks and CLI must then call the
game's app: a dependency principle 7 did not foresee, in the direction it forbade.

## Decision

1. **Principle 7 is amended.** It now reads: "The game stays a projection of what this kit writes, and
   the kit never mentions the game. The kit may depend on a URL the game's app serves, through a
   contract any other server could honour."
2. **The contract is the only coupling.** The kit knows one config key, `ask.url`, and the calls
   PRD 71's spec lists under "The contract": the `/ask/signin` page, `/api/ask/token`, and the
   session and round calls under `/api/ask/*`, each with a bearer token. The kit imports nothing from
   `game/`, `packages/` or `apps/galaxy`, reads none of the game's tables, and writes no ledger event.
   The hooks and the CLI would work unchanged against any server that honours the contract; the
   kit's own tests run them against a fake one (`kit/test/fake-ask-server.mjs`).
   Since PRD 144, `POST /api/ask/sessions` takes an optional `context: {repo}` and
   `POST /api/ask/sessions/:id/rounds` an optional `context` — `{repo, branch, prd,
   claudeSessionId, skill, model, tokens}`, each field null when the kit could not read it. Only
   names and counts leave the machine, never transcript text, and the kit holds no price. An older
   kit sends neither and keeps working; a server that ignores the field still honours the contract.
   The galaxy's own pages add calls the kit never makes: `POST /api/ask/rounds/:id/shares` (the
   owner shares a round with a member of the session's workspace; any round may be shared, and an
   answered one is then read-only), `PATCH /api/ask/rounds/:id/category` and
   `DELETE /api/ask/sessions/:id`. An answer to a round that is no longer open returns 409 with
   `answeredBy {id, name}` and `via` (page or terminal): the first answer wins (PRD 144, item s4-03).
3. **The kit still never names the game.** `kit/test/no-game-words.test.mjs` fails on "galaxy" in any
   file under `kit/` that is not a test, the plugin's skills and hooks included. It sits next to the
   fuller list of game words `kit/lib/outbox/banter.test.mjs` keeps for the outbox's fun lines. The
   server is named only in this repository's config, never in the kit.
4. **`ask.url: null` switches ask mode off cleanly,** and it is the default. With it, `omni ask on`,
   `omni signin`, `omni signout` and `omni whoami` exit 1 with one line ("ask mode is not set up for
   this repository (ask.url)"), the hooks stay silent, and `AskUserQuestion` behaves exactly as it
   does without the kit. A repository that sets it opts in; this one sets it to the galaxy app's
   production address.

## Consequences

- Removing the game removes ask mode, and nothing else: set `ask.url` back to `null` and every
  other command of the kit is unchanged.
- A change to the contract is a change on both sides at once. It is made by amending PRD 71's spec,
  never by one side alone.
- While the mode is on, the page depends on the app being up. When it is not, the question shows in
  the terminal as it always did: the mode never blocks a session.
- Principle 1 (removable) holds. Ask mode's state in a checkout sits in `.omni-loop/local/`, inside the
  footprint and ignored by its own `.gitignore`. The sign-in sits in the person's home folder
  (`~/.config/omni/credentials.json`, mode 0600), outside every repository.
