# Product rules

## BR-PRODUCT-1

In a phase-0 pull request, a path under the delivery folder, the knowledge root or the decision-record folder, or equal to the glossary or a context file, counts as documentation. Any other path that is not a PRD-folder or acceptance file counts as source.

Serves: P-PRODUCT-1
Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s13-01-phase-0-docs-kind, PRD #3
Enforced by: unenforced
Stated: 2026-09-25
Decided: @claude-code-session (delegated by pierre-derval) via PRD issue #3, 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #4

## BR-PRODUCT-2

When a pull request's head commit date cannot be read, the claimed-stale check treats the claim as having moved on, so the slice is never marked stale on that signal alone.

Serves: P-PRODUCT-2
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s3-03-unknown-head-commit-date-reads-as-not-stale, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Proposed: harvest 2026-09-26

## BR-PRODUCT-3

When the only red check is the outbox context and only person-answered items remain, /omni:pr reports this in the status comment and stops. It never counts this as a failed attempt and never applies the labels.outboxGo override.

Serves: P-PRODUCT-3
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s4-03-outbox-check-red-is-the-gate, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Proposed: harvest 2026-09-26

## BR-PRODUCT-4

Every slice is claimed by a draft pull request before it is built, however it is started: the wave claims under --in-wave, and do-work run alone opens the claim itself when none exists.

Serves: P-PRODUCT-4
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s5-02-claim-first-alone, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Proposed: harvest 2026-09-26

## BR-PRODUCT-5

A feature pull request stays a draft while any question is open, with each open question posted on it. It is marked ready only after the work has been shipped, committed and pushed.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s9-01-gate-red-stays-draft, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9
Proposed: harvest 2026-09-26

## BR-PRODUCT-6

The live outbox check passes the pull request's changed files to the gate, so a risky change nobody explained turns it red, as do open questions and unfinished rework.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s5-01-check-grades-changed-files, PRD #28
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29
Proposed: harvest 2026-09-26

## BR-PRODUCT-7

The install sets laws.source to knowledge only when the knowledge registers hold at least one principle, rule or invariant. A knowledge folder that exists but is empty leaves it at none, even on a forced reinstall.

Serves: P-PRODUCT-6
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s4-02-laws-source-from-register-entries, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Proposed: harvest 2026-09-26

## BR-PRODUCT-8

When a kit default names {config:<key>} and the key is unknown, set to null, or holds a list or a section, the placeholder stays in the text exactly as written and a problem line is reported.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-01-kit-default-names-an-unset-setting, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Proposed: harvest 2026-09-26

## BR-PRODUCT-9

A form section holding repository text beside TODO(human) lines reads as text: the text shows as written, labelled [repo], and each TODO(human) line is still listed as an open question. A section holding only HTML comments reads as empty.

Serves: P-PRODUCT-8
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-02-section-with-text-and-open-questions, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Proposed: harvest 2026-09-26

## BR-PRODUCT-10

Terraform rewrites a knowledge-page section only when it is empty, holds nothing but TODO(human) lines, or its marker says by: terraform; any other written section, labelled or not, is a person's and is left alone.

Serves: P-PRODUCT-9
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-03-terraform-treats-an-unmarked-section-as-a-persons, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Proposed: harvest 2026-09-26

## BR-PRODUCT-11

Terraform marks a form state: filled with terraformed: <today> when any section holds text, a See: line or a TODO(human) question; only a wholly empty form stays state: blank with terraformed: null.

Serves: P-PRODUCT-10
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-05-terraform-marks-a-form-holding-only-questions-filled, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46
Proposed: harvest 2026-09-26

## BR-PRODUCT-12

A round moves only from open to answered, from open to abandoned, or from abandoned to answered from the terminal, and an answer never changes. Only the clean-up deletes sessions; their owners cannot.

Serves: P-PRODUCT-11
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s2-04-round-moves-forward, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Proposed: harvest 2026-09-26

## BR-PRODUCT-13

