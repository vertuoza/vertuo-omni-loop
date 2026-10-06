---
id: s6-01-target-flow-copy-and-grading
prd: 1089
slice: s6
rank: medium
bears-on: none
raised: 2026-10-06
wave: 5
---

## The question, in plain words

When a plan spans several repositories, where does the plan repository keep each target's own rules, which rules does a target without such a copy meet, and how is a target whose rules changed since then reported?

## The decision, in plain words

Each imported target's rules sit in a flow folder inside its copy, with its hook files beside them; a target with no copied rules is checked against the loop's usual rules only; and a target whose rules changed since they were copied is listed as out of date, the reason naming its rules.

## The intro, for fun

Three repositories walk into one plan, each carrying its own house rules.

## The punchline, for fun

Each now gets judged by its own rulebook, and a rulebook that changed gets flagged.

## The options, in plain words

A. A. Keep it: rules and hooks kept in the copy's flow folder, the usual rules for a target with no copied rules, rules read one repository at a time, and changed rules reported as an out-of-date target.
B. B. Grade a target with no copied flow against the plan repository's own flow, as before this slice.
C. C. Add a separate moved state to omni targets for a changed flow, apart from stale evidence.

## What I had to decide

Whether the copy's layout, the fallback for targets without a copied flow, the per-repository reading of rules across slices, and reporting a moved flow as an out-of-date target are what the team wants before the merge-wide skills follow them.

## What I did meanwhile

Built it that way: the copy holds flow/config.yml (the target's flow, landings and pr keys) and each hook file at its own path under flow/; omni plan check grades each repository's rows against its own flow, the plan repository's own rows against its own, and a target with no copied flow against the kit's defaults; omni flow show --repo reads the copy; omni targets reads an imported target stale with a 'flow moved since read at' detail when its committed flow or a hook file differs from the copy. To make the commands and the GitHub App use it, I changed a few files outside the slice's listed ground: the plan check and flow show commands, the App's inbox check (and its rebuilt bundle), and the two command test files.

## What it costs to change later

A constant change in kit/lib/plan-repo/copy-flow.ts, kit/lib/inbox/plan-grade.ts and kit/lib/plan-repo/targets.ts with their tests: another file name, grading targets without a copy against the plan repository's own flow, reading rules across repositories, or a separate moved state are each a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the copy lives under the copy's flow folder but not the file's name or how hook files are laid out: flow/config.yml and the hooks at their own repository paths under flow/ were chosen, and the mega-invade skill (slice s7) must write them that way.
- (author) The spec does not say what an own or none target's rows meet: the kit's defaults here, since the plan repository's areas name its own paths, not the target's.
- (author) Wave first, blocks all and landing alone now read the slices of one repository at a time; the spec does not say whether a target's kernel must come before slices of other repositories.
- (author) The done-when says moved; omni targets has no moved state, so the existing stale state carries it, its detail starting 'flow moved since read at'.
- (author) omni help flow still shows flow show without --repo: the help entries sit outside this slice's ground; the command's own usage line names it.
