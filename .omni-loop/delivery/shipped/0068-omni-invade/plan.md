# /omni:invade — plan

**PRD:** #68 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/omni-invade` → `main`
(`Closes #68`) · **Sub-PRs:** `feat/omni-invade--<slice>` → the feature branch (`Part of #68`).

Blocked by PRD 45: the feature branch merges `main` once PRD 45 has shipped, before the first wave,
so every path below exists. Any decision taken without asking is an outbox item.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The rename: `/omni:terraform` becomes `/omni:invade` (the skill folder moves), `branches.terraform` becomes `branches.invade` (default `docs/omni-invade`, the old key refused naming the new one), forms write `invaded:` and `by: invade` and still read the old spellings, `omni check kb` warns on each old spelling, `omni init`'s closing step names `/omni:invade`, and "not terraformed" becomes "not installed" in the config error and every skill's step 0 | `kit/lib/config` `kit/lib/playbook/forms` `kit/lib/playbook/check-playbook` `kit/lib/playbook/write-forms` `kit/lib/init/` `kit/bin/commands/init.mjs` `kit/bin/init.test.mjs` `kit/bin/omni.test.mjs` `kit/bin/kb.test.mjs` `kit/templates/` `kit/plugin/skills/` `kit/porting/plugin--` `kit/test/plugin.test.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | A proposed entry: the register parser reads `Proposed: <who> <date>`; `omni check knowledge` lets a proposed principle go without `Decided:` and a rule serve a proposed principle, and warns once per proposed entry; `laws.floorsHigh` is false for a proposed id; `omni knowledge <id>` prints who proposed it and when; `omni kb status` counts laws and proposals per register folder | `kit/lib/knowledge/` `kit/lib/laws` `kit/lib/playbook/status` `kit/bin/commands/knowledge.mjs` `kit/bin/commands/kb.mjs` `kit/bin/kb.test.mjs` `kit/test/profiles.test.mjs` `kit/porting/knowledge--` `kit/dist/omni.mjs` | — | 2 |
| s3 | `/omni:invade` does the rest: the four exploration facets, the one map checkpoint with its defaults, index entries and drafted entries all proposed, ADRs pointed or copied, the extended config diff with `laws.source`, the one pull request, `--refresh`; `/omni:yolo` prints the proposed count once; `/omni:do-work` never stops on a proposed entry | `kit/plugin/skills/invade/` `kit/plugin/skills/yolo/` `kit/plugin/skills/do-work/` | s1, s2 | 3 |

**Shared ground.** `kit/dist/omni.mjs` is declared by s1 and s2: each slice that changes bundled code
rebuilds it with `pnpm kit:build` and commits it, because `kit/test/dist.test.mjs` fails otherwise.
Waves 1 and 2 keep them apart. When s2's sub-PR conflicts on the bundle after s1 merged, rebuild from
the merged source; never merge two bundles by hand. `kit/bin/kb.test.mjs` is declared by both too: s1
changes its `by: terraform` fixtures, s2 adds its status assertions. `kit/plugin/skills/` is s1's
whole, because the rename touches every skill's step 0; s3 names the three skill folders it extends,
and waits for s1. s2 has no logical dependency on s1; only the shared ground puts it in wave 2.

## Per slice: done when

- **s1:**
  - `omni config` prints `branches.invade: docs/omni-invade` when unset; a config holding
    `branches.terraform` is refused with a message naming `branches.invade`. The config tests say so.
  - A missing config fails with a message saying the repository is not installed.
  - Forms tests: `invaded:` and `by: invade` parse; `terraformed:` and `by: terraform` parse too;
    `omni kb init` writes neither old spelling; `omni check kb` warns once per old spelling, naming
    the file, and exits `0`.
  - `omni init` in a fixture repository prints `/omni:invade` among its closing steps.
  - `kit/plugin/skills/invade/SKILL.md` exists with `name: invade`, carrying PRD 45's terraform steps
    renamed; no `kit/plugin/skills/terraform/` exists; no skill's step 0 says "terraformed".
  - `git grep -i terraform -- kit` finds only the parser's old-spelling reader, `omni check kb`'s
    warning, and their tests. `kit/test/plugin.test.mjs` refuses a skill named `terraform`.
  - `kit/dist/omni.mjs` equals a fresh build; `pnpm test` is green.
- **s2:**
  - Parser tests: an entry with `Proposed: invade 2026-09-25` parses with `proposed: { by: 'invade',
    on: '2026-09-25' }`; a malformed `Proposed:` line is refused naming the file.
  - Checker tests: a proposed principle without `Decided:` and a rule serving it pass with one warning
    per proposed entry; the same principle without `Proposed:` fails for the missing `Decided:`; a
    proposed entry with a dead `Source:` anchor fails.
  - `laws` tests: under `laws.source: knowledge`, `floorsHigh` is false for a proposed id and true once
    its line is removed; `resolve` succeeds for both.
  - `omni knowledge <id>` prints `proposed by invade on 2026-09-25`; `omni kb status` prints the laws
    and proposals count per register folder, and `--json` carries both.
  - `omni check all` stays green on the three profiles in `kit/test/profiles.test.mjs`.
  - `kit/dist/omni.mjs` equals a fresh build; `pnpm test` is green.
- **s3:**
  - `/omni:invade` states: the four exploration facets (domains, written truth, enforced truth,
    decisions and words), each a read-only subagent returning a short report; the one map checkpoint
    with its four kinds of question and their defaults; that nothing is written before the answer;
    index entries with `Source: <path>#<anchor>`; drafted entries when drafting is on; every entry
    `Proposed: invade <date>`; ids numbering on from the file's highest; ADRs pointed or copied,
    never deleted; the config diff with `paths.adr`, `paths.context` and `laws.source`;
    `omni check knowledge` and `omni check kb` green before the one pull request; the pull request
    body's map, holes and proposal counts; `--refresh` re-running only changed facets and never
    touching a confirmed entry; the `by: human` rule.
  - `/omni:yolo` prints `<n> proposed knowledge entries — not laws until confirmed` once at start.
  - `/omni:do-work` says a proposed entry is read like any other, may be an outbox item's `bearsOn`,
    and never stops a slice.
  - `kit/test/plugin.test.mjs` passes: every `omni <command>` the three skills name exists.
