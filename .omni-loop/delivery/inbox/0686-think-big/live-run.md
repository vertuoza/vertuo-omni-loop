# Live run: /omni:think-big (PRD 686, slice s4)

**Run on 2026-09-29 and 2026-09-30**, in one Claude Code session on the Claude mobile app, with the
person (the PRD's author) making every pick. The session ran the skill from `feat/think-big`, since
`main` does not carry it until the feature PR merges.

| | link |
| --- | --- |
| PRD | [#686](https://github.com/vertuoza/vertuo-omni-loop/issues/686) |
| feature PR | [#689](https://github.com/vertuoza/vertuo-omni-loop/pull/689), draft, into `main` |
| this slice | [#710](https://github.com/vertuoza/vertuo-omni-loop/pull/710), into `feat/think-big` |
| concept issue | [#722](https://github.com/vertuoza/vertuo-omni-loop/issues/722), `Concept: Ship Receipt`, labelled `omni:concept` |
| concept PR | [#723](https://github.com/vertuoza/vertuo-omni-loop/pull/723), `docs(concept): Ship Receipt`, into `main`, labelled `omni:concept` |

## Before the run

The person created the label `omni:concept` on the repository (`labels.autoCreate` is false here).

## The two gates (acceptance criterion 10)

- **Tweak.** `/omni:think-big 'make the HOME page's footer text a bit larger'`. The skill stated the
  scale as a tweak and the kind as identity, gave the `/omni:visual-fix` line and stopped. **Seen:**
  no issue, branch, worktree, PR or file appeared (the tree stayed clean). The draft dossier printed
  `no sign-in (omni signin)` and opened nothing.
- **Feature.** `/omni:think-big 'export a PRD's dossier as a PDF'`. The skill said plainly that one
  PRD would carry it, and asked one question: `/omni:brainstorm` now, or a lite run. **Seen.** The
  person answered in their own words that they did not want that feature, so the run ended there
  and nothing was written.

## The vast run (acceptance criterion 9)

Brief, in the person's words: *what would have the most impact on addiction and adoption* of the Omni
Loop and the Omni page. The skill asked three questions (the audience: Vertuoza's own teams; the
blockers: heavy to start, nothing pulls back, value not visible) and wrote the brief back.

- **Scale and kind, stated.** Vast, product. **Seen.**
- **Fuel.** A product survey of the repository, and 16 world-class references. **Seen, with a
  limit:** the session's proxy let pages be opened in full only on github.com, so every other
  reference was seen through its search result, and the fuel sheet and `concept.md` say so.
- **Round 1, go wide.** Four concept artists (10×, steal from another industry, delight, contrarian)
  drew eight concepts, each with a card. **Seen:** the moderator sent one back (Morning Docket
  differed only in shade from Mise en Place and Mid-Sentence), and its artist redrew it as Co-op
  Room. The six-member panel (Visionary, Craft, Skeptic, Value, a developer, a PM) was spawned once
  and **continued turn after turn** through the session's agent-messaging tool, six turns in all,
  with no re-spawn. Board 1 showed the eight cards, the median scores with their range, a stance per
  role, the dissent, and what moved in the cross-talk.
- **Panelists answered each other by name.** **Seen**, in every cross-talk: e.g. "→ Craft, on H:
  You're right about the 70% and 40% bars", "→ PM user, on A: you changed my mind". Several changed
  their scores and said why; the Visionary's dissent on where H belonged was kept, then withdrawn
  after seeing the prototype.
- **Round 2, deepen.** The person answered round 1 with *keep A C D E H · merge G→D · merge F→A ·
  kill B*. The panel folded the five into three directions, carrying every kept concept (a split on
  one of them settled by a cross-talk turn, 5 to 1). Three prototypers built **clickable,
  multi-screen prototypes** (Morning Line, One Move to Building, Ship Receipt), checked in headless
  Chromium with no script errors, and the panel scored them as built, Feasibility included.
- **The crown.** The person crowned **R · Ship Receipt**. **Seen:** a 7-step clickable vision tour,
  the panel's verdict with its dissent, and a six-area map in build order. The person kept the six
  areas and added one thing in their own words: a QR code on every receipt, measured or not, that
  opens the PRD's credits. It was folded into the sixth area, renamed `credits-qr`.
- **The record.** The concept issue #722 and the branch `docs/concept-722-ship-receipt` were created,
  and the folder `.omni-loop/delivery/inbox/concepts/0722-ship-receipt/` was committed with
  `concept.md`, `vision.html`, `board-r1.html`, `board-r2.html` (each stamped with the person's
  answer) and `debate.md`. `omni concept 722` printed `ok`, run with this feature branch's kit
  because `main` has no `concept` verb yet; `omni concept 999` printed the missing-folder line, which
  showed that it graded that worktree. `omni check inbox` stayed green. The PR is #723. **Seen.**

## The hand-off into `/omni:brainstorm` (acceptance criterion 11)

**Not run yet.** It reads the concept from `main`, so it waits for a person to merge #723. After that
merge, this record is updated with `/omni:brainstorm --concept 722 receipt-at-merge` (its write-back
of the wedge's brief and the vision) and `/omni:brainstorm --concept 722 nope` (its refusal naming
the area ids).

## What the run taught (findings)

- **Boards need a fallback where scripts do not run.** On the Claude mobile app, the HTML boards and
  the vision tour showed as blank rectangles: the person could not click the reaction toggles or
  step through the tour. The run carried on by giving each round as a plain table in the reply, the
  reactions as a question, and the vision tour as seven phone screenshots. The skill should send a
  plain summary and screenshots beside every board, and never rely on the page's own buttons alone.
- **A question tool holds four options.** The round question could not offer one option per concept;
  it offered the panel's proposed readings plus the person's own words. Worth saying in the skill.
- **Cost.** About twenty agents over the run: four artists, six panelists across six turns, three
  prototypers, two fuel researchers.
- **Before the feature merges, the run needs the feature branch's kit** for `omni concept` and
  `labels.concept`, as the human-action item foresaw.

Everything above was seen in this session; nothing is reported that was not.
