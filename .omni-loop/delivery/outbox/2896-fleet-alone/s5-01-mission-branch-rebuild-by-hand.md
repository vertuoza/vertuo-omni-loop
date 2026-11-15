---
id: s5-01-mission-branch-rebuild-by-hand
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

When the mission branch can only follow the default branch once its built files are rebuilt, the spec says a runner job does it. No skill a runner may take can rebase a mission branch, so who does it for now?

## The decision, in plain words

For now the mission waits on a person, naming the built files and saying to rebase the branch and rebuild them by hand, and nothing on the branch changes. A feature branch in the same case does get its runner job, through the skill that already looks after a pull request.

## The intro, for fun

The robot knows the shelf is crooked, but nobody gave it a screwdriver yet.

## The punchline, for fun

So it leaves a note on the shelf instead of guessing.

## The options, in plain words

A. A. The mission waits on a person for a conflict only in built files on its own branch; feature branches get their care job (built).
B. B. Add a runner skill now that rebases the mission branch and rebuilds its built files, with the lists of the Omni page and the database.
C. C. Rebase the mission branch keeping the default branch's built files, and let the next PRD's rebuild bring them up to date.

## What I had to decide

Keep the wait on a person until a later change gives runners a job that rebases a mission branch and rebuilds its built files, or ask for that job now.

## What I did meanwhile

The app tells a conflict only in built files apart from any other, on the mission branch and on each feature branch. A feature branch gets one care job per head of the mission branch; the mission branch itself waits on a person, saying which files and that no branch changed.

## What it costs to change later

Adding the job later costs one new runner skill, its place in the runner lists of the kit, the Omni page and the database, and swapping the wait for a send in the mission's run.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A new runner skill must be added to three lists the tests hold equal (the kit's, the Omni page's and the database's); only the kit's is in this slice's ground.
- (author) Until then, criterion 8 holds for feature branches but not for the mission branch itself: in this repository almost every rebase conflicts in the built bundle, so a mission at Own branch waits on a person often.
