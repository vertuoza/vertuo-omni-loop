---
name: mission
description: Settles a mission with a person — the Virtual Fleet that takes it, its goal, its measures, its scope of PRDs and roadmaps and its mandate, one question at a time — then writes its brief, mission.md (the front matter the kit's schema reads) and mission.html (self-contained, under the before/after page rules, marks and word pass included), under the missions folder of the delivery folder, opens the mission's issue and its docs pull request, and sends the brief to the mission's page with omni mission push. With --prd and a goal it asks nothing and writes the minimal mission, that PRD as its scope. Writes no code, never merges, and starting the mission never waits for the pull request. Triggers on "start a mission", "give this goal to a fleet", "a mission for PRD 2803", "/omni:mission".
---

# Mission: a goal a Virtual Fleet delivers

A **mission** is a goal, not a container: one sentence of what changes and for whom, 1 to 5
measures that tell it worked once deployed, the Virtual Fleet that takes it, a scope of PRDs and
roadmaps of this repository in any mix, and a mandate (how many PRDs may run at once). This skill is
the lead's seat, a person's today: it settles those with a person as `/omni:brainstorm` settles a
design, writes the brief, and sends it to the mission's page. The page's Start button is the
person's; the fleet does the rest.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your agent adds, if it
adds one (in Claude: the `Co-Authored-By` line its session gives), then the line `omni sign trailer`
prints as the message's last line, with no blank line between them. Every pull request or issue it
opens ends its body with the line `omni sign footer` prints, as a paragraph of its own just above
your session's own attribution lines, and a body it rewrites keeps that line. Comments are never
signed. A command that prints nothing means signing is off here: add nothing.

## Inputs

| input | example | notes |
|---|---|---|
| nothing, or the goal | `/omni:mission 'dark mode for quotes'` | the conversation of step 1; a goal given is the first answer, still shown for a yes |
| `--prd <n> '<goal>'` | `/omni:mission --prd 2803 'dark mode for quotes on site'` | the one-line mission: no conversation. That PRD is its scope, the goal is as given, no measure yet, the default mandate |
| `--fleet <key>` | `--fleet crew-bots` | the Virtual Fleet's key, when it is already known; saves the question |
| `--level <key>` | `--level own-branch` | the level the mission runs at, `with-you`, `own-branch` or `alone`; overrides the fleet's. A member who is not an owner can take it only up to the fleet's own level |

`<n>` below is the mission's number, its issue's number. With `--prd` and no goal, say that the
one-line form takes the goal, and stop.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the Omni Loop
kit is not installed in this repository. Keep the JSON; later steps read `repo.*`,
`paths.delivery`, `worktrees`, `labels.autoCreate` and `limits.beforeAfterMaxBytes` from it.
`<remote>` below is `repo.remote`.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. A form adds to the steps below; it never overrides this skill's rules.
A sync status other than green in the output's `sync` block is said to the person in one line, with
its fix, and the run carries on.

Then read the design flag: `node .omni-loop/bin/omni.mjs config design.enabled`. Anything but `true`
(or a failure) means design craft is off here: step 3 marks nothing and runs no word pass.

## 1. Settle the brief

With `--prd`, ask nothing: take the goal as given, the scope as that PRD (`prds: [<n>]`, no
roadmap), `measures: []`, `mandate.parallel: 2` and the level as question 5 says. Check the PRD exists: `omni prd <n>` must print
its folder, else stop and say which PRD it could not find. The Virtual Fleet is `--fleet` when
given; else ask the one question of this form, the fleet's key, as the Fleet section of the Omni
page shows it. Under `OMNI_UNATTENDED` with no `--fleet`, ask nothing: stop and say that the fleet's
key is the one thing the one-line form cannot guess.

Otherwise, a conversation, **one question at a time** (in Claude: `AskUserQuestion`; see the
briefing's Any agent section for the rest), each with its recommended answer first:

1. **The Virtual Fleet** that takes it: its key (lowercase, dashes between words), as the Fleet
   section of the Omni page shows it. Skip when `--fleet` gave it. Its heroes are the mission's
   team, and its jobs go to that fleet's runners. When the person does not have one, say that a
   member creates it from the Fleet section (`+ New virtual fleet`) and stop: a mission needs a fleet.
2. **The goal**: one sentence, what changes and for whom, at most 500 characters. Push back on a
   goal that names a task ("refactor X"), and ask what changes for whom.
3. **The measures**: 1 to 5 observable signs it worked once deployed, each with a sign, how it is
   read and a target, at most 200 characters each. They are recorded now; following them after
   deployment is a later job. "None yet" is an answer.
4. **The scope**: the PRDs and roadmaps it covers, as numbers of this repository, in any mix: 50
   PRDs and 10 roadmaps at most, one of either at least. Check each with `omni prd <n>`, or
   `omni roadmap check <n>` for a roadmap; a number that does not exist is asked again.
5. **The mandate**: how many PRDs may run at once, 1 to 4, 2 when the person has no preference.
   The fixed rules are said, not asked: the mission never merges, never answers for a person, and
   waits for a person wherever one is needed. Its level is never asked: it is `--level` when given,
   else the fleet's level as the fleet's Missions tab shows it, written as it stands (`with-you` for
   a fleet that was never raised). Say it in one line with the brief; the person changes it for this
   mission on the Missions tab (**Change for this mission**) while the mission is a draft. Its two
   bounds, `hardToRevert` (0 to 1, 0.6) and `ownPrds` (0 to 10, 0), keep their defaults and are
   written only when the person asks for another value; both are read only at `alone`.

Then show the brief whole (fleet, goal, measures, scope, mandate) and ask Yes / Change. Write
nothing before the yes.

## 2. Open the issue

A mission is numbered by its GitHub issue, as a concept is. `gh issue create --title "Mission:
<title>" --body-file <file>`, the body a pointer (the goal, the fleet, the scope, and the folder
the brief will live in) ending with the `omni sign footer` line. `<title>` is the goal cut to a
short title of at most 200 characters. Add no label: the repository has none for a mission. The
folder is `<nnnn>-<slug>`: `<n>` zero-padded to four digits and a short kebab-case slug of the
title, under `<paths.delivery>/missions/`; `<folder>` below is its repository path.

## 3. Write the brief

Make a worktree for the docs branch, cut from `<remote>/<repo.defaultBranch>`:
`git worktree add -b mission/<nnnn>-<slug> <worktrees>/mission-<nnnn> <remote>/<repo.defaultBranch>`,
and write both files there.

**`<folder>/mission.md`**, YAML front matter between `---` fences holding exactly these fields,
then a short body saying the goal in the person's words:

```markdown
---
mission: <n>
title: <title>
fleet: <fleet key>
goal: <the goal, one sentence>
measures:
  - { sign: <the sign>, read: <how it is read>, target: <its target> }
scope:
  prds: [<PRD numbers>]
  roadmaps: [<roadmap numbers>]
mandate:
  parallel: <1 to 4>
  level: <with-you | own-branch | alone>
---
```

`measures: []` when there are none. Quote a value that holds a colon. `hardToRevert` and `ownPrds` join
`mandate` only when the person asked for a value other than their default. Nothing else goes in the
front matter: the kit's schema refuses an unknown field and names the one that is wrong.

**`<folder>/mission.html`**, the brief as a page a person reads in a minute: the goal first, then
the fleet and its team, the measures as a table (sign, how it is read, target), the scope (each
PRD or roadmap with its title), the mandate and the fixed rules. Under the before/after page
rules: self-contained (inline CSS and inline SVG), no base64 raster image, at most
`limits.beforeAfterMaxBytes` bytes, and nothing loaded from the network (a link a person follows is
none). Never publish it as a claude.ai artifact: it would be private to its author.

With the design flag on, mark the page's one screen-like block, the brief card, with
`data-screen="mission-brief"` and its primary action, when it has one, with `data-primary`; the
page's own title and captions sit outside it. Then run
`node .omni-loop/bin/omni.mjs design words <folder>/mission.html` before anyone sees the page, fix
each finding in the page (never silence it by dropping a mark), and run it again.

## 4. Push, then the docs PR

1. `node .omni-loop/bin/omni.mjs mission push <n>` from the worktree. It refuses the folder whole,
   every fault one line (`invalid mission: …`), and sends nothing: fix the file it names, run it
   again. Exit 0 prints the mission's page and the versions added: say the link. Another failure
   (not signed in, the app unreachable) is said in one line with its fix, and the run carries on to
   the pull request: the push is run again later, and a second push of unchanged files adds nothing.
2. Commit both files as `docs(mission): <title>`, signed (**Signing**), write the message to a
   scratch file and commit with `git -C <worktree> commit -F <file>`.
3. `git push -u <remote> mission/<nnnn>-<slug>`, then open the docs PR through `/omni:pr`'s
   lifecycle: base `repo.defaultBranch`, a Conventional Commits title, a body that opens with the
   mission's page link when step 4.1 printed one, then `Refs #<n>`, a Summary, and the
   `omni sign footer` line. A person reviews and merges it whenever.

**Starting never waits for that merge.** The mission starts from its page, on the server, the
moment a person presses Start. Never merge the PR, never press Start for a person, and never
answer a question that is theirs.

## 5. Hand off

Say, in plain words and in this order: the mission's page link (or that it has none yet, and the
`omni mission push <n>` line to run), the docs PR's link, and that **Start** on the mission's page
sends its fleet to work. Name what the mission will wait for a person on (an approval, an answer, a
merge), since it never does those itself.

## Never

- Never write code, merge a pull request, or press Start.
- Never write a field the schema does not take, or a measure the person did not give.
- Never write a level above the fleet's for a person who is not an owner of the workspace: the app refuses it.
- Never invent a Virtual Fleet's key, a PRD or a roadmap: each is read from the person or checked.
- Never ask more than one question at a time, or any under `--prd` beyond the fleet's key.
