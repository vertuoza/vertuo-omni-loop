---
id: s5-04-acceptance-not-run-here
prd: 71
slice: s5
rank: high
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

This slice was to be accepted by a person answering real questions on the live page, in both themes and with the network off, with screenshots. None of that could be run here, so can the slice go in before a person runs it?

## The decision, in plain words

Everything that can be tested without the live page is built and tested, and the checks a person must run are listed step by step. The feature is not shipped until a person has run them and they pass.

## The intro, for fun

The switch is wired, labelled and tested on a bench, but never yet on the wall.

## The punchline, for fun

The bench says it works; the wall still gets the final word.

## The options, in plain words

A. Merge the slice, and have a person run the acceptance before the feature ships, the option built.
B. Hold this slice unmerged until a person has run the acceptance.
C. Send the feature back to design until the live proof has been run.

## What I had to decide

The plan's done-when for s5 ends: "The manual acceptance is recorded in the sub-PR with screenshots: a `/omni:brainstorm` question answered on the page in light and in dark theme; a multi-select and an Other answer received exactly; with the network off, the same question shows as the terminal prompt, and its answer appears in the page's history tagged `terminal`; after `/omni:ask off`, the page shows "session closed"." In this container there is no Google sign-in, no live Supabase, no route to the deployed app (the egress proxy refuses `*.vercel.app`), and driving an interactive `claude` session was refused by the session's permission policy for an earlier slice. The first scenario is also the live proof s1 could not run (item `s1-01-live-proof-not-run`): that a hook's `updatedInput.answers` answers `AskUserQuestion` with no terminal prompt.

## What I did meanwhile

No screenshot exists, and none of the four scenarios was run. What was run instead: `kit/bin/ask.test.mjs` runs `omni ask on`, a `pre` hook answered through that session, and `omni ask off` against `kit/test/fake-ask-server.mjs`, and runs the CLI as a process with a temporary HOME. The built bundle, copied into a scratch checkout as `.omni-loop/bin/omni.mjs`, was run the same way: `ask status` prints `off`; `ask on` signed out exits 1 naming `omni signin`; signed in it prints the link; the `pre` hook returns the fake's answer; a second `on` closes the first session; `ask off` closes the second and the `prompt` hook goes quiet; `git status` stays clean; `ask.url: null` makes `ask on` exit 1 with the one-line reason. To run the acceptance: deploy the feature branch with its two migrations applied; check `ask.url` in `.omni-loop/config.yml` against the app's real address (item `s5-01-where-this-repository-asks`); load the plugin from this branch; `omni signin`; `/omni:ask on` and open the link; run `/omni:brainstorm` and answer on the page in light theme, then in dark; answer a multi-select and an Other; while a question waits on the page, cut the network (it shows in the terminal), restore it, answer in the terminal, and check the page's history shows it tagged terminal; `/omni:ask off`, and check the page says "session closed". Screenshot each step into the feature PR.

## What it costs to change later

If the live run fails, the fix lands in the hooks, the page or the contract, and the PRD may go back to design as its spec says; nothing stored in a repository depends on it. Shipping without the run would put an unproven answer path in front of every person who turns the mode on.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a hook's answer reaches Claude in a live interactive session without the terminal prompt showing, the assumption the spec names as load-bearing.
- (author) Whether the production sign-in accepts the page's return addresses, and whether the two ask migrations are applied to the production database.