The ask page offers to send an answer only while the newest round is open, readable and younger than HOOK_WAIT_MS (540 s) by the server's clock. After that it shows the question as moved to the terminal, even without an abandon.

Serves: P-PRODUCT-12
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-02-question-moves-on-time, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Proposed: harvest 2026-09-26

## BR-PRODUCT-14

When a multi-select question has ticked choices and typed Other text, Claude receives the ticked labels in the order the options are listed, then the typed text, joined with ", ". For a single choice, typing an Other answer replaces the choice.

Serves: P-PRODUCT-13
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-03-own-answer-with-several-choices, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Proposed: harvest 2026-09-26

## BR-PRODUCT-15

omni ask on changes nothing unless a new session was opened, so a session already on stays on. omni ask off always stops ask mode on this computer and exits 0, with one warning line when the page could not be told.

Serves: P-PRODUCT-14
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s5-02-switching-when-the-page-is-away, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73
Proposed: harvest 2026-09-26

## BR-PRODUCT-16

A retro field the model wrote is dropped when it exceeds its cap in rules or holds any refused word. The refused words are both kit question-pool lists: the game words and the person-or-team words.

Serves: P-PRODUCT-15
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s2-04-prose-caps-and-refused-words, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-17

A failing test is named by its file, groups and title joined by ' > ', with whitespace collapsed and line numbers and retry marks dropped, whatever tool ran it. Only final failures count; a test that passes on a retry within the run does not.

Serves: P-PRODUCT-16
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s3-03-one-name-per-failing-test, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-18

Retro churn counts only commits of pull requests merged into the feature branch, walked in merge order and skipping merge commits. A line range is churned when 3 commits wrote it, its first writing included.

Serves: P-PRODUCT-17
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-01-churn-counts-merged-work, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-19

Retro churn leaves out known lockfiles by name at any depth and paths the root .gitattributes marks linguist-generated at the merge. When no commit could be read, the churn section is left out, never shown as zeros, and retro.json records what was not read.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-03-churn-leaves-out-tool-written-files, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-20

When the retro grades a territory breach, shared ground is only the prefixes that two slices both declare in the plan's table. A path the plan's sharing note merely mentions is not shared, so a breach under it is still a finding.

Serves: P-PRODUCT-18
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s5-01-shared-ground-is-computed, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-21

In retro prose, a backtick span is set aside only when it holds a letter and appears verbatim in the evidence or is a finding id; only evidence URLs pass as links. A refused field is replaced by a fixed reason line, never the refused words.

Serves: P-PRODUCT-19
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s6-03-what-the-guard-counts-as-copied, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-22

A bug counts against a request when it has the bug label, was opened within 14 days of the merge and names #<prd>. It is fixed by a PR merged to the default branch in that window that closes it, and is tied to churn when its changed lines overlap a range, or by file when no patch is sent.

Serves: P-PRODUCT-20
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s8-05-what-ties-a-bug-to-the-prd, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75
Proposed: harvest 2026-09-26

## BR-PRODUCT-23

The config refuses a signature.name or signature.email that is empty, holds a line break, or holds < or >, with an error naming that key. signature.footer only has to be non-empty.

Serves: P-PRODUCT-21
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s1-01-signature-name-address-shape, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #103
Proposed: harvest 2026-09-26

## BR-PRODUCT-24

When any gh search for omni credits fails, the run prints one line and exits 2 with no report. When a pull request named by a signed commit cannot be opened, that pull request is left uncounted with a warning, unless gh is missing, logged out or rate limited.

Serves: P-PRODUCT-22
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s3-02-credits-other-github-failures, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103
Proposed: harvest 2026-09-26

## BR-PRODUCT-25

In omni credits, an issue or pull request opened by the signature's bot account is counted only on its own 'Opened by the app' line, never in the PR or PRD issue counts, and never marks when signing started in a repository.

Serves: P-PRODUCT-23
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-01-credits-app-items-counted-apart, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103
Proposed: harvest 2026-09-26

