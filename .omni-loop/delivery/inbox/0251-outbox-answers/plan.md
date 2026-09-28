# Plan: Answer the outbox anywhere

PRD #251, spec beside this plan (`spec.md`). The feature branch `feat/outbox-answers` merges into
`main` through the feature PR, whose body says `Closes #251`. Each slice is a sub-PR from
`feat/outbox-answers--<slice>` into the feature branch, whose body says `Part of #251`.

This is the second plan for PRD 251. The first build is kept at the tag `archive/outbox-answers-v1`.
s1, s2, s3's cards and s5 port its code where today's `main` still fits it (`git show
archive/outbox-answers-v1:<path>`). Its App relay, `POST /api/outbox` and `dossier_outboxes` are not
ported (spec, Decision 2).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The reply is written once. Covers: the `answers.enabled` switch (default `true`) and `omni init` writing it; the pure reply writer in `kit/lib/outbox/answers.mjs`, proven against `planReplies`; `omni answers ask` and `omni answers post` (with `--print`); the rebuilt bundle | `kit/lib/outbox/answers` `kit/lib/config` `kit/lib/init/config-text` `kit/bin/commands/answers.mjs` `kit/bin/commands/index.mjs` `kit/bin/answers.test.mjs` `kit/bin/init.test.mjs` `kit/dist/omni.mjs` | — | 1 |
| s2 | The terminal door. Covers: `/omni:yolo`'s opening question when its gate ends red and the switch is on (answer here now, answered elsewhere — carry on, later — stop here), asking the human-action and high questions through `omni answers`, posting the reply, carrying on into `/omni:yolo-fix` steps 2 to 7 in the same run, the fallback when posting fails; its porting note and the plugin test | `kit/plugin/skills/yolo/` `kit/porting/plugin--yolo.md` `kit/test/plugin.test.mjs` | s1 | 2 |
| s3 | The Outbox tab shows what is waiting, with the PRD beside it. Covers: the reader keeping the outbox comment's numbering and the pending answers (`planReplies` on the comments it already reads: text, who, when, link, counted); the tab's decision, human-action and answered cards, the Adopted and Settled groups, Select every recommendation (never a human-action), picks kept in the browser, every state of the spec's table (signed-out and non-member read-only included), and the context rail (Before/after, Spec, Brainstorm) wide and its disclosure tall; Send is shown but not yet wired | `apps/galaxy/src/dossier/github/` `apps/galaxy/src/dossier/page/OutboxPane` `apps/galaxy/src/dossier/page/outbox-` `apps/galaxy/src/dossier/page/view` `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/DossierPage` `apps/galaxy/src/dossier/page/demo` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/page.test.ts` `apps/galaxy/src/dossier/page/live` `apps/galaxy/src/dossier/page/dossier.css` | — | 1 |
| s4 | The way to the tab. Covers: `/prd` showing `n open` on each row with open items and the Needs an answer filter (from the cached reader); `/prd/at/<owner>/<repo>/<n>` redirecting to the Outbox tab or not found; the outbox comment's Omni page line with the switch on and `ask.url` set, its porting note and the rebuilt bundle | `apps/galaxy/src/dossier/page/history` `apps/galaxy/src/dossier/page/DossierHistory` `apps/galaxy/app/prd/page.tsx` `apps/galaxy/app/prd/at/` `kit/lib/outbox/comment` `kit/porting/outbox--comment.md` `kit/dist/omni.mjs` | s1, s3 | 2 |
| s5 | Send posts the reply as the person. Covers: the `outbox_sends` migration and `outbox_send_done()`, their access checks and their step in the `supabase` workflow; `POST /api/outbox/send` (member only, picks checked against a fresh read, settled-meanwhile dropped, the reply written by the reply writer, recorded as a send); GitHub's authorisation of the omni-loop App with a nonce; `/prd/github/callback` (nonce and owner checked, code traded, reply posted once, token dropped, outcome recorded, the dossier's cached summary cleared); the tab's Send wired, its result (sent as @login, the link, the next step), an uncounted author reported, and every failure keeping the picks; the two variables in `.env.example` | `supabase/migrations/20261004090000_outbox_sends` `supabase/checks/outbox_sends.sql` `.github/workflows/supabase.yml` `apps/galaxy/src/outbox/` `apps/galaxy/app/api/outbox/` `apps/galaxy/app/prd/github/` `apps/galaxy/src/dossier/page/OutboxSend` `apps/galaxy/src/dossier/page/OutboxPane` `apps/galaxy/.env.example` | s1, s3 | 2 |
| s6 | Written down and seen working. Covers: a decision record for the spec's Decisions 1 to 3; the kit README (the switch, `omni answers`, the end of yolo) and the galaxy README (the tab, `/api/outbox/send`, `/prd/github/callback`, `/prd/at/…`, `outbox_sends`, its two variables and the App's callback URL); the manual acceptance recorded with screenshots in the sub-PR | `.omni-loop/knowledge/adr/` `kit/README.md` `apps/galaxy/README.md` | s2, s4, s5 | 3 |

