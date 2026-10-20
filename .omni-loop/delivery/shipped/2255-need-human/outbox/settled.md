# Settled outbox items — PRD 2255

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-closed-reads-done -->

## s1-01-closed-reads-done — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-closed-reads-done
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When someone answers or dismisses the questions of a stopped job, should its row on the Runners page read Done, or keep reading Need human?

## The decision, in plain words

The row reads Done as soon as its questions are closed. The record of the stopped job still says it needed a human, so nothing is lost.

## The intro, for fun

A job that asked for help gets its answer, and then it should stop looking worried.

## The punchline, for fun

Once the question is closed, the badge retires too.

## The options, in plain words

A. A. The board reads a job with closed questions as Done, and its stored outcome stays as it ended.
B. B. The database functions clear the stored outcome when the questions close.

## What I had to decide

Pick A to keep reading a closed job as Done from whether its questions are still open, with nothing stored changing when someone answers. Pick B to clear the stored outcome when the questions close, which moves the clearing into the database functions.

## What I did meanwhile

The Runners board reads a job whose questions are closed as Done. It works that out from whether the questions are still open, and the stored outcome stays as the job ended.

## What it costs to change later

Switching to B is one change in the answer and dismiss database functions plus a small migration; the page and its words stay as they are.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the badge leaves once the questions are closed, but not whether the stored outcome is cleared (author).

```

<!-- /omni-outbox-settled: s1-01-closed-reads-done -->

<!-- omni-outbox-settled: s1-02-answer-after-job-ended -->

## s1-02-answer-after-job-ended — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-answer-after-job-ended
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Can a person answer the questions of a job that has not finished yet, or only once the job has ended and reads Need human?

## The decision, in plain words

Only once it has ended: answering and dismissing are refused until the job reads Need human, so the run that resumes never overlaps the one that stopped.

## The intro, for fun

The job has asked its question, but it is still packing its bags.

## The punchline, for fun

Answering waits for the door to close behind it.

## The options, in plain words

A. A. Answering and dismissing wait until the job has ended and reads Need human.
B. B. Answering and dismissing are accepted as soon as the questions are asked.

## What I had to decide

Pick A to refuse answers and dismissals until the job has ended. Pick B to accept them as soon as the questions are asked, which lets the resume job queue while the first one is still wrapping up.

## What I did meanwhile

A person who tries to answer while the job is still running is told that the job is not waiting for an answer yet. The Runners page only offers the button once the job reads Need human, so the window lasts seconds.

## What it costs to change later

Switching to B is one check removed from the service and one from the database function, plus tests; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec does not say what happens between the moment a job asks and the moment it ends (author).

```

<!-- /omni-outbox-settled: s1-02-answer-after-job-ended -->

<!-- omni-outbox-settled: s1-03-server-sets-human -->

## s1-03-server-sets-human — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-server-sets-human
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

May a runner report on its own that a job needs a human, or does only the server decide it, from the questions the job posted?

## The decision, in plain words

Only the server decides: a job that ends with its questions still open reads Need human, and a runner that reports it directly is refused.

## The intro, for fun

Whether a job needs a human should not depend on the job saying so.

## The punchline, for fun

The questions on file settle it.

## The options, in plain words

A. A. Only the server sets the outcome human, from the questions on file; a runner that reports it is refused.
B. B. A runner may report the outcome human in its own report as well.

## What I had to decide

Pick A to keep the outcome in the server's hands, set from the stored questions when the job ends. Pick B to let a runner's report carry it as well, which a job could then claim without any question on file.

## What I did meanwhile

A runner's end-of-job report may say answers, held or ready, as before. A report that says human is refused as malformed, and the server sets the outcome itself when the job ends with questions still open.

## What it costs to change later

Switching to B is one value added to the list of outcomes a runner may report, and the service then trusts it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the server stores human at the end of the job, but not what a runner that reports it should get (author).

```

<!-- /omni-outbox-settled: s1-03-server-sets-human -->

<!-- omni-outbox-settled: s1-04-sql-check-outside-territory -->

## s1-04-sql-check-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-sql-check-outside-territory
prd: 2255
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

Should the new table's database check and the step that runs it in CI ship with this slice, although the plan only listed the migration and the types file as its ground?

## The decision, in plain words

They ship with it: a new table with row-level rules gets a check of those rules that runs in CI, as the repository does for its other such tables. Both are small and sit beside the migration.

## The intro, for fun

The plan drew the fence around the migration, and the check was standing just outside it.

## The punchline, for fun

A new table with rules should not arrive without a way to prove them.

## The options, in plain words

A. A. The check script and its CI step ship with this slice, outside its listed ground.
B. B. Both are left out of this slice, and a person adds the check later.

## What I had to decide

Pick A to keep supabase/checks/runner_job_questions.sql and its step in .github/workflows/supabase.yml in this sub-PR, both outside the slice's territory, so the wave reports them as a breach and merges anyway. Pick B to remove both from this sub-PR and leave the rules proven only by the migration's text test, with a person adding the check later.

## What I did meanwhile

The check script and its workflow step are in the sub-PR. The script was run against a throwaway Postgres 16 with the migration applied, not against the full Supabase stack, which could not run here.

## What it costs to change later

Switching to B is deleting one file and one step of the workflow; nothing else depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice leaves out the checks folder and the workflow file, though the repository's rule for row-level checks asks for both (author).
- The workflow step could not be run here: only the script itself was run, on a throwaway Postgres (author).

```

