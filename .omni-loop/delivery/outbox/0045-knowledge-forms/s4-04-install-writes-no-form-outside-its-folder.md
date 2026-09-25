---
id: s4-04-install-writes-no-form-outside-its-folder
prd: 45
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The install may only write inside its own folder. What should it do when a settings file it keeps puts the knowledge forms somewhere else in the repository?

## The decision, in plain words

It writes no form there, says so in its closing message, and leaves them to the skill that fills the forms, which creates them where the settings say.

## The options, in plain words

A. The install writes no form outside its folder, says so, and points to the step that fills the forms.
B. The install writes the forms where the settings say, even outside its own folder.
C. The install refuses to run until the settings put the forms inside its folder.

## What I had to decide

The spec says `omni init` runs the same writer as `omni kb init`, and that "everything it writes stays under `.omni-loop/`, as PRD 39 requires". A config `omni init` writes never sets `paths.playbook`, so its forms land in `.omni-loop/knowledge/`. But a config it keeps (no `--force`) may set `paths.playbook` elsewhere, say `docs/playbook`, and the writer would then write the front door's page, the forms and the decisions form under that folder's parent. The spec does not say which of the two rules wins.

## What I did meanwhile

`init` in `kit/bin/commands/init.mjs` calls `writeForms` only when the front door (`ctx.layout.frontDoor`, the playbook folder's parent), normalized, is `.omni-loop` or lies under it. Otherwise it writes none, and `closingSteps` prints `  forms   not written: <front door>/ is outside .omni-loop/ — see step <n> below`, naming the `/omni:terraform` step, whose step 0 runs `omni kb init`. Test: "writes no form outside .omni-loop/: a kept config whose playbook lies elsewhere leaves them to /omni:terraform" in `kit/bin/init.test.mjs`.

## What it costs to change later

A constant, before or after merge: one condition in `kit/bin/commands/init.mjs`, one line in `kit/lib/init/steps.mjs` and one test. No repository holds a form this rule kept out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether any repository keeps its playbook outside `.omni-loop/`: the default keeps it inside, and the spec gives no example of one that does not.
