# Settled outbox items — PRD 1023

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s3-01-arcade-omits-keys-it-cannot-widen -->

## s3-01-arcade-omits-keys-it-cannot-widen — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-02
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-02
- Slice: s3
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-arcade-omits-keys-it-cannot-widen
prd: 1023
slice: s3
rank: medium
bears-on: none
raised: 2026-10-02
wave: 1
---

## The question, in plain words

Where the arcade hands an empty value to a shape it does not own, should it leave the value out, or should the owner's shape be loosened?

## The decision, in plain words

The arcade leaves the empty value out at its own call, and the shapes owned by the design library, the galaxy library and outside tools stay as they are. Nothing a person sees changes.

## The intro, for fun

Some boxes the arcade fills belong to the neighbours, and the neighbours were busy that day.

## The punchline, for fun

So the arcade just stopped putting empty things in other people's boxes.

## The options, in plain words

A. Leave the empty value out at the arcade's own call, and keep the package and library types as they are (built).
B. Loosen the sprite and fleet shapes in the design and galaxy packages, and pass the values through unchanged from the arcade.
C. Both: loosen the package shapes in a later slice, then drop the arcade's leave-it-out calls.

## What I had to decide

The spec says widen an optional property to `?: T | undefined` by default and omit a key only on an object that leaves the process. A handful of the arcade's errors sit on types it does not own: `drawSprite`'s options and `SpriteLook` in `packages/design` (s1's territory), `FleetConfig` behind `lookOf` in `packages/galaxy` (s1's), and library types it cannot change: the MCP SDK's `Transport` (its client class declares `sessionId` as `string | undefined`) and its server options (`sessionIdGenerator`), Next's `Link` props (`onClick`) and `RequestInit` in two tests. Widening the package types would step outside `apps/galaxy/`, and the library types cannot be widened at all.

## What I did meanwhile

At each such call the arcade passes only what is defined: `sprite()` in `apps/galaxy/src/arcade/scenes/common.ts` and `Sprite.tsx` spread `tint` only when there is one (and pass `flip ?? false`, the callee's own default); `art.ts` and `DesignScreen.tsx` pass `tint ?? null`, `SpriteLook`'s own default; `fleetOfRow` in `apps/galaxy/src/fleets/store.ts` spreads `label`, `color`, `mascot` and `sort` only when the row has them; `handleMcp` builds its transport with `{ enableJsonResponse: true }` and no `sessionIdGenerator` key (the SDK reads both as stateless); `BrandLogo` spreads `onClick` onto `Link` only when given; the MCP test hands its client a small adapter typed as `Transport`; the request builders in two tests send `body: null` and `signal: null` instead of undefined. Every callee reads these by destructuring or `??`, so no value read changes. The two keys omitted on objects that leave the process: `description` on a guide page's search index entry (`apps/galaxy/src/docs/search.ts`, the static /docs/search JSON) and `why` on a skipped source in the draft's scanned list (`apps/galaxy/src/business/draft/run.ts`, the `p_scanned` argument of business_draft_progress), where JSON already drops an undefined key.

## What it costs to change later

A constant: once `packages/design` and `packages/galaxy` widen these types (`tint?: Tint | undefined`, `FleetConfig`'s optional fields), each call can go back to passing the value as is, a one-line change per call and no stored data touched.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s1 widens `SpriteLook`, `drawSprite`'s options or `FleetConfig` in its own slice was not known while this slice was built (author).

```

<!-- /omni-outbox-settled: s3-01-arcade-omits-keys-it-cannot-widen -->