## BR-PRODUCT-26

With signing off, omni credits prints PRD issues as a bare count and omits the app and co-authored commit lines; with no bot account for the address, only the app line goes. Under --json those totals are null, never zero.

Serves: P-PRODUCT-24
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-03-credits-lines-not-looked-for, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103
Proposed: harvest 2026-09-26

## BR-PRODUCT-27

A workspace theme colour is accepted only as a lowercase six-digit #rrggbb value, the same rule fleet colours follow; a value such as #A45CFF is refused, in the database and in the client schema alike.

Serves: P-PRODUCT-25
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-02-theme-colours-lowercase, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101
Proposed: harvest 2026-09-26

## BR-PRODUCT-28

link_github() answers only a caller who has at least one workspace_members row; anyone else is refused with 42501 and 'Sign in with an account of a workspace first.', whether or not GitHub is linked.

Serves: P-PRODUCT-26
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-03-link-github-needs-a-workspace, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101
Proposed: harvest 2026-09-26

## BR-PRODUCT-29

Ask mode is open to any account that belongs to at least one workspace, whichever it is, and each person sees only their own sessions and rounds. An account in no workspace is refused, even with a vertuoza.com email.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #101
Proposed: harvest 2026-09-26

## BR-PRODUCT-30

When the arcade cannot read a signed-in person's memberships, domain join or loaders, it treats them as crew: it shows the galaxy-out-of-reach message and never the wrong-account screen.

Serves: P-PRODUCT-28
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s5-02-out-of-reach-is-not-outsider, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #101
Proposed: harvest 2026-09-26

## BR-PRODUCT-31

The public /design page dresses its heroes only in the six built-in fleets of the demo galaxy, never in any workspace's own fleets, whoever is viewing.

Serves: P-PRODUCT-29
Source: .omni-loop/delivery/shipped/0141-design-system/outbox/settled.md, entry s6-01-design-page-shows-the-built-in-fleets, PRD #141
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #153
Proposed: harvest 2026-09-26

## BR-PRODUCT-32

The arcade shows only the XP earned in the workspace it plays for a person, the one they joined first. A failed XP read shows XP out of reach with no level, while the galaxy, fleets and crew still show as read.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s2-01-xp-read-in-the-workspace-played, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Proposed: harvest 2026-09-27

## BR-PRODUCT-33

When the phone turns during an invaders game, the game keeps the field it started on (wide: ten columns and four shields; tall: six and three), letterboxed, until it ends. The next game uses the field of the current screen.

Serves: P-PRODUCT-31
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-03-a-game-keeps-its-field, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Proposed: harvest 2026-09-27

## BR-PRODUCT-34

In the arcade invaders game, alien rows are ordered by what each Entropy kind pays (woundClose), highest on top, with ties kept in the spec's order, so the top row always pays most whatever the values become.

Serves: P-PRODUCT-32
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-04-rows-follow-the-close-values, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Proposed: harvest 2026-09-27

## BR-PRODUCT-35

When a member leaves a workspace, their player row and every arcade_scores row keyed to it are removed with them, so the crew's score table never shows a departed player.

Serves: P-PRODUCT-33
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-01-scores-leave-with-the-player, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Proposed: harvest 2026-09-27

## BR-PRODUCT-36

The arcade reads high scores only for players who linked GitHub, separately from the galaxy. A failed read shows SCORES OUT OF REACH on the cabinet while the galaxy, level and XP still show and the game plays. The demo's table holds only the guest's own best.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-04-scores-read-on-their-own, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161
Proposed: harvest 2026-09-27

## BR-PRODUCT-37

The level-up screen names the first registry game whose unlock level is above the level this device last celebrated and at or below the level reached, and only when the player's saved record holds it as unlocked.

Serves: P-PRODUCT-35
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s6-02-levels-climbed-between-visits, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## BR-PRODUCT-38