<!-- /omni-outbox-settled: s1-04-sql-check-outside-territory -->

<!-- omni-outbox-settled: s2-01-answers-wire-shape-assumed -->

## s2-01-answers-wire-shape-assumed — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-answers-wire-shape-assumed
prd: 2255
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The two halves of this feature are built side by side: one stores a stopped job's questions and answers, the other asks them and reads them back. Should the asking half keep a guess about what the storing half sends back?

## The decision, in plain words

The asking half sends the issue, a short lead and the questions in one request, and expects back a list of questions, the answers, and the name of whoever answered, and shows the app's own words when it refuses. It stays that way until both halves are merged and can be checked against each other.

## The intro, for fun

Two crews are building one bridge, each from its own bank, in the same week.

## The punchline, for fun

We aimed our planks at where the other bank ought to be.

## The options, in plain words

A. Keep the guess, and check it against the server half once both are merged into the feature branch.
B. Make the kit check every field of the reply now, so a mismatch fails loudly instead of showing up in the skills' wording.
C. Hold the asking half until the storing half is merged, and write it against its real replies.

## What I had to decide

PRD 2255 names the two routes and what the commands exit with, but not the field names. `omni runner ask` posts `{ issue, lead, questions }` to `POST /api/runners/jobs/<job>/questions` and prints the line the stop comment ends on, whose link is `<ask.url>/app/runners?answer=<job>`. `omni runner answers <job>` reads `GET` on the same route, requires a JSON object with an array `questions` and prints it as one line; both skills then name its `answers` and `answeredBy` (the login). s1 owns the server side and was not visible while s2 was built.

## What I did meanwhile

`omni runner answers` is a pass-through of the server's JSON that checks only the `questions` array, so a different spelling of `answers` or `answeredBy` breaks the two skills' text, never the command. The questions themselves are checked kit-side against omni ask's file shape: 1 to 4 questions, each with a header and 2 to 4 options.

## What it costs to change later

A renamed `answers` or `answeredBy` is two words in each of the two skill files and one pinned phrase in `kit/test/need-human-skills.test.ts`; a different request body is one constant in `kit/lib/runner/api.ts` with its tests; the link is one function in `kit/lib/runner/questions.ts`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the exact field names the server slice returns for the answers and for who answered
- (author) whether the server slice builds the link itself or leaves it to the kit

```

<!-- /omni-outbox-settled: s2-01-answers-wire-shape-assumed -->

<!-- omni-outbox-settled: s2-02-runner-help-entry-left-out -->

## s2-02-runner-help-entry-left-out — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-runner-help-entry-left-out
prd: 2255
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

The built-in help for the runner command does not yet mention the two new verbs, because that help text lies outside this piece of work. Should it be extended here?

## The decision, in plain words

The help text was left as it is. The two new verbs still print a usage line when they are mistyped, and the skills name them in full.

## The intro, for fun

A verb with no line in the manual is a rumour.

## The punchline, for fun

For now, only its usage line vouches for it.

## The options, in plain words

A. Leave the help as it is, and let the skills and the usage lines document the two verbs.
B. Add the two verbs to the help text in a follow-up slice that owns that file.
C. Widen this slice's territory to the help file and add them now.

## What I had to decide

`kit/lib/help/entries.ts` documents `omni runner`; it is outside s2's territory (`kit/bin/commands/runner`, `kit/lib/runner/`, the two bug-fix skills, `kit/test/need-human`), so `omni help runner` does not list `ask` and `answers`.

## What I did meanwhile

Wrote the usage lines into `kit/bin/commands/runner.ts` (`omni runner ask --file <file> --issue <n> --lead <file>`, `omni runner answers <job>`), and the command's header comment documents both verbs.

## What it costs to change later

One entry in `kit/lib/help/entries.ts` and its snapshot, in a slice whose territory names that file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a help entry for a verb run inside a job's session is wanted at all, since only skills call it

```

