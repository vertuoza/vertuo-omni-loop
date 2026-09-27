---
prd: 215
title: Omni-man by Omni Loop — a linked, configurable signature
blocked-by: none
spec: file
---

# Omni-man by Omni Loop — a linked, configurable signature

**Date:** 2026-09-27 · **PRD:** #215 · **Changes:** the kit (`kit/lib`, `kit/test`,
`kit/dist/omni.mjs`) and one ADR amending ADR-0002; the skills, `omni credits`, the arcade and the
GitHub App do not change

## Problem

PRD #99 made OmniMan sign the loop's work. What he signs with is not what the person wants.

- **The line on pull requests and issues** reads `🦸 Delivered by OmniMan, with Omni Loop`. It
  links nowhere, so a reader who wonders what Omni Loop is has nowhere to go, and it carries no ©.
  The person wants `🦸 Omni-man by Omni Loop ©`, with "Omni Loop" linking to the Omni Loop home page,
  as publicity for the loop.
- **The hero's name is written twice.** `signature.name` names him in the commit trailer, and the
  same name is typed again inside `signature.footer`. Renaming him means editing two keys, and
  forgetting one leaves the commit and the pull request disagreeing on who he is.
- **There is no place for a link.** The config has no key for the home page, so changing where the
  line points means rewriting the whole footer by hand.
- **The name is spelled `OmniMan`.** The person wants `Omni-man`.

## Solution

### The signature

The `signature` config section gains one key, `home`, and `footer` becomes a template over the
other keys. The kit's defaults:

```yaml
signature:
  name: Omni-man
  email: 333776611+omni-loop-invader[bot]@users.noreply.github.com
  home: https://vertuo-omni-loop-galaxy.vercel.app
  footer: "🦸 {name} by [Omni Loop]({home}) ©"
```

- **`name`** is the hero: the commit co-author and, through `{name}`, the footer. Its default is
  `Omni-man`, spelled exactly so. Its shape rule is unchanged: it is refused when it is empty, holds
  a line break, or holds `<` or `>` (BR-PRODUCT-23).
- **`email`** is unchanged: the omni-loop app's bot account, whose avatar GitHub shows.
- **`home`** (new) is where "Omni Loop" links: the arcade's production address by default. It must
  be an absolute `https` URL; anything else (an `http` URL, a bare word, an empty string) is refused
  with an error naming `signature.home`.
- **`footer`** is the wording, as a template. Every `{name}` in it is replaced by `signature.name`
  and every `{home}` by `signature.home`. Anything else, an unknown `{…}` included, is printed as
  written, the way `branches.*` and `prLinks.*` fill `{topic}` and `{prd}`. A footer with no
  placeholder prints exactly as it does today, so a repository that set its own footer sees no
  change. It still only has to be non-empty (BR-PRODUCT-23).
- A repository's `signature` section may set any subset of the keys; each key it leaves out keeps
  the kit's default, as today. Setting only `home` moves the link and nothing else.
- `signature: null` still switches signing off.

**Changing one's mind later** is one edit: the default in `kit/lib/config.mjs` changes it for every
repository using the kit; `signature.name`, `signature.home` or `signature.footer` in a repository's
`.omni-loop/config.yml` changes it for that repository alone.

### What the loop prints

With the defaults:

- `omni sign footer` prints
  `🦸 Omni-man by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) © <!-- omni-loop:signed -->`,
  which GitHub shows as "🦸 Omni-man by Omni Loop ©", "Omni Loop" a link. The hidden marker is
  unchanged.
- `omni sign trailer` prints
  `Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>`.
- **Commits carry no link.** A commit message is plain text on GitHub, where `[Omni Loop](…)` shows
  as written, and the co-author line must stay exactly `Name <email>` for GitHub to show the bot's
  avatar. Only the name in it changes.
- `omni config signature.footer` prints the template as configured; `omni sign footer` prints it
  filled.
- `omni init` writes the section with the four default values, as it writes the three today.

### The kit may carry the arcade's address

The kit never names the game: `kit/test/no-game-words.test.mjs` fails on "galaxy" in any file under
`kit/` that is not a test, and ADR-0002's decision 3 says the game's server "is named only in this
repository's config, never in the kit". The arcade's address,
`https://vertuo-omni-loop-galaxy.vercel.app`, holds the word, so it cannot be `home`'s default
without an exception.

