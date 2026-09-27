# Plan: Answer the outbox anywhere

PRD #251, spec beside this plan (`spec.md`). The feature branch `feat/outbox-answers` merges into
`main` through the feature PR, whose body says `Closes #251`. Each slice is a sub-PR from
`feat/outbox-answers--<slice>` into the feature branch, whose body says `Part of #251`. It is built
once PRD 216 (PRD dossiers, #219) has merged into `main` and been merged into the feature branch:
s3, s4 and s5 stand on its `dossiers` table, its `/prd/<id>` page and its `dossier_rounds()`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The reply is written once. Covers: the `answers.enabled` switch (default `true`) and `omni init` writing it; the pure reply writer in `kit/lib/outbox/answers.mjs`, proven against `planReplies`; `omni answers ask` and `omni answers post` (with `--print`); the rebuilt bundle | `kit/lib/outbox/answers` `kit/lib/config` `kit/lib/init/config-text` `kit/bin/commands/answers.mjs` `kit/bin/commands/index.mjs` `kit/bin/answers.test.mjs` `kit/bin/init.test.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | The terminal door. Covers: `/omni:yolo`'s opening question when its gate ends red and the switch is on (answer here now, answered elsewhere — carry on, later — stop here), asking the human-action and high questions through `omni answers`, posting the reply, carrying on into `/omni:yolo-fix` steps 2 to 7 in the same run, the fallback when posting fails; its porting note and the plugin test | `kit/plugin/skills/yolo/` `kit/porting/plugin--yolo.md` `kit/test/plugin.test.mjs` | s1 | 2 |
| s3 | The App sends the outbox, the page keeps it. Covers: the App's `issue_comment` event (a pull request's comment re-checks, an issue's or the App's own does nothing); the `relay` step after publish, signed with `OMNI_OUTBOX_SECRET`, sent only with the switch on and `ask.url` on the App's `OMNI_PAGE_URL` host, carrying open, adopted, pending (from `planReplies`) and settled; the last send on close; `POST /api/outbox` (signature, shape, 2 MiB, newer-only, dossier found or created by PRD 216's key); the migration (`dossier_outboxes`, `dossier_outbox_put()`, `outbox_sends`, `outbox_send_done()`, `dossier_list()`'s `open_questions`), its access checks and their step in the `supabase` workflow | `apps/omni-app/src/webhook/` `apps/omni-app/src/outbox-check/` `apps/omni-app/src/relay/` `apps/omni-app/app.yml` `apps/omni-app/test/` `apps/galaxy/src/outbox/` `apps/galaxy/app/api/outbox/` `supabase/migrations/20260929090000_outbox_answers` `supabase/checks/outbox_answers.sql` `.github/workflows/supabase.yml` | s1 | 2 |
| s4 | The Outbox tab, with the PRD beside it. Covers: the fifth tab on `/prd/<id>` (`?tab=outbox`, `n open`), decision, human-action and answered cards, the Adopted and Settled groups, Select every recommendation (never a human-action), every state of the spec's table, the context rail (Before/after, Spec, Brainstorm) wide and its disclosure tall; the `/prd` badge and Needs an answer filter; `/prd/at/<owner>/<repo>/<n>`; the outbox comment's line pointing at it, its porting note and the rebuilt bundle | `apps/galaxy/src/outbox/` `apps/galaxy/src/dossier/` `apps/galaxy/app/prd/` `kit/lib/outbox/comment` `kit/porting/outbox--comment.md` `kit/dist/omni.mjs` | s3 | 3 |
| s5 | Send posts the reply as the person. Covers: `POST /api/outbox/send` (picks checked against the stored outbox, settled-meanwhile dropped, the reply written by the reply writer, recorded as a send); GitHub's authorisation of the omni-loop App with a nonce; `/prd/github/callback` (nonce and owner checked, code traded, reply posted once, token dropped, outcome recorded); the tab's Send button, its result (sent as @login, the link, the next step), an uncounted author reported, and every failure keeping the picks | `apps/galaxy/src/outbox/` `apps/galaxy/app/api/outbox/` `apps/galaxy/app/prd/` | s4 | 4 |
| s6 | Written down and seen working. Covers: a decision record for the spec's Decisions 1 to 3; the kit README (the switch, `omni answers`, the end of yolo), the App README (the event, the relay, its two variables and the settings a person changes) and the galaxy README (the tab, the routes, the tables, its four variables); the manual acceptance recorded with screenshots in the sub-PR | `.omni-loop/knowledge/adr/` `kit/README.md` `apps/omni-app/README.md` `apps/galaxy/README.md` | s2, s5 | 5 |

**Shared ground.** A few prefixes are declared by more than one slice, and the waves keep them apart:

- `kit/dist/omni.mjs` is declared by s1 (wave 1) and s4 (wave 3): each changes the kit's source
  and rebuilds the bundle with `pnpm kit:build` from the merged source, never by hand.
- `apps/galaxy/src/outbox/` is declared by s3, s4 and s5, in waves 2, 3 and 4: s3 writes the route
  and the store, s4 the tab, s5 the send.
- `apps/galaxy/app/api/outbox/` is declared by s3 (the outbox route) and s5 (the send route), in
  waves 2 and 4.
- `apps/galaxy/app/prd/` is declared by s4 (the tab and `/prd/at/…`) and s5 (the callback), in
  waves 3 and 4.
- Wave 2 runs s2 (the yolo skill) and s3 (the App, the route and the migration) together: their
  territories do not meet.

The migration has one file, timestamped after PRD 216's `20260928110000_dossier_list.sql`, and
holds both tables and their functions, as the spec says. s5 adds no migration.

The ordering has reasons behind it:
- s2 and s3 follow s1: the plugin test refuses a command the CLI does not have, and the App reads
  `answers.enabled` through the kit's config schema.
- s4 follows s3: the tab reads the stored outbox and `dossier_list()`'s open count.
- s5 follows s4: Send is the tab's toolbar button, and it checks picks against the outbox s3 stores.
- s6 follows s2 and s5: it documents both doors as built and carries the manual acceptance.

## Per slice: done when

**s1: the reply is written once**
- `answers.enabled` defaults to `true`, a non-boolean is refused (`kit/lib/config.test.mjs`), and
  `omni init` writes `answers: { enabled: true }` into a new config (`kit/bin/init.test.mjs`).
- The reply writer writes each pick's line in number order (`1: A`, `2: B because …`, `19: ok`,
  `19: no, because …`, `5: <text>`), then an empty line and the door's line, and refuses an
  unknown number, a letter not offered, `done` on a decision, a letter on a human-action and
  `not-done` without a reason.
- A reason with newlines, `<!--`, `-->` and 600 characters becomes one clean line of 500.
- Whatever the writer writes, `planReplies` reads back as the same verdict and text, for every
  kind of pick, and a reply answering several numbers answers each of them.
- Through `main()` on a fixture repository with a fake comment client, `omni answers ask` takes the
  numbers from the outbox comment's marker, batches at most four, puts human-action first, leaves
  mediums out, and exits 1 with one line when nothing is open or the switch is off.
- `omni answers post` posts once and prints the link, `--print` posts nothing, a refused pick exits
  1 and posts nothing, and a failed post exits 1 and prints the reply.
- `no-literals` and `no-game-words` stay green, `pnpm test` is green, and the bundle is rebuilt.

**s2: the terminal door**
- `/omni:yolo`'s red-gate path, with the switch on, asks the opening question only after the
  outbox comment, the draft PR and the status comment are written, with the three choices.
- *Answer here now* runs `omni answers ask`, asks each batch through `AskUserQuestion` (Other as a
  reason or a prose answer), posts with `omni answers post`, then follows `/omni:yolo-fix` steps 2
  to 7. *Carry on* follows them at once. *Later* stops as today.
- A failed post prints the reply to paste and stops at the red-gate report; with no `gh`, the skill
  posts the `--print` output with the session's own GitHub tools.
- With the switch off, the skill's red-gate path reads as it does today.
- The porting note records the change, and `kit/test/plugin.test.mjs` proves the skill names
  `omni answers`, the three choices and the yolo-fix steps; `no-game-words` and `no-literals` stay
  green.

**s3: the App sends the outbox, the page keeps it**
- Against a stubbed GitHub, `issue_comment` on a pull request re-runs the check, and one on an
  issue, or written by the App, does not; `test/app-yml.test.mjs` lists `issue_comment` and nothing
  else new.
- After publish, the relay sends a body built from what the check evaluated (open, adopted,
  pending from `planReplies`, settled), signed with the secret. It sends nothing with the switch
  off or `ask.url` on another host, and a failed send never changes the conclusion or the comment.
  A merged pull request gets its last send with `merged`.
- `POST /api/outbox` (fake store, the `world()` pattern) stores a good body and answers the Outbox
  address; answers 401 on a bad signature, 400 on a malformed body, 413 over 2 MiB, 404 with no
  workspace for the owner; keeps the stored outbox on an older `evaluatedAt`; and finds or creates
  the dossier by its key.
- `supabase/checks/outbox_answers.sql`, run by the `supabase` workflow, proves: a member reads an
  outbox and a member of another workspace reads nothing; nobody writes `dossier_outboxes`
  directly; `dossier_outbox_put()` refuses an older evaluation; a send is read only by its owner and
  inserted only by a member of its dossier's workspace; `outbox_send_done()` records an outcome
  once, for its owner only; `dossier_list()` returns `open_questions`.

**s4: the Outbox tab, with the PRD beside it**
- `/prd/<id>?tab=outbox` shows `Outbox` with `n open` in its label, after Questions; the first tab
  is still Before/after.
- Component tests cover a decision card (options, A marked built and recommended, the reason, the
  `bears-on` chips, the details disclosure), a human-action card (Done, Not done needing a reason),
  an answered card (what, who, where, when), and the Adopted and Settled groups.
- Select every recommendation picks A on open decisions and never marks a human-action.
- Each state of the spec's table renders: no outbox, nothing open, merged or closed, the read
  failed, and the demo with Send off.
- The context rail switches between Before/after (the sandboxed frame), Spec and Brainstorm on a
  wide screen, and sits in a Context disclosure above the questions on a tall one.
- `/prd` shows `n open` and filters on Needs an answer. `/prd/at/<owner>/<repo>/<n>` redirects to
  the Outbox tab, or answers not found.
- The outbox comment carries the Omni page line with the switch on and `ask.url` set, and not
  otherwise (`kit/lib/outbox/comment.test.mjs`); the porting note records it; the bundle is rebuilt.

**s5: Send posts the reply as the person**
- With a fake GitHub, Send builds the reply from checked picks, drops a pick settled meanwhile and
  says so, and records the send.
- A wrong nonce, or another person's send, posts nothing; a replayed callback posts nothing a
  second time; the user token is never written to a cookie, a row or a log.
- A posted reply is recorded with its link and author; an `author_association` the kit does not
  count is reported on the tab.
- Each failure (authorisation refused, GitHub down, no access, the pull request gone) posts
  nothing, keeps the picks and records the error.
- The tab shows *Sent as @login*, the comment's link and `/omni:yolo-fix <n>` with a copy button,
  and the just-sent answers as pending until the next outbox arrives.

**s6: written down and seen working**
- A decision record, numbered as `omni kb show decisions` says, states the spec's Decisions 1 to 3.
- The kit README names the switch, `omni answers` and the end of `/omni:yolo`. The App README names
  the event, the relay, `OMNI_PAGE_URL` and `OMNI_OUTBOX_SECRET`, and the App settings a person
  changes (the callback URL, user authorisation, the `issue_comment` event). The galaxy README names
  the Outbox tab, `/api/outbox`, `/api/outbox/send`, `/prd/at/…`, the two tables and its four
  variables.
- Manual acceptance, recorded with screenshots in the sub-PR:
  - A push to a feature pull request shows its questions on the Outbox tab within a minute.
  - Send posts one reply as the person, and `/omni:yolo-fix` settles it with that reply's link as
    its channel URL.
  - A reply typed on GitHub shows as pending on the tab.
  - `/omni:yolo` ending red asks the opening question, and answering here settles the answers in
    the same run.