<!-- /omni-outbox-settled: s2-02-runner-help-entry-left-out -->

<!-- omni-outbox-settled: s2-03-answers-settle-the-stop -->

## s2-03-answers-settle-the-stop — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-answers-settle-the-stop
prd: 2255
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

When a person answers the questions a stopped fix asked, may that answer let the fix cross the line it stopped at, such as a change to stored data or to something other code depends on?

## The decision, in plain words

Yes, for that one decision only: the answer counts as the behaviour wanted and the fix goes on, and a person still reviews and merges the pull request. Any other line crossed later stops the fix again and asks again.

## The intro, for fun

A fix waits at a door until someone tells it which way to turn.

## The punchline, for fun

It still has to show its work to the reviewer.

## The options, in plain words

A. Let the answer settle the decision the stop named, whatever line it crossed, and let the reviewer judge the pull request.
B. Keep stopping at a stored shape or a shared contract whatever the answer, so Design it first is the only way forward for those.
C. Ask a second time, naming the line, before crossing a stored shape or a shared contract.

## What I had to decide

PRD 2255 says the resume carries on from its triage with the answers as the behaviour wanted, and that the fix plan, the red test, the fix and the pull requests run as written. It does not say what the boundary check does with a line the answer itself crosses (a `risk.storedShape` or `risk.sharedContract` path). Both skills now say the answers settle the decision the stop named, and that one only; any other crossing is a new stop.

## What I did meanwhile

Wrote that in each skill's `## Resuming with answers`, and pinned its phrases in `kit/test/need-human-skills.test.ts`. A resume still opens pull requests and merges none.

## What it costs to change later

Two sentences in two skill files and the phrases pinned by the kit test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the product owner wants an answer to be enough for a stored-shape or shared-contract change, or wants those to go through the brainstorm line whatever the answer

```

<!-- /omni-outbox-settled: s2-03-answers-settle-the-stop -->

<!-- omni-outbox-settled: s3-01-need-human-button-outline -->

## s3-01-need-human-button-outline — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-need-human-button-outline
prd: 2255
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

On the Runners page, should the Need human button be the page's one main button, or a quieter outlined button beside Terminal?

## The decision, in plain words

The Need human button is drawn as an outlined button in the plasma colour, so the first Send again button stays the page's one main button. The status beside it is the filled part.

## The intro, for fun

A job puts its hand up and asks for a person.

## The punchline, for fun

The hand is raised, and the loudest colour on the row is already its status.

## The options, in plain words

A. A. Outlined Need human button, Send again stays the one main button (built)
B. B. Filled Need human button, and it becomes the one main button while a job waits

## What I had to decide

Pick A to keep the button outlined and the page's single main button on Send again, or B to fill the Need human button and make it the main one when a job is waiting.

## What I did meanwhile

I drew the Need human button outlined in plasma and left the first Send again as the page's one main button, which the page's existing test and the design form both ask for.

## What it costs to change later

Cheap to change: one style rule and one flag on the row decide it, and no data or contract depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the job's action is a Need human button but does not say whether it is the main button of the page (author)
- A page with a waiting job and no failed job would then have no main button at all (author)

```

<!-- /omni-outbox-settled: s3-01-need-human-button-outline -->

<!-- omni-outbox-settled: s3-02-drawer-reads-on-open -->

## s3-02-drawer-reads-on-open — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-drawer-reads-on-open
prd: 2255
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

Should the Need human drawer fetch a job's questions when it opens, or should the Runners page carry every waiting job's questions from the start?

## The decision, in plain words

The drawer asks the Omni app for the job's questions when it opens, so the page itself stays as light as it is today and a person always reads the current state, including who answered first.

## The intro, for fun

Why carry every question on your back when you can ask at the door?

## The punchline, for fun

The drawer knocks once, reads the answer, and only then pulls up a chair.

## The options, in plain words

A. A. The drawer reads the questions when it opens (built)
B. B. The page's server read carries the questions of every waiting job

## What I had to decide

Pick A to keep the read on open, or B to have the page's server read the questions of every waiting job and hand them to the drawer ready to show.

## What I did meanwhile

I built A: the drawer shows a short reading line, then the questions or who closed them. The demo page seeds its drawer from its own sample questions, so it shows the full form at once.

## What it costs to change later

Moderate to change: B means the page's server read joins the questions table for the waiting jobs, which touches the data layer another slice owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the drawer holds the lead and the questions but not when they are read (author)
- I did not measure how many waiting jobs a busy workspace would carry at once (author)