Each question's cost uses the price list's per-million-token prices. Cache reads cost 0.1× and cache writes 1.25× the input price unless the model's own entry says otherwise. A model not on the list shows no cost, never a guess.

Serves: P-PRODUCT-36
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s1-03-price-table-values, PRD #144
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Proposed: harvest 2026-09-27

## BR-PRODUCT-39

An ask session that belongs to no workspace is kept, and nobody can read it, its owner included, until a person moves it into a workspace by hand. The change never deletes such a session.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s2-02-session-of-owner-in-no-workspace, PRD #144
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Proposed: harvest 2026-09-27

## BR-PRODUCT-40

The model's guessed category is written only while no person has set one, through a function only the session's owner may call, under the asker's own sign-in. A category a person set is never replaced by the guess.

Serves: P-PRODUCT-37
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s3-02-model-guess-never-overrides, PRD #144
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147
Proposed: harvest 2026-09-27

## BR-PRODUCT-41

The share list and the already-answered note name each workspace member by their arcade name, or by their email address when they have none. The list is given only to members of that same workspace.

Serves: P-PRODUCT-38
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s4-01-teammates-named-by-email, PRD #144
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147

## BR-PRODUCT-42

Whenever a player enters the arcade menu, including through the #menu link, with a level this device has not yet celebrated, the LEVEL UP screen plays first and the menu opens once it is done.

Serves: P-PRODUCT-39
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-02-level-up-before-menu-link, PRD #238
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239
Proposed: harvest 2026-09-27

## BR-PRODUCT-43

When a signed-in person with no galaxy on their page follows a link to the game's menu, the arcade starts from the intro as the home address does, then shows the outside-the-crew screen or the menu with the galaxy out of reach.

Serves: P-PRODUCT-40
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-03-menu-link-without-galaxy, PRD #238
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239
Proposed: harvest 2026-09-27

## BR-PRODUCT-44

While the OPEN THE APP? confirm is open, the arcade's timed hand-overs (boot, intro, welcome, fleet lock-in) wait. After a no, the same screen shows and restarts its timer in full, except the fleet lock-in, which still counts from when it began.

Serves: P-PRODUCT-41
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s3-02-timed-screens-wait-under-confirm, PRD #238
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239

## BR-PRODUCT-45

On HOME, pressing Enter starts the game unless the focus is on a button, link or field, which then does what that control does; a focused PRESS START still starts the game.

Serves: P-PRODUCT-42
Source: .omni-loop/delivery/shipped/0261-home/outbox/settled.md, entry s3-02-enter-on-focused-controls, PRD #261
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #263
Proposed: harvest 2026-09-27

## BR-PRODUCT-46

A fleet's mascot is one of six keys held in a database list: beaver, octopus, duck, spy, pirate or invincible hero. The commander, the enemy, the plain heroes and the small icons are refused.

Serves: P-PRODUCT-43
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-01-mascot-choices, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Proposed: harvest 2026-09-28

## BR-PRODUCT-47

A new fleet's key is its label lowercased, with each run of non-letters and non-digits turned into a dash (c-i-a). When that key is already taken, even by a retired fleet, a number is added (beaver-2).

Serves: P-PRODUCT-44
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-03-fleet-key-from-label, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Proposed: harvest 2026-09-28

## BR-PRODUCT-48

When a workspace has no fleets, the arcade menu keeps its FLEETS entry, hinted as no fleets yet, and it opens the invitation screen instead of the empty fleets wall; the Hall of Heroes fleet column and TOP FLEETS are hidden.

Serves: P-PRODUCT-45
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-01-fleets-menu-with-none, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Proposed: harvest 2026-09-28

## BR-PRODUCT-49

A player whose fleet was retired is sent to pick a fleet only while at least one fleet in the workspace is active. When none is, they count as ready, go straight to the menu under the retired fleet's name, and their stored fleet stays unchanged.

Serves: P-PRODUCT-46
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-02-disbanded-with-no-fleets, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403
Proposed: harvest 2026-09-28