- **A new ADR amends ADR-0002's decision 3.** It adds one exception: the kit may carry the arcade's
  production address as the default of `signature.home`. The kit still never names the game in
  words, and `ask.url` still defaults to `null`. The record takes the next free number under
  `.omni-loop/knowledge/adr/` (0047 when this spec was written), status `accepted`, decided by the
  person in this PRD's design.
- **The guard exempts that exact address and nothing else.** Before a line is tested, each
  occurrence of `vertuo-omni-loop-galaxy.vercel.app` is removed from it; the line fails if the game
  word is still there. Another host holding the word, or the word elsewhere on the same line, still
  fails. The guard names the ADR in its header comment.

## Decisions

1. **"Omni Loop" links to the arcade's production address** (the person, 2026-09-27): its signed-out
   visitors see the attract mode, so it works as a landing page for anyone. Over the GitHub
   repository, which is private and shows a 404 to readers outside the organisation, and the
   omni-loop app's host, which serves only its webhook.
2. **Commits keep the co-author line alone** (the person): no link and no second line in a commit
   message. The link lives on pull requests and issues.
3. **The line is `🦸 {name} by [Omni Loop]({home}) ©`** (the person): the hero emoji kept, the ©
   at the end.
4. **The hero is `Omni-man`** (the person), in the signature only. The arcade's hero sprite, its
   screens and the docs keep "OmniMan".
