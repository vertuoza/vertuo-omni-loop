# Plan: A retro or knowledge PR opens only when it adds lasting knowledge

PRD #487. The spec is `spec.md` beside this plan. The feature branch `feat/retro-worth-it` goes into
`main` with "Closes #487". Each slice is a sub-PR from `feat/retro-worth-it--<slice>` into the
feature branch, with "Part of #487".

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The look rule held once in the kit (`LOOK_RULE`) and quoted by the harvest's classifier; `finishHarvest` returns no edits when no candidate became a register entry or ADR, so no "Stays here" note is written | `kit/lib/knowledge/` `kit/dist/` | — | 1 |
| s2 | The knowledge harvest opens no branch and no PR when there is no promotion, and upserts the `knowledge-verdict` comment on the feature PR through a shared comment helper | `apps/omni-app/src/verdict-comment/` `apps/omni-app/src/knowledge-harvest/` `apps/omni-app/test/harvest-scenario*` | s1 | 2 |
| s3 | The retro's judge: `narrate` sends the knowledge summary, the earlier lessons and the look rule, and its reply carries a verdict and `keep`/`why` per finding; `guard` accepts or drops the verdict | `apps/omni-app/src/retro/narrate*` `apps/omni-app/src/retro/guard*` `apps/omni-app/src/retro/rules*` | s1 | 2 |
| s4 | The retro acts on the verdict in both runs: `gather-knowledge`, PR and issues for kept findings only when worth it, otherwise the `retro-verdict` comment and nothing else; the PRD 438 replay | `apps/omni-app/src/retro/retro*` `apps/omni-app/src/retro/issues*` `apps/omni-app/src/retro/render*` `apps/omni-app/src/retro/publish*` `apps/omni-app/test/retro-scenario*` `apps/omni-app/test/github-replay*` `apps/omni-app/test/fixtures/` | s2, s3 | 3 |

**Shared ground:** none. s1 owns the kit's knowledge folder and the bundle, which it rebuilds
(`kit/test/dist.test.mjs`). s2 and s3 share wave 2 on disjoint paths: s2 the harvest and the new
comment helper, s3 only the retro's `narrate`, `guard` and `rules` files. s4 waits for both: it
calls s2's helper and reads s3's verdict. s4 reads the harvest's tree reader
(`knowledge-harvest/github.mjs` › `withTreeAt`) without changing it.

## Per slice: done when

### s1: the look rule and no promotion, no edits

- `kit/lib/knowledge/look-rule.mjs` exports `LOOK_RULE`, the spec's point 6 text word for word.
- The classifier prompt quotes `LOOK_RULE`; `classify.prompt.snap` is updated and a test asserts the
  prompt contains it.
- `finishHarvest` on candidates all "stays here", "covered" or not placed returns edits for which
  `noEdits(edits)` is true; with one promoted candidate it writes every note, "Stays here" included,
  as today. Both cases are tested in `kit/lib/knowledge/`.
- `kit/dist/omni.mjs` is rebuilt (`pnpm kit:build`) and `pnpm test` passes.

### s2: no knowledge PR without a promotion

- `apps/omni-app/src/verdict-comment/` exports an upsert that finds the comment carrying a given
  marker on a PR and edits it, or creates it when there is none; unit-tested against a stubbed
  GitHub (create, edit in place, never a second comment).
- The harvest function, against a stubbed GitHub, with no promotion: no ref created, no PR opened,
  one comment on the feature PR with `<!-- <markers.prefix>-knowledge-verdict -->` reading
  `Knowledge: nothing new — <n> candidates stayed local.`; replayed, the same comment is edited.
- With one promotion, the branch and PR open as today (the existing harvest tests stay green).

### s3: the judge

- `modelInput` holds the knowledge summary (id and one line per entry), the earlier lessons and
  `LOOK_RULE`; the system prompt names the verdict and the `keep`/`why` fields and asks for new,
  behaviour-only lessons. `JUDGE_VERSION = 1` is exported.
- `checkReply` accepts a reply with `verdict: { worthIt, reason }` and `keep`/`why` per finding,
  and rejects a missing verdict or wrong types (unit tests).
- `guard` drops the verdict, with its reason, when `worthIt: true` has no kept finding, a kept
  finding has no lesson, or `reason`/`why` passes `FIELD_CAPS.reason`/`FIELD_CAPS.why` (unit tests).
- `RULES_VERSION` is unchanged.

### s4: acting on the verdict

- A `gather-knowledge` step reads the knowledge folder and the shipped `retro.json` lessons at the
  merge commit and hands them to `narrate`.
- Against a stubbed GitHub (`retro.test.mjs`):
  - worth it: branch, `retro.md` (kept findings marked, `judge: 1` in the front matter),
    `retro.json`, PR, and issues for kept findings only;
  - not worth it: no ref, no PR, no issue, one comment with `<!-- <markers.prefix>-retro-verdict -->`
    starting `Retro: no new lesson —`, the two timeline lines and one line per finding;
  - no model key: the same, starting `Retro: not judged —`;
  - replayed: the comment is edited in place, never duplicated;
  - day 14 worth it with no merge-run PR: a PR opens; not worth it: the comment is rewritten.
- The PRD 438 replay (#440's merge, a model reply keeping nothing) ends with the verdict comment
  and no PR.
- `render.golden` and `issues.golden` are updated, and `pnpm test` passes.
