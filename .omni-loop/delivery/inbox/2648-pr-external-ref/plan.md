# Plan: A pull request carries its issue's external reference

PRD #2648, its spec beside this plan (`spec.md`). The feature branch `feat/pr-external-ref` merges
into `main` with `Closes #2648`; each slice is a sub-PR from `feat/pr-external-ref--<slice>` into
the feature branch, with `Part of #2648`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni ref <issue> --title <t>` reads the issue's first valid `<!-- omni-ref: <ref> -->` marker through `gh` and prints the title and the link formatted by the new config section `pr.ref` (`title`, `none`, `link`; `null` by default), idempotent, `--json`, exit 1 with one line on an unreadable issue; `omni check` refuses a template missing its placeholders | `kit/lib/ref/` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/bin/commands/ref.ts` `kit/bin/commands/index.ts` `kit/bin/omni.ts` `kit/bin/ref.test.ts` `kit/lib/commands.ts` `kit/lib/help/` | — | 1 | build |
| s2 | `/omni:pr` titles a feature, landing or standalone pull request that has an issue with what `omni ref` prints at point `pr.open`: passed to `gh pr create`, or, after a `replace` (`pr.openWith`) opened it, set with `gh pr edit --title` when it differs; its link joins Omni's lines in the body; a sub-PR is never formatted; the guide documents the marker, `pr.ref` and `omni ref` | `kit/plugin/skills/pr/` `kit/porting/plugin--pr.md` `kit/test/skill-steps.snapshot.json` `kit/test/pr-ref` `docs/guide/flow.md` | s1 | 2 | build |
| s3 | `/omni:bug-fix`'s triage comment shows `- **Ref:** <ref>` (or `none`) from `omni ref --json` when `pr.ref` is set, and no line when it is null; it hands `/omni:pr` its issue, so the bug fix's pull request is titled by s2's step | `kit/plugin/skills/bug-fix/` `kit/porting/plugin--bug-fix.md` `kit/test/skill-steps.snapshot.json` `kit/test/bug-fix-ref` | s1 | 3 | light |

**Shared ground.** `kit/test/skill-steps.snapshot.json` (s2, s3): each slice adds the `omni ref`
call to its skill's entry, so s2 takes wave 2 and s3 wave 3, one after the other. `kit/dist/` is
generated: no slice lists it, and the wave rebuilds it once after merging.

## Per slice: done when

### s1

- With `pr.ref` null, `omni ref <issue> --title "fix: x"` prints `title: fix: x` and `link: none`.
- With `pr.ref.title: "[{ref}]-{title}"` and an issue body holding `<!-- omni-ref: ABC-123 -->`,
  `--title "fix(planning): keep the day"` prints `title: [ABC-123]-fix(planning): keep the day`;
  run on that title, it prints it unchanged.
- With no marker, `none: "[NoRef]-{title}"` gives `[NoRef]-…`, and `none: null` the title unchanged.
- `link: "https://tracker.example/{ref}"` prints `link: https://tracker.example/ABC-123`.
- A malformed first marker is skipped for a later valid one; of two valid markers the first counts;
  a ref over 64 characters or with another character is not a marker.
- `--json` prints `{ ref, title, link }`, `ref` null with no marker.
- An issue `gh` cannot read exits 1 with one line naming it.
- `omni check` refuses `pr.ref.title: "[{ref}]"`, a `none` without `{title}` and a `link` without
  `{ref}` or not `https://`, each naming its key.
- `omni help ref` describes the verb. The tests use a fake `gh` and never call GitHub.

### s2

- `/omni:pr`'s **Opening: point `pr.open`** runs `omni ref <issue> --title "<title>"` for a
  feature, landing or standalone pull request with an issue (`--issue` for a bug fix or a visual
  update, the PRD's issue for a feature or landing PR), and passes the printed title to
  `gh pr create`.
- With a `replace`, after the skill printed the pull request's URL, it runs `omni ref` on the
  skill's title and `gh pr edit <n> --title` when the printed title differs; the link line joins
  Omni's lines when it completes the body (its step 3).
- A sub-PR's claim never runs `omni ref`.
- `omni ref` exiting 1 opens the pull request with its title unchanged and says so in one line.
- `docs/guide/flow.md` documents the marker, `pr.ref` and `omni ref` beside `pr.openWith`.
- `kit/test/skill-steps.snapshot.json` lists the new `omni ref` step of `/omni:pr`.

### s3 (light: one line of a skill's template)

- With `pr.ref` set, `/omni:bug-fix`'s triage template has `- **Ref:** <ref>` (or `none`), read
  from `omni ref <issue> --json` when the issue is read.
- With `pr.ref` null, the triage has no **Ref** line.
- Step 12 hands `/omni:pr` its issue (`--issue`), so s2's step titles the pull request.
- `kit/test/skill-steps.snapshot.json` lists the new `omni ref` step of `/omni:bug-fix`.
