---
name: dossier-push
description: Sends a PRD's spec, plan and before/after page to its dossier on the Omni page, where everyone in the workspace reads every version of each. Runs omni dossier push with the PRD number and prints the dossier's link and the versions added; a file that did not change adds nothing. With --kind visual or --kind bug it sends a fix's folder to that fix's page instead. Never stops the skill that runs it — /omni:brainstorm follows it at steps 7 and 9, and /omni:plan after it pushes plan.md, /omni:visual-fix and /omni:bug-fix after they push the fix branch, each carrying on whatever it prints. Triggers on "push the dossier", "update the dossier", "/omni:dossier-push 7".
---

# Dossier push: a PRD's files to its dossier

`omni` below is `node .omni-loop/bin/omni.mjs`. This skill only runs `omni dossier push` and reports
what it printed. It changes nothing in the repository, and it never stops the skill that runs it:
whatever the command prints, that skill carries on.

The command reads PRD n's folder (inbox or shipped) in the checkout it runs in, and sends whichever
of `spec.md`, `plan.md` and `before-after.html` exist, whole, with the title from the spec's front
matter. The Omni page adds a **version** of a file only when its content differs from that file's
latest version, so pushing the same files twice adds nothing, and pushing after every change is
cheap. The first push numbers the draft `/omni:dossier-open` opened for this idea, when the command
can tell which draft that is (by this Claude session, or as the only draft not numbered yet);
otherwise it finds or creates PRD n's dossier by its number.

With `--kind visual` or `--kind bug` (PRD 627), `<n>` is a fix's issue number, not a PRD's: the
command reads that fix's folder (a visual fix's `before-after.html` and each round of variations,
`variations-r<k>.html`; a bug fix's `bug.md`), titles it after the issue, and finds or creates the
fix's own page, a Visual Update or a Bug Fix. `/omni:visual-fix` and `/omni:bug-fix` run it this way.

## Input

The PRD number, `<n>`, or a fix's issue number with its kind, `<n> --kind visual` or `<n> --kind bug`.
With no number, say that this skill takes one, and go back to the skill that ran it.

## Push

Run it from the checkout or worktree that holds the PRD's files as they were just committed and
pushed:

```bash
node .omni-loop/bin/omni.mjs dossier push <n>
```

For a fix, pass its kind as it was given, `visual` or `bug`:

```bash
node .omni-loop/bin/omni.mjs dossier push <n> --kind <kind>
```

It never blocks: each call to the page has a 5-second limit and one token refresh.

| exit | what you do |
|---|---|
| `0` | Two lines: the dossier's link, then the versions, as `added: spec v2 · unchanged: before-after, plan` (`added: none` when no file changed). Print both as is. |
| `1` | Print every line it printed as is. `too large: <file>`: that file is over 512 KiB and was not sent, while the others went up, so the link and the versions line come first. Otherwise nothing was sent, and the one line says why: `off` (this repository's dossier switch is off, or it has no page address), `no sign-in (omni signin)` (this computer has not signed in to the Omni page, or the sign-in expired: the person runs that command themselves, once, whenever they like; never sign in for them), `unreachable` (the page did not answer in time), or `refused (<status>)` (the page answered with an error; `refused (404)` is a page that does not keep dossiers yet). |
| `2` | The kit is not installed here, its config does not read, PRD n has no inbox or shipped folder in this checkout, or, with `--kind`, issue n has no fix folder of that kind. Print its line as is. |

Print anything else it printed, on either stream, as is. Then go back to the skill that ran this
one, and carry on from where it left: a push that was skipped stops nothing, and the next push sends
every file whole again.

## Never

- Never run it a second time to get past a skip, and never wait for the page.
- Never change a file to make it fit or to make a version: the dossier keeps the files as the
  repository has them.
- Never write, edit or delete anything under `.omni-loop/local/`, nor read or print the sign-in kept
  in the person's home folder: the command owns them.
