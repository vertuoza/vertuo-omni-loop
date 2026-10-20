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
