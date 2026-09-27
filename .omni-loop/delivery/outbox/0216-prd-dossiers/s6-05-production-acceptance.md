---
id: s6-05-production-acceptance
prd: 216
slice: s6
rank: human-action
bears-on: none
raised: 2026-09-27
wave: 5
---

## The question, in plain words

The last checks of this feature need the released site, a real sign-in and a real terminal session. They cannot run before the release, so a person has to run them afterwards.

## The decision, in plain words

A person runs them once the feature is released. Everything else was shown with the demo and the tests, and this terminal's session name was checked against the one the question history records.

## The intro, for fun

The rehearsal went well, but the theatre is still being built.

## The punchline, for fun

Someone has to take a seat on opening night and check the view.

## What a person must do

After the release, with the dossier switch on in this repository and a terminal signed in:

1. Turn ask mode on and start a brainstorm. Check that it prints the dossier's link before its first question, and that each question you answer appears on the draft's Questions tab, marked brainstorm, with its answer and who answered.
2. Let the brainstorm push its files. Check that the dossier now reads PRD and its number, and that Before/after and Spec show v1.
3. Change the spec and push it again. Check that Spec shows v2 and that v1 is still readable from the version picker.
4. Send the link to another member of the workspace and check that it opens for them. An account of another workspace should get not found.
5. In the arcade, open that PRD's planet, turn to the DOSSIER tab, press START, and check that the page opens in a new tab.
6. In the same terminal, compare the session name Claude Code reports with the one stored for that brainstorm's questions in the question history. They must be equal.

Reply on the feature pull request with what you saw, and a screenshot of each step.

## What I had to decide

Hold the feature until someone can run the checks on the released site, or release it and have a person run them right after.

## What I did meanwhile

Screenshots of the demo show the dossier tab on both screens, the tab opening the page, and the two pages. In this environment the terminal's session name is the one Claude Code hands its hooks, which is what the question history stores.

## What it costs to change later

Nothing to undo: the checks confirm the feature, or report a fault to fix.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The feature is not deployed and this environment has no database, so none of the steps a person must do could run here (author).
- The session name was compared in a cloud session only; a terminal on a laptop was not tried (author).
