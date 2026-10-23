# Plan: Broke main, a shipped PRD's status on main and the rewind that finds why

PRD #2410, its spec beside this plan (`spec.md`). The feature branch `feat/broke-main` merges into
`main` with `Closes #2410`; each slice is a sub-PR from `feat/broke-main--<slice>` into the feature
branch, with `Part of #2410`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The database holds each shipped PRD's watch per repository, the signals that broke it and the rewind's findings; members read them, only the service role writes, and a member approves or rejects a proposed finding once, through a function that logs its event; the app may send a `/omni:rewind` job | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/src/main-watch/main-watch.migration.test.ts` | — | 1 | deep |
| s2 | When a feature PR merges, the Omni App watches main for seven days in every repository the PRD merged into: a red job on the merge commit, a revert of one of its pull requests or a regression traced to it marks the watch broke, seven quiet days mark it clean, a refused read keeps it watching, and the first break queues one `/omni:rewind <n>` job sent by the app; `mainWatch.enabled: false` opens no watch | `apps/omni-app/src/main-watch/` `apps/omni-app/src/functions.ts` `apps/omni-app/src/functions.test.ts` `apps/omni-app/src/webhook/` `kit/lib/config.ts` `kit/lib/config.test.ts` | s1 | 2 | deep |
| s3 | A shipped PRD's page says in its head Watching · n days left, Clean, Broke main or Could not check, and its Main tab lists what broke, each with its link, and says that no rewind ran yet, with the `/omni:rewind <n>` line | `apps/galaxy/src/main-watch/` `apps/galaxy/src/dossier/page/MainPane` `apps/galaxy/src/dossier/page/DossierPage` `apps/galaxy/src/dossier/page/view` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/src/dossier/page/PinnedHead` | s1 | 2 | build |
| s4 | `/app/engineering`'s Loop health says, for the period, how many PRDs broke main out of those whose watch ended, the ones still watched counted apart, and lists those that broke, each linking its page | `apps/galaxy/src/engineering/` | s1 | 2 | build |
| s5 | `omni rewind facts <n>` prints a PRD's watch and breaks, `omni rewind push <n>` sends findings to the PRD's page and is refused a finding with no evidence, an unknown origin or one already proposed, and the Main tab lists the findings, each with its check, where it started, what happened and its fix | `apps/galaxy/app/api/rewind/` `apps/galaxy/src/rewind/` `apps/galaxy/src/dossier/page/MainPane` `kit/bin/commands/rewind.ts` `kit/bin/commands/index.ts` `kit/bin/rewind.test.ts` `kit/lib/rewind/` `kit/lib/help/entries` | s1, s3 | 3 | build |
| s6 | `/omni:rewind <n>` walks a PRD that broke main back from the break through the seven checks to the spec, names the one cause and where each finding started, with the strongest-level fix, pushes them with `omni rewind push`, writes nothing to the repository and never merges; a runner may run it, and `/omni:knowledge-add` too | `kit/plugin/skills/rewind/` `kit/test/rewind-skill.test.ts` `kit/lib/runner/line` `apps/galaxy/src/runners/runners.contract` `kit/lib/help/entries` `docs/guide/` | s5 | 4 | deep |
| s7 | On the Main tab a member approves or rejects each proposed finding, once: Approve queues `/omni:bug-fix` or `/omni:knowledge-add` sent by that member, files a glossary or Legal finding as a product knowledge proposal, or opens one issue on the kit's repository with the card's text; Reject keeps it with its reason, and it is never proposed again | `apps/galaxy/app/api/rewind/` `apps/galaxy/src/rewind/` `apps/galaxy/src/dossier/page/MainPane` `apps/galaxy/src/github-call-sites.test.ts` | s5, s6 | 5 | deep |

**Shared ground.** `apps/galaxy/src/dossier/page/MainPane` is declared by s3, s5 and s7, and
`apps/galaxy/app/api/rewind/` and `apps/galaxy/src/rewind/` by s5 and s7: s3 draws the tab and its
breaks, s5 adds the findings list, s7 the Approve and Reject buttons, in waves 2, 3 and 5.
`kit/lib/help/entries` is declared by s5 (the `omni rewind` commands) and s6 (the `/omni:rewind`
skill), in waves 3 and 4. `apps/galaxy/src/main-watch/` holds s1's migration test and s3's reads, in
waves 1 and 2. s7 waits for s6 because s6 puts `knowledge-add` among the skills a runner may run,
which s7's Approve queues. `kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them,
and the wave rebuilds them once.

## Per slice: done when

### s1 (deep: row-level security and a one-time decision)

- A migration dated after the newest on `main` creates `prd_main_watch`, `prd_main_breaks` and
  `rewind_findings` as the before/after page draws them, and its header names its rollback (a
  follow-up migration drops the three tables, which nothing else reads).