5. **Renaming breaks `omni credits`' continuity, accepted** (the person). Credits matches a commit by
   its exact trailer line (PRD #99), so the commits signed `Co-authored-by: OmniMan <…>` before the
   merge (12 on `main` when this spec was written) leave the "Co-authored commits on default
   branches" count. Pull requests and PRD issues keep counting through their labels and the marker.
   Credits' matching does not change.
6. **The kit may carry the arcade's address** (the person), by amending ADR-0002, over a redirect
   from the omni-loop app's host and over linking only in this repository.
7. **`footer` is a template over `{name}` and `{home}`,** filled by the kit's signature module, so the
   hero's name is written once. No new rule on its wording: an unknown placeholder prints as
   written, and a footer without `{name}` is allowed.
8. **`home` must be `https`.** It is a public link on every pull request; unlike `ask.url`, it has no
   local `http://127.0.0.1` exception.

## User stories

- As a reader of a pull request or an issue the loop opened, I see "🦸 Omni-man by Omni Loop ©" at
  the end of its description, and clicking "Omni Loop" opens the Omni Loop home page.
- As a person reading a commit the loop made, I see Omni-man as its co-author, with the bot's
  avatar, and no advertising in the message.
- As the maintainer of the kit, I rename the hero, move the link or reword the line with one edit to
  one default, and every repository using the kit follows.
- As the maintainer of one repository, I set `signature.name`, `signature.home` or
  `signature.footer` in its config and only that repository changes.

## Scope

**In:**

- `kit/lib/config.mjs`: the `home` key and its `https` rule; the new defaults for `name` and
  `footer`.
- `kit/lib/signature.mjs`: the footer line fills `{name}` and `{home}` before the marker.
- `kit/lib/init/config-text.mjs`: its comment, if it names the keys; the section it writes comes
  from the schema's defaults, so it gains `home` with no code change.
- `kit/test/no-game-words.test.mjs`: the exemption for the arcade's address, with its fixture cases.
- A new ADR under `.omni-loop/knowledge/adr/` amending ADR-0002's decision 3.
- The tests that pin the old defaults, moved to the new ones with their behaviour unchanged:
  `kit/lib/config.test.mjs`, `kit/lib/signature.test.mjs`, `kit/bin/sign.test.mjs`,
  `kit/bin/init.test.mjs`, `kit/bin/phase0.test.mjs`, `kit/bin/credits.test.mjs`,
  `kit/lib/credits/*.test.mjs` and `kit/lib/policy/phase-0.test.mjs`, where they spell the default
  name or footer.
- `kit/dist/omni.mjs`, rebuilt with `pnpm kit:build`.

**Out:**

- The skills: they print whatever `omni sign trailer` and `omni sign footer` print, and do not change.
- `omni credits`' matching (Decision 5).
- Any link or extra line in commit messages.
- The arcade, its sprites and screens, the docs and the READMEs that say "OmniMan".
- The GitHub App's manifest, and a redirect from its host.
- Rewriting bodies or commits already signed.
- This repository's `.omni-loop/config.yml`: it sets no `signature`, so it takes the new defaults.

## Test seams

All tests run on fixtures and never call GitHub (`omni kb show testing`).

- **The signature module**, a pure unit (`kit/lib/signature.test.mjs`): the footer line with
  `{name}` and `{home}` filled, each placeholder filled wherever it appears, an unknown `{…}` and a
  footer without placeholders printed as written, the marker still last; `null` still gives `null`.
- **The config** (`kit/lib/config.test.mjs`): the four defaults; `home` overridden alone; a `home`
  that is `http`, not a URL, or empty refused, naming `signature.home`; `signature: null` accepted.
- **`omni sign`**, through `main()` on a fixture repository (`kit/bin/sign.test.mjs`): both exact
  lines with the defaults; a config setting only `name`, then only `home`, changes only what it
  names.
- **`omni init`** (`kit/bin/init.test.mjs`): the written section carries `home` and the template
  footer, and parses.
- **The guard** (`kit/test/no-game-words.test.mjs`): its fixture cases gain a line carrying the
  exact address (passes), the address plus the word elsewhere on the line (fails), and another host
  holding the word (fails); the real kit, bundle included, passes.
- **The existing credits and phase-0 tests** keep their behaviour; only the default name and footer
  they spell move.

## Risks

- **A merge publishes the kit.** `kit/dist/omni.mjs` and `kit/plugin` change on merge
  (`omni kb show releasing`), so every repository using the kit signs as Omni-man, with the linked
  line, on its next loop run. Rollback: revert the feature pull request; or set `signature` in one
  repository's config. Bodies and commits already signed keep their old line.
- **`omni credits` loses the old commits** (Decision 5): the co-authored commit count restarts at the
  merge. Accepted.
- **A phase-0 branch open at the merge** whose commits carry `Co-authored-by: OmniMan <…>` fails
  `omni phase0` afterwards, because the check reads today's trailer. Merge open phase-0 pull requests
  before the feature pull request, or re-sign their commits.
- **The arcade's address is now in the kit.** If the arcade moves, every repository's line links to
  a dead page until the default changes or the repository sets `signature.home`.
- **The link is public.** The arcade's signed-out view reads nothing and shows the built-in fleets,
  so the link exposes no workspace data.
- **GitHub search and the hyphen.** `omni credits` searches bodies and commits for the name; GitHub
  may split `Omni-man` into two words and return more candidates. The marker and the exact trailer
  line still decide what counts, so the result is unchanged.

## Acceptance criteria

1. `omni config` in a repository whose config has no `signature` section prints `signature` with
   `name: Omni-man`, the email unchanged, `home: https://vertuo-omni-loop-galaxy.vercel.app` and
   `footer: 🦸 {name} by [Omni Loop]({home}) ©`.
2. In that repository, `omni sign footer` prints exactly
   `🦸 Omni-man by [Omni Loop](https://vertuo-omni-loop-galaxy.vercel.app) © <!-- omni-loop:signed -->`,
   and `omni sign trailer` prints exactly
   `Co-authored-by: Omni-man <333776611+omni-loop-invader[bot]@users.noreply.github.com>`.
3. A config setting only `signature.name: Robo` makes both lines name Robo, the link unchanged; a
   config setting only `signature.home: https://example.com` makes the footer link to
   `https://example.com`, the trailer unchanged.
4. A footer with no placeholder prints exactly as written, followed by the marker; a footer naming
   `{name}` or `{home}` twice has both filled; an unknown `{x}` prints as written.
5. A `signature.home` that is an `http` URL, not a URL, or empty is refused with an error naming
   `signature.home`. `signature: null` is still accepted, and both `omni sign` commands then print
   nothing and exit 0.
6. The config `omni init` writes carries `home` and the template footer with the default values, and
   parses.
7. `kit/test/no-game-words.test.mjs` passes with the arcade's address in `kit/lib/config.mjs` and
   `kit/dist/omni.mjs`, and still fails on the word anywhere else: on the same line as the address,
   or in another host.
8. An ADR under `.omni-loop/knowledge/adr/` amends ADR-0002's decision 3 with the one exception, and
   the guard's header comment names it.
9. `pnpm test` passes, and `kit/dist/omni.mjs` is rebuilt from the changed source.
10. By hand, once merged: the next pull request or issue the loop opens ends with "🦸 Omni-man by
    Omni Loop ©", and "Omni Loop" opens the arcade in a signed-out browser.