**Shared ground.** A few prefixes are declared by more than one slice, and the waves keep them apart:

- `kit/dist/omni.mjs` is declared by s1 (wave 1) and s4 (wave 2): each changes the kit's source and
  rebuilds the bundle with `pnpm kit:build` from the merged source, never by hand.
- `apps/galaxy/src/dossier/page/` is split file by file: s3 owns the tab (`OutboxPane`, `outbox-*`,
  the view, the stage, the page and its tests), s4 the list (`history*`, `DossierHistory`), s5 the
  new `OutboxSend` component and `OutboxPane`, where it wires Send. `OutboxPane` is shared by s3
  (wave 1) and s5 (wave 2); s4 does not touch it, so s4 and s5 share wave 2.
- Wave 2 runs s2 (the yolo skill), s4 (the list, the short address, the comment) and s5 (the send)
  together: their territories do not meet.

The migration has one file, timestamped after `20261003090000_own_fleets.sql`. It holds
`outbox_sends` and `outbox_send_done()` only.

The ordering has reasons behind it:
- s2 follows s1: the plugin test refuses a command the CLI does not have.
- s4 follows s1 (the comment reads `answers.enabled`) and s3 (the count comes from the reader's
  open items, the address lands on the tab).
- s5 follows s1 (the reply writer) and s3 (Send is the tab's button, and checks picks against what
  the reader reads).
- s6 follows s2, s4 and s5: it documents both doors as built and carries the manual acceptance.

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

**s3: the Outbox tab shows what is waiting, with the PRD beside it**
- With a fake GitHub (`reader.test.ts`), the summary carries the outbox comment's numbering and one
  pending answer per number from `planReplies`, with its text, who, when, link and whether the
  author counts; the latest reply per number wins; a failed comments read leaves the outbox shown
  and the pending answers unread.
- Component tests cover a decision card (options, A marked built and recommended, the reason, the
  `bears-on` chips, the details disclosure), a human-action card (Done, Not done needing a reason),
  an answered card (what, who, where from the door line, when), and the Adopted and Settled groups.
- Select every recommendation picks A on open decisions and never marks a human-action.
- Each state of the spec's table renders: no outbox yet, nothing open, shipped or closed, GitHub out
  of reach, signed out or not a member (read-only, *Sign in with GitHub to answer here*), and the
  demo with Send off.
- The context rail switches between Before/after (the sandboxed frame), Spec and Brainstorm on a
  wide screen, and sits in a Context disclosure above the questions on a tall one.
- The tab's label still reads `n open`, and the other tabs are unchanged.

**s4: the way to the tab**
- `/prd` shows `n open` on each row whose outbox has open items, and Needs an answer keeps only
  those (`history.test.ts`, `history-render.test.ts`).
- `/prd/at/<owner>/<repo>/<n>` redirects to the dossier's Outbox tab, or answers not found.
- The outbox comment carries the Omni page line with the switch on and `ask.url` set, and not
  otherwise (`kit/lib/outbox/comment.test.mjs`); the porting note records it; the bundle is rebuilt.

**s5: Send posts the reply as the person**
- `supabase/checks/outbox_sends.sql`, run by the `supabase` workflow, proves: a send is read only by
  its owner and inserted only by a member of its dossier's workspace; `outbox_send_done()` records
  an outcome once, for its owner only.
- With a fake GitHub (`send.test.ts`), Send builds the reply from checked picks, drops a pick
  settled meanwhile and says so, refuses a non-member, and records the send.
- A wrong nonce, or another person's send, posts nothing; a replayed callback posts nothing a
  second time; the user token is never written to a cookie, a row or a log.
- A posted reply is recorded with its link and author, the dossier's cached summary is cleared, and
  an `author_association` the kit does not count is reported on the tab.
- Each failure (authorisation refused, GitHub down, no access, the pull request gone) posts
  nothing, keeps the picks and records the error.
- The tab shows *Sent as @login*, the comment's link and `/omni:yolo-fix <n>` with a copy button,
  and the just-sent answers as pending.

**s6: written down and seen working**
- A decision record, numbered as `omni kb show decisions` says, states the spec's Decisions 1 to 3.
- The kit README names the switch, `omni answers` and the end of `/omni:yolo`. The galaxy README
  names the Outbox tab's answering, `/api/outbox/send`, `/prd/github/callback`, `/prd/at/…`,
  `outbox_sends`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET` and the App's callback URL.
- Manual acceptance, recorded with screenshots in the sub-PR:
  - The Outbox tab shows a feature pull request's questions, and a reply typed on GitHub shows as
    pending within a minute.
  - Send posts one reply as the person, and `/omni:yolo-fix` settles it with that reply's link as
    its channel URL.
  - `/omni:yolo` ending red asks the opening question, and answering here settles the answers in
    the same run.
