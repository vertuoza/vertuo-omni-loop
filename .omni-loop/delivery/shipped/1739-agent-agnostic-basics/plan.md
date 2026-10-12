# Plan: Agent-agnostic basics

PRD #1739, spec in `spec.md` beside this plan. The feature branch `feat/agent-agnostic-basics` goes
into `main` with `Closes #1739`; each slice is a sub-PR from its slice branch into the feature
branch, with `Part of #1739`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `AGENTS.md` first: `paths.context` defaults to `[AGENTS.md, CLAUDE.md]`, and the invariants heading is read from the first context file that holds it | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/laws.` `kit/lib/init/detect.` `kit/lib/init/config-text.ts` `kit/lib/outbox/outbox.ts` `kit/lib/policy/phase-0.` `kit/bin/init.test.ts` `kit/test/profiles.test.ts` | — | 1 |
| s2 | A session id any agent has: `OMNI_SESSION_ID`, then `CLAUDE_CODE_SESSION_ID`, then the id `omni dossier open` generates and stores per checkout | `kit/lib/env/` `kit/lib/dossier/` `kit/bin/commands/dossier.` `kit/bin/commands/now.ts` `kit/bin/omni.ts` `kit/bin/dossier.test.ts` `kit/bin/now.test.ts` `kit/bin/omni.test.ts` `kit/test/fake-ask-server.ts` `kit/lib/help/entries.ts` `README.md` | — | 1 |
| s3 | Hooks in `.agents/`: the `.claude/` refusal names `.agents/hooks/`, and the flow guide recommends it | `kit/lib/flow/schema.` `docs/guide/flow.md` | — | 1 |

Shared ground: none. The three territories are disjoint, so the three slices build in one wave.
`kit/dist/` is generated: no slice lists or commits it; the wave rebuilds it once after merging.
The tests that read these modules were listed before the territories were cut
(`git grep -l` over the test files): `kit/bin/init.test.ts` and `kit/test/profiles.test.ts` read the
laws and the context default (s1 only); the dossier, now and env tests read the session (s2 only);
`kit/lib/flow/schema.test.ts` reads the refusal (s3 only). `scripts/env-docs.test.ts` reads the root
README's list and needs no edit.

## Per slice: done when

**s1**
- `omni config paths.context` in a repository with no `paths.context` prints
  `["AGENTS.md","CLAUDE.md"]` (`kit/lib/config.test.ts`).
- With `laws.source: claudeMdInvariants` and the invariants heading in `AGENTS.md` only, an ADR it
  lists is a law; with the heading in both files, the first file of `paths.context` holding it is
  read; a `paths.context` without `CLAUDE.md` never reads it (`kit/lib/laws.test.ts`).
- `detectLawsSource` returns `claudeMdInvariants` for a repository whose `AGENTS.md` holds the
  heading, and `omni init` proposes it there (`kit/bin/init.test.ts`).
- `lawsFor` and `detectLawsSource` share one helper; the comments in `config-text.ts`,
  `outbox.ts` and `phase-0.ts` say "the context files", not "CLAUDE.md".
- `laws.claudeMdHeading` and `claudeMdInvariants` keep their names; a config setting them reads.

**s2**
- `readEnv` gives `agentSession` from `OMNI_SESSION_ID` when it is set, from
  `CLAUDE_CODE_SESSION_ID` when only that one is, and none otherwise (`kit/lib/env/read.test.ts`).
- `OMNI_SESSION_ID` is in `VARIABLES` and in the root README's list; `scripts/env-docs.test.ts`
  passes.
- With neither variable, `omni dossier open` sends a generated UUID and writes it to the main
  checkout's `.omni-loop/local/session.json`; a second `open`, and a `push` from a worktree of that
  checkout, send the same id; with `OMNI_SESSION_ID` set, no file is written (`kit/bin/dossier.test.ts`,
  against the fake Omni page).
- `omni now` and the session record in `kit/bin/omni.ts` read the same order (variables, then the
  file), and write nothing.
- The wire field `claudeSessionId` and the draft record's field keep their names.

**s3**
- `hookRefProblem('.claude/hooks/x.md')` returns `.claude/hooks/x.md sits under .claude/, which only
  Claude Code reads — move it to .agents/hooks/, or mark it { path: .claude/hooks/x.md, alias:
  claude }`; `.agents/hooks/x.md` returns `null`; `{ path: .claude/hooks/x.md, alias: claude }`
  still passes (`kit/lib/flow/schema.test.ts`).
- `CLAUDE_ALIAS`'s doc comment says it is for what only Claude Code reads.
- `docs/guide/flow.md` › **Not tied to one agent** recommends `.agents/hooks/`, and its refusal
  example shows the new line.