- A break's key includes its source (run id, revert SHA or issue number), so a replayed signal adds
  no row; a finding without an evidence link is refused by the table.
- `rewind_finding_approve` and `rewind_finding_reject` let a member of the workspace decide a
  `proposed` finding once, record who and when, and append the decision's event in the same
  transaction; a second decision, or a non-member, is refused (42501).
- The app-sent job rule accepts a `/omni:rewind <n>` line as it accepts `/omni:retro-apply`.
- A check under `supabase/checks/`, its own step of the `supabase` workflow, proves members read
  the three tables, nobody signed in writes them directly, and only the functions decide a finding.
- `supabase/database.types.ts` holds the new tables and functions.

### s2 (deep: event ordering, replays and a seven-day clock)

- Against a stubbed GitHub, as `apps/omni-app/src/retro/retro.test.ts` runs the retro:
  - a feature PR's merge opens one watch row per repository it merged into, targets included;
  - a red job on the merge commit makes it `broke`, a red a re-run turned green too, and the
    parent commit's result is kept with the break;
  - a revert naming the feature PR or a sub-PR makes it `broke`;
  - an issue opened within the seven days naming the PRD, or whose triage or regression label names
    one of its pull requests, makes it `broke`; one opened on day eight changes nothing;
  - seven days with no signal make it `clean`, on the daily tick the retro already uses;
  - a refused read keeps it `watching`, its unread signal named;
  - a replayed event writes nothing new;
  - the first break queues exactly one `/omni:rewind <n>` job, sent by the app, for the
    installation's workspace only.
- With `mainWatch.enabled: false` in the config at the merge, no watch opens; the config refuses a
  value that is not a boolean.
- The existing retro's tests pass unchanged.

### s3

- On a shipped PRD's page the facts strip shows Main: Watching · n days left, Clean, Broke main or
  Could not check, read from `prd_main_watch` as the signed-in member; a PRD not shipped shows none.
- The Main tab lists each break with its kind (CI red, reverted, regression) and its link, and the
  parent's result beside a CI red.
- With no finding yet it says "No rewind yet" and the `/omni:rewind <n>` line.
- Component tests cover the four states and the empty tab; the demo dossier shows a broken PRD.
- The new words (Broke main, main watch, rewind) are proposed as product glossary terms.

### s4

- Loop health › In the period shows `<k> of <m> PRDs broke main · <p>%` for the PRDs merged in the
  period whose watch ended, then `<w> more still watched`, then the list of those that broke, each
  linking its PRD page with what broke.
- With no PRD whose watch ended, the line is left out; tested with none, some and every PRD broken.
- A repository's page narrows the count to that repository.

### s5

- `omni rewind facts <n>` prints the PRD's status per repository and each break, and says when the
  PRD has no watch; tested through `main()` on a fixture repository.
- `omni rewind push <n> --file <findings.json>` sends findings; it refuses, naming the finding, one
  with no evidence link, an origin other than `repository`, `omni-setup` or `knowledge`, a check
  other than the eight, and a finding already proposed (same check, origin and evidence).
- The endpoints answer only an agent link or a member of the PRD's workspace.
- The Main tab lists the findings under the breaks, each with its check, where it started, what
  happened, its evidence links and its fix.
- `omni help rewind` explains both commands.

### s6 (deep: the skill's judgment rules)

- `kit/plugin/skills/rewind/SKILL.md` runs the seven checks in order (reviews, CI, PR bodies against
  the `pull-requests` form, waves, the plan, the spec and its answers, the knowledge), starts from
  the break, writes the premise every failed fix assumed and tests it before naming a cause, names
  each finding's origin, and for a repository finding the strongest level that would have stopped
  it: architecture, types, a lint, a test, docs last.
- It writes nothing to the repository, merges nothing, and signs every finding as written by an
  agent; `kit/test/rewind-skill.test.ts` holds it to that, as `retro-apply-skill.test.ts` does.
- `rewind` and `knowledge-add` are skills a runner may run (`kit/lib/runner/line`, the galaxy's
  runner contract).
- `omni help` and the guide's skill list name `/omni:rewind`.

### s7 (deep: a decision that sends work, once)

- Approve and Reject show on each proposed finding of the Main tab for a member; a decided finding
  shows who decided it and when, and no button.
- Approve on a `repository` finding queues `/omni:bug-fix '<the finding>'` sent by the member; on a
  `knowledge` finding about the glossary or a Legal entry, files a product knowledge proposal; on
  another `knowledge` finding, queues `/omni:knowledge-add '<the finding>'` sent by the member; on an
  `omni-setup` finding, opens one issue on the kit's repository holding exactly the card's text.
- Reject keeps the finding with its optional reason; `omni rewind push` refuses the same finding
  again.
- A second Approve or Reject is refused, and nothing is queued twice; tested at the route and the
  service, the GitHub call listed in `github-call-sites.test.ts`.