```

<!-- /omni-outbox-settled: s3-02-drawer-reads-on-open -->

<!-- omni-outbox-settled: s3-03-closed-row-by-its-words -->

## s3-03-closed-row-by-its-words — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-closed-row-by-its-words
prd: 2255
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

When someone else already answered, how should the drawer tell that refusal from any other refusal?

## The decision, in plain words

The drawer tells a closed question from other refusals by the service's own words, Already answered by or Dismissed by, and then shows the person who came first with no buttons. Any other refusal stays in the drawer above the foot.

## The intro, for fun

Two people press Send at the same second, and only one of them wins.

## The punchline, for fun

The loser is told who won, politely, and by name.

## The options, in plain words

A. A. Match the service's words in the drawer (built)
B. B. Carry the refusal's status through the client files and read it in the drawer

## What I had to decide

Pick A to keep matching the service's words, or B to have the page's client files carry the refusal's status so the drawer need not read words.

## What I did meanwhile

I built A inside the drawer's own files. The client that calls the routes returns only the words of a refusal, and it sits outside this slice's territory, so I left it alone.

## What it costs to change later

Cheap to change if the client files can be touched: the matching sits in one small function, and B replaces it with a status read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- If the service ever rewords these two refusals, the drawer would show them as an ordinary problem instead of a closed row (author)
- The service's own tests pin the words, but nothing in the drawer's tests pins the two sides together (author)

```

<!-- /omni-outbox-settled: s3-03-closed-row-by-its-words -->

<!-- omni-outbox-settled: s4-01-waiting-means-done-and-open -->

## s4-01-waiting-means-done-and-open — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-waiting-means-done-and-open
prd: 2255
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

Which stopped jobs should the number beside Runners count as waiting for an answer?

## The decision, in plain words

It counts a job only when it stopped to ask a person and its questions are still open, each job once. A job that failed or was cancelled with questions left open is not counted, since nobody can answer those.

## The intro, for fun

A number beside a name should only count the things you can actually do something about.

## The punchline, for fun

Otherwise it would sit at 1 forever, like a missed call nobody can return.

## The options, in plain words

A. Count a stopped job once, only when it ended asking a person and its questions are still open, as the Runners page marks Need human.
B. Count every question still open, whatever became of its job, failed and cancelled ones included.

## What I had to decide

Pick A to count only the jobs that ended asking a person for help and still have open questions, the same jobs the Runners page marks Need human. Pick B to count every open question whatever became of its job, which would also count jobs that failed or were cancelled.

## What I did meanwhile

The number counts the stopped jobs that asked for a person and whose questions are still open, each job once. It looks at every job of the workspace, not only the last 50 the Runners page lists, and a job leaves the count as soon as its questions are answered or dismissed.

## What it costs to change later

Switching to B means the count ignores the state of the job and counts every open question. It is one small change in how the count is worked out, with no stored data and no page changing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The idea says the number counts the workspace's open job questions, but does not say whether a failed or cancelled job whose questions are still open should count, nor whether a job with two open questions counts once or twice.

```

<!-- /omni-outbox-settled: s4-01-waiting-means-done-and-open -->

<!-- omni-outbox-settled: s4-02-runners-count-stays-quiet -->

## s4-02-runners-count-stays-quiet — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-20
- Slice: s4
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-runners-count-stays-quiet
prd: 2255
slice: s4
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

Should a job waiting for an answer also move the bell, the number in the page title and the dot on the browser tab, or only the number beside Runners?

## The decision, in plain words

Only the number beside Runners shows it. The bell, the number in the page title and the dot on the tab stay as they are, and nobody gets an alert when a job starts waiting.

## The intro, for fun

Some news deserves a doorbell, and some is fine waiting on the shelf with a label.

## The punchline, for fun

This one gets the label, and the doorbell keeps its voice for the rest.

## The options, in plain words

A. The count shows beside Runners only: the bell, the page title and the dot on the tab ignore it, and no alert is raised.
B. The count joins the total the bell, the page title and the dot on the tab show, and a new waiting job alerts like a new question.
C. The count joins the total the bell, the page title and the dot on the tab show, but a new waiting job raises no alert.

## What I had to decide

Pick A to keep the Runners count out of the bell, the page title, the dot on the tab and the alerts, so it shows only beside Runners. Pick B to add it to the total those three show and alert on a new one. Pick C to add it to the total but raise no alert.

## What I did meanwhile

The count shows beside Runners alone. The bell, the number in the page title and the dot on the tab ignore it, and a job that starts waiting raises no alert.

## What it costs to change later

Switching to B or C means adding the count to the total in one place, and for B letting a new one alert like a new question. The number beside Runners stays as it is.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The idea asks for a number beside Runners only; it does not say whether the bell, the page title, the dot on the tab or an alert should also react to it.

```

<!-- /omni-outbox-settled: s4-02-runners-count-stays-quiet -->
