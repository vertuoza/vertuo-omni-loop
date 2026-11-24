---
name: mission
description: Settles a mission with a person — the AI Fleet that takes it, its goal, its measures, its scope of PRDs and roadmaps and its mandate, one question at a time — then writes its brief, mission.md (the front matter the kit's schema reads) and mission.html (self-contained, under the before/after page rules, marks and word pass included), in a scratch folder outside the repository, opens the mission's issue, and sends the brief to the mission's page with omni mission push --from. It opens no branch, commit or pull request, since the page is the mission's record. With --prd and a goal it asks nothing and writes the minimal mission, that PRD as its scope; --roadmap does the same for a roadmap. With --goal and a goal it asks only the fleet and writes a goal-only brief at alone, no scope, for the fleet's PM to turn into PRDs; --request reads that goal from the Omni page's New mission box and asks nothing. A scope takes repository numbers and product ids, --prd <key>-<n> for a product PRD, --roadmap <key>-R<n> for a product roadmap. Writes no code, never merges, and presses no Start. Triggers on "start a mission", "give this goal to a fleet", "a mission for PRD 2803", "/omni:mission".
---

# Mission: a goal a AI Fleet delivers

A **mission** is a goal, not a container: one sentence of what changes and for whom, 1 to 5
measures that tell it worked once deployed, the AI Fleet that takes it, a scope of PRDs and
roadmaps (of this repository, or of a product) in any mix, and a mandate (how many PRDs may run at once). This skill is
the lead's seat, a person's today: it settles those with a person as `/omni:brainstorm` settles a
design, writes the brief, and sends it to the mission's page. The page's Start button is the
person's; the fleet does the rest.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** The issue this skill opens ends its body with the line `omni sign footer` prints, as a
paragraph of its own just above your session's own attribution lines. Comments are never signed. A
command that prints nothing means signing is off here: add nothing. The skill makes no commit.

**The page is the record.** A mission lives on its page, in every repository, whatever the phase-0
flag (PRD 3194): the skill cuts no branch, makes no worktree, commits nothing and opens no pull
request. The brief is written to a folder outside the repository and pushed from there.

## Inputs

| input | example | notes |
|---|---|---|
| nothing, or the goal | `/omni:mission 'dark mode for quotes'` | the conversation of step 1; a goal given is the first answer, still shown for a yes |
| `--prd <n>` or `--prd <key>-<n>` `'<goal>'` | `/omni:mission --prd 2803 'dark mode for quotes on site'`, `/omni:mission --prd omni-loop-15 'a mission takes a roadmap'` | the one-line mission: no conversation. That PRD, a repository's number or a product PRD's id, is its scope, the goal is as given, no measure yet, the default mandate |
| `--roadmap <n>` or `--roadmap <key>-R<n>` `'<goal>'` | `/omni:mission --roadmap omni-loop-R3 'the roadmap, delivered'` | the same one-line mission for a roadmap, a repository's number or a product roadmap's id. With `--prd` too, both are the scope |
| `--fleet <key>` | `--fleet crew-bots` | the AI Fleet's key, when it is already known; saves the question |
| `--goal '<goal>'` | `/omni:mission --goal 'quotes get a dark mode'` | the goal-only mission: no scope, the goal as given, asking only the fleet (nothing with `--fleet`). See **Goal-only: `--goal` and `--request`** |
| `--request <id>` | `/omni:mission --request 3f2a9c1e-7b4d-4e8a-9c2f-1a2b3c4d5e6f` | the same mission, started from the Omni page's New mission box: the goal and the fleet are read with `omni mission request <id>`, nothing is asked. A runner takes only this form |
| `--omni-bugs` | `/omni:mission --omni-bugs` | the Omni Loop bug team: a standing mission of kind `omni-bugs`, written in one line (see below). Only on the Omni Loop repository |
| `--level <key>` | `--level own-branch` | the level the mission runs at, `with-you`, `own-branch` or `alone`; overrides the fleet's. A member who is not an owner can take it only up to the fleet's own level |

`<n>` below is the mission's number, its issue's number. With `--prd` or `--roadmap` and no goal, say that the
one-line form takes the goal, and stop.

## `--omni-bugs`: the Omni Loop bug team

`--omni-bugs` writes the brief of a standing mission that fixes the Omni Loop bugs missions report
(PRD 3088), in one line and with one question at most:

- `kind: omni-bugs` in the front matter, and no `scope`: it has none, and a brief with a PRD or a
  roadmap in it is refused. It never ends delivered.
- The goal is fixed: `Fix the Omni Loop bugs missions report`. No measure (`measures: []`) and the
  default mandate (`parallel: 2`, the fleet's level).
- The fleet is `--fleet` when given, else the workspace's AI Fleet that has an Engineer. With
  several, ask which one: that is its one question. With none, say that a member creates it from the
  Fleet section and stop. Under `OMNI_UNATTENDED` with several, ask nothing: stop and say the fleet's
  key is the one thing it cannot guess.
- Only the Omni Loop repository runs it. On any other repository stop before step 1 and say `Only the
  Omni Loop repository runs the Omni Loop bug team`; the kit's brief schema and the app refuse it too.
  At most one `omni-bugs` mission runs at a time.

Then run steps 0, 2, 3, 4 and 5 as for any mission (step 1 is this section), showing the brief for
a yes first.

## Goal-only: `--goal` and `--request`

A **goal-only** mission is a brief with a goal and a fleet and no `scope`: the fleet's PM turns the
goal into a roadmap of PRDs, up to 10, the committee approves them and the fleet builds them
(PRD omni-loop-24). It runs at `alone` only, with no measure and the default mandate.

- **`--goal '<goal>'`** takes the goal as the person gave it, word for word, and asks only the
  fleet's key (nothing with `--fleet`).
- **`--request <id>`** reads the goal and the fleet with `node .omni-loop/bin/omni.mjs mission request <id>`
  (two lines, `fleet: <key>` then `goal: <the goal>`); when that verb exits 1, say its one line and
  stop. It asks nothing, under `OMNI_UNATTENDED` or not, and the goal is written as the request holds it.

Before anything is written, both forms stop, saying the line and nothing more, when:

- `node .omni-loop/bin/omni.mjs approval flag` prints `phase 0: pr` (or `phase 0: pr · the flag could
  not be read: <why>`): `a goal-only mission needs phase 0 on the server`. The PM writes no PRD there.
- the person is not an owner of the workspace and the fleet's own level, as the fleet's Missions tab
  shows it, is below `alone`: `a goal-only mission works alone: an owner starts it, or raises the
  fleet to Works alone`. (From the New mission box the page has already refused this before saving.)

Then write the brief as step 3 says, with `level: alone`, `measures: []`, **no `scope` key**, no
`mandate` bounds beyond `parallel: 2` and the level, and, with `--request`, the line `request: <id>`
in the front matter (the page starts a pushed brief that names its request as the person who made it).
`--goal` shows the brief for a yes first, as step 1 does; `--request` shows nothing and asks nothing.
Run steps 2 to 4 as for any mission, then:

- With `--goal`, hand off as step 5 does: the mission's page, where **Start** is pressed as today.
- With `--request`, the push starts the mission: say the page's link and that the mission is running,
  not that it waits for **Start**. Never press Start yourself.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the Omni Loop
kit is not installed in this repository. Keep the JSON; later steps read `repo.*`,
`labels.autoCreate` and `limits.beforeAfterMaxBytes` from it.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. A form adds to the steps below; it never overrides this skill's rules.
A sync status other than green in the output's `sync` block is said to the person in one line, with
its fix, and the run carries on.

Then read the design flag: `node .omni-loop/bin/omni.mjs config design.enabled`. Anything but `true`
(or a failure) means design craft is off here: step 3 marks nothing and runs no word pass.

## 1. Settle the brief

With `--prd` or `--roadmap`, ask nothing: take the goal as given, the scope as that PRD
(`prds: [<id>]`, no roadmap) or that roadmap (`roadmaps: [<id>]`, no PRD), or both when both are
given, `measures: []`, `mandate.parallel: 2` and the level as question 5 says. Check each id exists:
a repository PRD with `omni prd <n>` (it must print its folder), a product PRD with
`omni prd <key>-<n>` (it must print its state), a repository roadmap with `omni roadmap check <n>`,
a product roadmap with `omni dossier get <key>-R<n> roadmap` (it must print the roadmap's file);
else stop and say which PRD or roadmap it could not find. The AI Fleet is `--fleet` when
given; else ask the one question of this form, the fleet's key, as the Fleet section of the Omni
page shows it. Under `OMNI_UNATTENDED` with no `--fleet`, ask nothing: stop and say that the fleet's
key is the one thing the one-line form cannot guess.

Otherwise, a conversation, **one question at a time** (in Claude: `AskUserQuestion`; see the
briefing's Any agent section for the rest), each with its recommended answer first:

1. **The AI Fleet** that takes it: its key (lowercase, dashes between words), as the Fleet
   section of the Omni page shows it. Skip when `--fleet` gave it. Its heroes are the mission's
   team, and its jobs go to that fleet's runners. When the person does not have one, say that a
   member creates it from the Fleet section (`+ New AI fleet`) and stop: a mission needs a fleet.
2. **The goal**: one sentence, what changes and for whom, at most 500 characters. Push back on a
   goal that names a task ("refactor X"), and ask what changes for whom.
3. **The measures**: 1 to 5 observable signs it worked once deployed, each with a sign, how it is
   read and a target, at most 200 characters each. They are recorded now; following them after
   deployment is a later job. "None yet" is an answer.
4. **The scope**: the PRDs and roadmaps it covers, as numbers of this repository or ids of a
   product, in any mix: 50 PRDs and 10 roadmaps at most, one of either at least. A product PRD is
   `<key>-<n>` (`omni-loop-15`), a product roadmap `<key>-R<n>` (`omni-loop-R3`). Check a number with
   `omni prd <n>`, or `omni roadmap check <n>` for a roadmap; check a product PRD with
   `omni prd <key>-<n>`, and a product roadmap with `omni dossier get <key>-R<n> roadmap`; a number
   or a product id that does not exist is asked again, and so is a value that is neither
   (`omni-loop`, `omni-loop-R`).
5. **The mandate**: how many PRDs may run at once, 1 to 4, 2 when the person has no preference.
   The fixed rules are said, not asked: the mission never merges, never answers for a person, and
   waits for a person wherever one is needed. Its level is never asked: it is `--level` when given,
   else the fleet's level as the fleet's Missions tab shows it, written as it stands (`with-you` for
   a fleet that was never raised). Say it in one line with the brief; the person changes it for this
   mission on the Missions tab (**Change for this mission**) while the mission is a draft. Its two
   bounds, `hardToRevert` (0 to 1, 0.6) and `ownPrds` (0 to 10, 0), keep their defaults and are
   written only when the person asks for another value; both are read only at `alone`.
   When the PRDs live in a plan repository, the mission cuts no branch: `with-you` and `alone` are
   offered, and `own-branch` is refused with `a mission branch holds one repository: use with-you or
   alone`. At `alone` there, the committee approves each PRD, each is built with `/omni:ultra-yolo`,
   and the page says `committee only: a person merges each target's pull request`.

Then show the brief whole (fleet, goal, measures, scope, mandate) and ask Yes / Change. Write
nothing before the yes.

## 2. Open the issue

A mission is numbered by its GitHub issue, as a concept is. `gh issue create --title "Mission:
<title>" --body-file <file>`, the body a pointer (the goal, the fleet, the scope, and the folder
the brief will live in) ending with the `omni sign footer` line. `<title>` is the goal cut to a
short title of at most 200 characters. Add no label: the repository has none for a mission. Then make
the scratch folder outside the repository, `<folder>` below: `mktemp -d` (never a path under the
repository). The issue's body names the page as the brief's home, not a repository folder.

## 3. Write the brief

Write both files in `<folder>`, the scratch folder outside the repository. No worktree, no branch.

**`<folder>/mission.md`**, YAML front matter between `---` fences holding exactly these fields,
then a short body saying the goal in the person's words:

```markdown
---
mission: <n>
title: <title>
fleet: <fleet key>
goal: <the goal, one sentence>
kind: <prds | omni-bugs>
request: <id>   # only with --request
measures:
  - { sign: <the sign>, read: <how it is read>, target: <its target> }
scope:
  prds: [<PRD numbers or product PRD ids>]
  roadmaps: [<roadmap numbers or product roadmap ids>]
mandate:
  parallel: <1 to 4>
  level: <with-you | own-branch | alone>
---
```

`kind` is `prds` (leave it out) or `omni-bugs`, whose brief has no `scope`. `measures: []` when there are none. Quote a value that holds a colon. `hardToRevert` and `ownPrds` join
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

## 4. Push

Run `node .omni-loop/bin/omni.mjs mission push <n> --from <folder>`. It refuses the folder whole,
every fault one line (`invalid mission: …`), and sends nothing: fix the file it names, run it again.
Exit 0 prints the mission's page and the versions added: say the link. Another failure (not signed
in, the app unreachable, a refusal) is said in one line with its fix, and the folder is kept: the
hand-off prints `omni mission push <n> --from <folder>` to run again, and a second push of unchanged
files adds nothing. No branch, commit or pull request is made, and none stands in for a failed push.

**Starting is the person's.** The mission starts from its page, on the server, the moment a person
presses Start. Never merge anything, never press Start for a person, and never answer a question
that is theirs.

## 5. Hand off

Say, in plain words and in this order: the mission's page link, its fleet's Missions tab (or, when
the push failed, why, its fix and the `omni mission push <n> --from <folder>` line to run again), and
that **Start** on that page sends its fleet to work. Name what the mission will wait for a person on
(an approval, an answer, a merge), since it never does those itself. To keep the brief as plain files
in the repository, `omni mission get <n>` writes them, uncommitted.

## Never

- Never write code, cut a branch, make a commit, open a pull request, merge, or press Start.
- Never write a field the schema does not take, or a measure the person did not give.
- Never write a level above the fleet's for a person who is not an owner of the workspace: the app refuses it.
- Never invent a AI Fleet's key, a PRD or a roadmap, a product id included: each is read from the person or checked.
- Never ask more than one question at a time, or any under `--prd` or `--roadmap` beyond the fleet's key.
- Never ask any under `--request`, or beyond the fleet's key under `--goal`.
- Never write a goal-only brief below `alone`, or on `phase 0: pr`, or put the goal in a runner line.
