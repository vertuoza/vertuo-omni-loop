# ADR-0101 — The live OMNI KART race runs over a private Supabase Realtime channel per workspace, each browser owning its own kart

**Status:** accepted · **Date:** 2026-10-11 · **PRD:** #1572

## Context

OMNI KART was raced alone against five CPU karts (PRD 1359). PRD 1572 lets up to four players of one
workspace race COMET RING live, each from their own browser. The galaxy app runs on Vercel, which
holds no long-lived connection, and has no game server. Three transports were weighed: inputs-only
lockstep, an authoritative server, and each browser owning its own kart over a broadcast channel. The
person chose the third.

Supabase Realtime counts every message sent and every message delivered, and the Free plan allows 100
messages a second for the whole project; going over it disconnects the whole project, the approvals
stream included. Nobody knows the plan the galaxy runs on.

## Decision

1. **One private channel per workspace,** named `kart:<workspace id>`. Presence, keyed by the player's
   id, says who is on the grid (name, hero, fleet, best time, arrival). Broadcast, with no echo to its
   sender, carries the race: `start`, `state`, `item`, `hit`, `finish` and `leave`.
2. **Each browser owns its own kart.** It drives it with the single-player rules, sends its state, and
   draws the others' karts from their last state carried forward for at most half a second. A remote
   kart is in the way and is never moved by another screen. **The player hit decides a hit:** a BLOB or
   an ORB hits your kart only on your own browser's word, and your `hit` takes the item off every
   circuit. The first player to arrive starts the race, and the starting order, a race id and a seed
   travel with the `start`, so every player begins from the same grid.
3. **The user's own session, never a secret key** (ADR-0051). The browser joins the private channel
   with the signed-in player's session. Who may join is a policy: the `select` and `insert` policies on
   `realtime.messages` (migration `…_arcade_kart_grid.sql`) let an `authenticated` user receive and send
   Broadcast and Presence on `kart:<workspace id>` only when `public.kart_grid_allows(topic)` is true: a
   `players` row in that workspace and `kart` in their `player_xp.unlocked` there, the check
   `submit_score()` makes. `supabase/checks/kart_grid.sql` proves every refusal (ADR-0028). Only a
   repository opens the channel (ADR-0095): `apps/galaxy/src/data/kart-grid.repository.ts`.
4. **A budget of 80 messages a second, four places.** A race of `n` players costs `n² × rate` messages a
   second, sent and delivered, so the send rate is 10 a second at two players, 8 at three and 5 at four,
   and `n² × rate` never passes 80. The budget and the places are two constants of
   `apps/galaxy/src/arcade/kart/rules.ts`; a test holds the product for every `n` from 1 to the places.
5. **The race time is the browser's word,** sent to `submit_score()` as a solo race sends it. No
   plausibility check is made: that is a PRD of its own.

## Alternatives

- **Inputs-only lockstep:** every browser runs the whole race from everyone's inputs. One slow
  connection stalls everyone, and one floating-point difference between two machines desyncs the race
  for good. Rejected.
- **An authoritative server outside Vercel:** one process runs the race. Fair and cheat-resistant, but
  a new deployment to run and secure, and an ADR of its own. Rejected for this PRD; the constants and
  the messages stay the same if a later PRD adds one.

## Consequences

- No server is added, and no browser drives karts for the others, so there is no host to lose.
- A player can lie about their kart and their time: inside one workspace, the trust the arcade already
  gives a solo time.
- Realtime's quota is the project's, not the arcade's: two workspaces racing four players at once send
  160 messages a second, over the Free plan's 100. A later PRD lowers or raises the two constants once
  the plan is known.
- On a slow connection a remote kart jumps when its next state arrives; it never changes anyone's time.
- A migration adds policies on `realtime.messages` and one function; no row is written, moved or
  deleted. Rolling back is dropping the policies, then the function.
