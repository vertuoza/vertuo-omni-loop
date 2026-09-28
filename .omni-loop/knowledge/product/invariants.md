# Product invariants

## N-PRODUCT-1

Library modules under kit/lib never perform network I/O; any client for the code-hosting service lives in the command-line layer (kit/bin) and is injected into the library.

Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s15-02-github-client-in-bin, PRD #3
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4
Proposed: harvest 2026-09-26

## N-PRODUCT-2

The kit runs only inside a repository under git; tracked files always come from version control, and there is no fallback that walks plain folders.

Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s3-01-tracked-files-need-git, PRD #3
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4
Proposed: harvest 2026-09-26

## N-PRODUCT-3

A raised item is graded by the same check the outbox gate uses before anything is written or adopted, so a bad option or a below-floor rank is refused at the source.

Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s13-01-item-new-json-shape-and-input-flag-rename, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Proposed: harvest 2026-09-26

## N-PRODUCT-4

The outbox gate reads its settings from the base branch and only the delivery folder from the pull request's head, so a pull request can never change the rules it is judged by, such as the override label.

Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s1-01-evaluate-reads-two-snapshots, PRD #28
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29
Proposed: harvest 2026-09-26

## N-PRODUCT-5

kit/build.mjs builds a byte-identical bundle wherever it is started from, with the working directory pinned to the repository root, and tests build to a scratch file rather than overwriting the committed kit/dist/omni.mjs.

Source: .omni-loop/delivery/shipped/0039-omni-init/outbox/settled.md, entry s3-03-build-script-outfile-and-fixed-working-dir, PRD #39
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #40
Proposed: harvest 2026-09-26

## N-PRODUCT-6

omni init writes no file in the repository outside .omni-loop/ and the statusLine key of .claude/settings.json; it also creates a branch, commits, pushes and opens a pull request with what it wrote, and installs the Claude Code plugin on the computer it runs on. When a kept config puts the playbook elsewhere, it writes no knowledge forms, says so in its closing message and leaves them to /omni:terraform, which runs omni kb init.

Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s4-04-install-writes-no-form-outside-its-folder, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Proposed: harvest 2026-09-26

## N-PRODUCT-7

A plugin hook that cannot run never blocks a person's message or question: each hooks.json command ends in || true, and omni ask hook exits 0 with no output for any known kind, whatever the repository, config or server state.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-03-hooks-never-block, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Proposed: harvest 2026-09-26

## N-PRODUCT-8

The ask hooks send no call unless ask.url is set in the repository's config and its host equals the host saved in the session. Every call goes to a path under ask.url, and emptying the setting switches the mode off at once.

Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s1-04-where-the-hooks-send-calls, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Proposed: harvest 2026-09-26

## N-PRODUCT-9

Each game/cli script parses its own arguments in openWorkspace() before any read, and any argument it does not understand exits 2 with the usage line before Supabase or GitHub is called.

Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s4-01-game-scripts-refuse-stray-arguments, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101
Proposed: harvest 2026-09-26
