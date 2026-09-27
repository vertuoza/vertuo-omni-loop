# Linked signature — plan

**PRD:** #215 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/linked-signature` →
`main` (`Closes #215`) · **Sub-PRs:** `feat/linked-signature--<slice>` → the feature branch
(`Part of #215`).

Any decision taken without asking is an outbox item: a medium one is adopted, and a person is informed.

**Build order:**
- **Wave 1 is the tracer.** s1 makes the linked line exist end to end: the `home` key, the footer as
  a `{name}`/`{home}` template defaulting to `🦸 {name} by [Omni Loop]({home}) ©`, the arcade's
  address as `home`'s default, the guard's one exemption and the ADR amending ADR-0002. The hero is
  still `OmniMan` after it, so `omni sign footer` prints
  `🦸 OmniMan by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) ©` and the trailer is
  unchanged.
- **Wave 2** renames the hero (s2): `name` defaults to `Omni-man`, and the tests that pin the
  default trailer move with it. It carries the accepted `omni credits` break (spec, Decision 5) on
  its own, so it can be read and reverted apart from the link.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Omni Loop links home: a `signature.home` key, an absolute `https` URL refused otherwise with an error naming it, defaulting to `https://vertuo-omni-loop-galaxy.vercel.app`; `signature.footer` defaulting to `🦸 {name} by [Omni Loop]({home}) ©`, every `{name}` and `{home}` filled by the signature module before the marker, anything else printed as written; `omni init` writing `home`; `kit/test/no-game-words.test.mjs` exempting that exact address and nothing else, naming the new ADR; a new ADR amending ADR-0002's decision 3; the bundle rebuilt | `kit/lib/config.` `kit/lib/signature.` `kit/lib/init/config-text.` `kit/bin/sign.test.mjs` `kit/bin/init.test.mjs` `kit/test/no-game-words.test.mjs` `.omni-loop/knowledge/adr/` `kit/dist/omni.mjs` | — | 1 |
| s2 | The hero is Omni-man: `signature.name` defaults to `Omni-man`, so `omni sign trailer` prints `Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>` and the default footer names Omni-man; every test pinning the default name or trailer moves to it with its behaviour unchanged; the bundle rebuilt | `kit/lib/config.` `kit/lib/signature.test.mjs` `kit/bin/sign.test.mjs` `kit/bin/init.test.mjs` `kit/bin/phase0.test.mjs` `kit/bin/credits.test.mjs` `kit/lib/credits/reader.test.mjs` `kit/lib/credits/classify.test.mjs` `kit/lib/policy/phase-0.test.mjs` `kit/dist/omni.mjs` | s1 | 2 |

**Shared ground.**
- **`kit/lib/config.`** (the schema and its test), **`kit/bin/sign.test.mjs`**,
  **`kit/bin/init.test.mjs`** and **`kit/lib/signature.test.mjs`** (under s1's `kit/lib/signature.`)
  are declared by both slices: s1 adds `home` and the template, s2 changes the default name those
  same tests pin. s2 is blocked by s1 and sits in wave 2, so they never share a wave.
- **`kit/dist/omni.mjs`** is declared by both: `kit/test/dist.test.mjs` fails unless each slice that
  changes code the bundle holds rebuilds it with `pnpm kit:build`. The waves keep them apart.

## Per slice: done when

**s1 — Omni Loop links home**
- `omni config` with no `signature` section prints `home: https://vertuo-omni-loop-galaxy.vercel.app`
  and `footer: 🦸 {name} by [Omni Loop]({home}) ©` (spec, AC 1 for those two keys).
- `omni sign footer` prints exactly
  `🦸 OmniMan by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) © <!-- omni-loop:signed -->`
  with the defaults; a config setting only `signature.home: https://example.com` links there, the
  trailer unchanged (AC 3, the `home` half).
- A footer with no placeholder prints exactly as written, then the marker; `{name}` or `{home}`
  written twice are both filled; an unknown `{x}` prints as written (AC 4).
- A `signature.home` that is `http`, not a URL, or empty is refused, naming `signature.home`;
  `signature: null` still accepted and both `omni sign` commands print nothing (AC 5).
- The config `omni init` writes carries `home` and the template footer, and parses (AC 6).
- The guard passes on the real kit, bundle included, and its fixture cases show the exact address
  passing, the address plus the word elsewhere on the line failing, and another host holding the
  word failing (AC 7).
- A new ADR under `.omni-loop/knowledge/adr/`, the next free number, amends ADR-0002's decision 3
  with the one exception, and the guard's header comment names it (AC 8).
- `pnpm test` and `omni check all` are green, and `kit/dist/omni.mjs` is rebuilt (AC 9).

**s2 — The hero is Omni-man**
- `omni config` with no `signature` section prints `name: Omni-man`, the email unchanged (AC 1).
- `omni sign trailer` prints exactly
  `Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>`, and
  `omni sign footer` prints exactly
  `🦸 Omni-man by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) © <!-- omni-loop:signed -->`
  (AC 2).
- A config setting only `signature.name: Robo` makes both lines name Robo, the link unchanged
  (AC 3, the `name` half).
- The `omni phase0`, `omni credits` and signature tests pass with the new default trailer, their
  verdicts unchanged: a commit carrying `Co-authored-by: OmniMan <…>` is now another name, and not
  his, as the spec accepts (Decision 5).
- `pnpm test` and `omni check all` are green, and `kit/dist/omni.mjs` is rebuilt (AC 9).
