---
id: s5-07-e2e-job-waits-for-settings
prd: 2898
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

The screen tests run in the continuous checks only when the repository’s settings say so, and those settings are still off here, their change belonging to the last step of this feature. Should this step turn them on?

## The decision, in plain words

No: the screen-test job reads the settings and, while they are off, runs nothing and says why, so the proof waits for a runner. The last step of this feature turns them on, with the address of the previews and the secret that opens them.

## The intro, for fun

The oven is installed and plugged in.

## The punchline, for fun

Someone still has to turn the knob.

## The options, in plain words

A. Leave the settings to the last step and run nothing until they are on: what was built.
B. Turn the settings on in this step, outside its share of the work.

## What I had to decide

The spec builds e2e in CI here and s5's done-when calls the e2e job the one that runs AC-9's scenario, but `.omni-loop/config.yml` is s10's territory, and this repository's `e2e` block keeps `ci: false`, `url: null`, `deployment: null` and `bypassEnv: null`. Two projects preview each commit here, so without `e2e.deployment` the newest deployment of either would be taken.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

The e2e job's plan step answers `not-ci` here, so it runs nothing and the `e2e` criteria stay `pending` (`no runner has run the e2e scenarios yet`). For CI to run AC-9, s10 sets `e2e.ci: true`, `e2e.url: github-deployment`, `e2e.deployment` to the arcade's preview (`proof.deployment` names it) and `e2e.bypassEnv: VERCEL_AUTOMATION_BYPASS_SECRET`; the repository needs the secrets `OPENROUTER_API_KEY` and `VERCEL_AUTOMATION_BYPASS_SECRET`.

## What it costs to change later

Four config lines in s10 and two repository secrets; nothing in this slice changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether both secrets are already set on this repository for the checks workflow
