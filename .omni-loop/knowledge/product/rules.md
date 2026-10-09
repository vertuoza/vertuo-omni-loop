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

## BR-PRODUCT-3

When the only red check is the outbox context and only person-answered items remain, /omni:pr reports this in the status comment and stops. It never counts this as a failed attempt and never applies the labels.outboxGo override.

Serves: P-PRODUCT-3
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s4-03-outbox-check-red-is-the-gate, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## BR-PRODUCT-4

Every slice is claimed by a draft pull request before it is built, however it is started: the wave claims under --in-wave, and do-work run alone opens the claim itself when none exists.

Serves: P-PRODUCT-4
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s5-02-claim-first-alone, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## BR-PRODUCT-5

A feature pull request stays a draft while any question is open, with each open question posted on it. It is marked ready only after the work has been shipped, committed and pushed.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s9-01-gate-red-stays-draft, PRD #7
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #9

## BR-PRODUCT-6

The live outbox check passes the pull request's changed files to the gate, so a risky change nobody explained turns it red, as do open questions and unfinished rework.

Serves: P-PRODUCT-5
Source: .omni-loop/delivery/shipped/0028-omni-app-outbox-check/outbox/settled.md, entry s5-01-check-grades-changed-files, PRD #28
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #29

## BR-PRODUCT-7

The install sets laws.source to knowledge only when the knowledge registers hold at least one principle, rule or invariant. A knowledge folder that exists but is empty leaves it at none, even on a forced reinstall.

Serves: P-PRODUCT-6
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s4-02-laws-source-from-register-entries, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-8

When a kit default names {config:<key>} and the key is unknown, set to null, or holds a list or a section, the placeholder stays in the text exactly as written and a problem line is reported.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-01-kit-default-names-an-unset-setting, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-9

A form section holding repository text beside TODO(human) lines reads as text: the text shows as written, labelled [repo], and each TODO(human) line is still listed as an open question. A section holding only HTML comments reads as empty.

Serves: P-PRODUCT-8
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-02-section-with-text-and-open-questions, PRD #45
Enforced by: unenforced
Stated: 2026-09-25
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-10

Invade rewrites a knowledge-page section only when it is empty, holds nothing but TODO(human) lines, or its marker says by: invade; any other written section, labelled or not, is a person's and is left alone.

Serves: P-PRODUCT-9
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-03-terraform-treats-an-unmarked-section-as-a-persons, PRD #45
Enforced by: unenforced
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-11

Invade marks a form state: filled with invaded: <today> when any section holds text, a See: line or a TODO(human) question; only a wholly empty form stays state: blank with invaded: null.

Serves: P-PRODUCT-10
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-05-terraform-marks-a-form-holding-only-questions-filled, PRD #45
Enforced by: unenforced
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-25, PR #46

## BR-PRODUCT-12

A round moves only from open to answered, from open to abandoned, or from abandoned to answered from the terminal, and an answer never changes. A session is deleted only by its owner, its rounds with it; the hourly clean-up closes idle sessions and deletes nothing.

Serves: P-PRODUCT-11
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s2-04-round-moves-forward, PRD #71
Enforced by: unenforced
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## BR-PRODUCT-13

The ask page offers to send an answer only while the newest round is open, readable and younger than HOOK_WAIT_MS (540 s) by the server's clock. After that it shows the question as moved to the terminal, even without an abandon.

Serves: P-PRODUCT-12
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-02-question-moves-on-time, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## BR-PRODUCT-14

When a multi-select question has ticked choices and typed Other text, Claude receives the ticked labels in the order the options are listed, then the typed text, joined with ", ". For a single choice, typing an Other answer replaces the choice.

Serves: P-PRODUCT-13
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-03-own-answer-with-several-choices, PRD #71
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## BR-PRODUCT-15

omni ask on opens no session and closes none, so switching it on in one terminal never touches another. omni ask off closes every terminal's session of this checkout and always stops ask mode there, exiting 0, with one warning line per session the page could not be told; that session closes by itself after 12 hours without a call.

Serves: P-PRODUCT-14
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s5-02-switching-when-the-page-is-away, PRD #71
Enforced by: unenforced
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #73

## BR-PRODUCT-16

A retro field the model wrote is dropped when it exceeds its cap in rules or holds any refused word. The refused words are both kit question-pool lists: the game words and the person-or-team words.

Serves: P-PRODUCT-15
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s2-04-prose-caps-and-refused-words, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-17

A failing test is named by its file, groups and title joined by ' > ', with whitespace collapsed and line numbers and retry marks dropped, whatever tool ran it. Only final failures count; a test that passes on a retry within the run does not.

Serves: P-PRODUCT-16
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s3-03-one-name-per-failing-test, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-18

Retro churn counts only commits of pull requests merged into the feature branch, walked in merge order and skipping merge commits. A line range is churned when 3 commits wrote it, its first writing included.

Serves: P-PRODUCT-17
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-01-churn-counts-merged-work, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-19

Retro churn leaves out known lockfiles by name at any depth and paths the root .gitattributes marks linguist-generated at the merge. When no commit could be read, the churn section is left out, never shown as zeros, and retro.json records what was not read.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-03-churn-leaves-out-tool-written-files, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-20

When the retro grades a territory breach, shared ground is only the prefixes that two slices both declare in the plan's table. A path the plan's sharing note merely mentions is not shared, so a breach under it is still a finding.

Serves: P-PRODUCT-18
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s5-01-shared-ground-is-computed, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-21

In retro prose, a backtick span is set aside only when it holds a letter and appears verbatim in the evidence or is a finding id; only evidence URLs pass as links. A refused field is replaced by a fixed reason line, never the refused words.

Serves: P-PRODUCT-19
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s6-03-what-the-guard-counts-as-copied, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-22

A bug counts against a request when it has the bug label, was opened within 14 days of the merge and names #<prd>. It is fixed by a PR merged to the default branch in that window that closes it, and is tied to churn when its changed lines overlap a range, or by file when no patch is sent.

Serves: P-PRODUCT-20
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s8-05-what-ties-a-bug-to-the-prd, PRD #72
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #75

## BR-PRODUCT-23

The config refuses a signature.name or signature.email that is empty, holds a line break, or holds < or >, with an error naming that key. signature.footer only has to be non-empty.

Serves: P-PRODUCT-21
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s1-01-signature-name-address-shape, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-24

When any gh search for omni credits fails, the run prints one line and exits 2 with no report. When a pull request named by a signed commit cannot be opened, that pull request is left uncounted with a warning, unless gh is missing, logged out or rate limited.

Serves: P-PRODUCT-22
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s3-02-credits-other-github-failures, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-25

In omni credits, an issue or pull request opened by the signature's bot account is counted only on its own 'Opened by the app' line, never in the PR or PRD issue counts, and never marks when signing started in a repository.

Serves: P-PRODUCT-23
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-01-credits-app-items-counted-apart, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-26

With signing off, omni credits prints PRD issues as a bare count and omits the app and co-authored commit lines; with no bot account for the address, only the app line goes. Under --json those totals are null, never zero.

Serves: P-PRODUCT-24
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-03-credits-lines-not-looked-for, PRD #99
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #103

## BR-PRODUCT-27

A workspace theme colour is accepted only as a lowercase six-digit #rrggbb value, the same rule fleet colours follow; a value such as #A45CFF is refused, in the database and in the client schema alike.

Serves: P-PRODUCT-25
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-02-theme-colours-lowercase, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101

## BR-PRODUCT-28

link_github() answers only a caller who has at least one workspace_members row; anyone else is refused with 42501 and 'Sign in with an account of a workspace first.', whether or not GitHub is linked.

Serves: P-PRODUCT-26
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-03-link-github-needs-a-workspace, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-25
Merged: @pierrederval, 2026-09-26, PR #101

## BR-PRODUCT-29

Ask mode is open to any workspace member, whatever the account's email or with none: membership is the only gate, never an email domain. A session goes to the workspace that owns its repository, and is refused when the person is not a member of it; a repository no workspace owns goes to the person's first workspace. An account in no workspace is refused. Every member of a workspace reads its sessions and rounds; only a session's owner keeps, closes or deletes it.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace, PRD #100
Enforced by: unenforced
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #101

## BR-PRODUCT-30

When the arcade cannot read a signed-in person's memberships, domain join or loaders, it treats them as crew: it shows the galaxy-out-of-reach message and never the wrong-account screen.

Serves: P-PRODUCT-28
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s5-02-out-of-reach-is-not-outsider, PRD #100
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #101

## BR-PRODUCT-31

The public /design page dresses its heroes only in the six built-in fleets of the demo galaxy, never in any workspace's own fleets, whoever is viewing.

Serves: P-PRODUCT-29
Source: .omni-loop/delivery/shipped/0141-design-system/outbox/settled.md, entry s6-01-design-page-shows-the-built-in-fleets, PRD #141
Enforced by: unenforced
Stated: 2026-09-26
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-26, PR #153

## BR-PRODUCT-32

The arcade shows only the XP earned in the workspace it plays for a person, the one they joined first. A failed XP read shows XP out of reach with no level, while the galaxy, fleets and crew still show as read.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s2-01-xp-read-in-the-workspace-played, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## BR-PRODUCT-33

When the phone turns during an invaders game, the game keeps the field it started on (wide: ten columns and four shields; tall: six and three), letterboxed, until it ends. The next game uses the field of the current screen.

Serves: P-PRODUCT-31
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-03-a-game-keeps-its-field, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## BR-PRODUCT-34

In the arcade invaders game, alien rows are ordered by what each Entropy kind pays (woundClose), highest on top, with ties kept in the spec's order, so the top row always pays most whatever the values become.

Serves: P-PRODUCT-32
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-04-rows-follow-the-close-values, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## BR-PRODUCT-35

When a member leaves a workspace, their player row and every arcade_scores row keyed to it are removed with them, so the crew's score table never shows a departed player.

Serves: P-PRODUCT-33
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-01-scores-leave-with-the-player, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

## BR-PRODUCT-36

The arcade reads high scores only for players who linked GitHub, separately from the galaxy. A failed read shows SCORES OUT OF REACH on the cabinet while the galaxy, level and XP still show and the game plays. The demo's table holds only the guest's own best.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-04-scores-read-on-their-own, PRD #160
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #161

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

## BR-PRODUCT-39

An ask session that belongs to no workspace is kept, and nobody can read it, its owner included, until a person moves it into a workspace by hand. The change never deletes such a session.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s2-02-session-of-owner-in-no-workspace, PRD #144
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147

## BR-PRODUCT-40

The model's guessed category is written only while no person has set one, through a function only the session's owner may call, under the asker's own sign-in. A category a person set is never replaced by the guess.

Serves: P-PRODUCT-37
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s3-02-model-guess-never-overrides, PRD #144
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-26
Merged: @pierrederval, 2026-09-27, PR #147

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

## BR-PRODUCT-43

When a signed-in person with no galaxy on their page follows a link to the game's menu, the arcade starts from the intro as the home address does, then shows the outside-the-crew screen or the menu with the galaxy out of reach.

Serves: P-PRODUCT-40
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-03-menu-link-without-galaxy, PRD #238
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239

## BR-PRODUCT-44

While the OPEN THE APP? confirm is open, the arcade's timed hand-overs (boot, intro, welcome, fleet lock-in) wait. After a no, the same screen shows and restarts its timer in full, except the fleet lock-in, which still counts from when it began.

Serves: P-PRODUCT-41
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s3-02-timed-screens-wait-under-confirm, PRD #238
Enforced by: unenforced
Stated: 2026-09-27
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #239

## BR-PRODUCT-45

On HOME, pressing Enter runs PRESS START unless the focus is on a button, link or field, which then does what that control does. PRESS START opens the app last picked, or SELECT YOUR APP when none is remembered.

Serves: P-PRODUCT-42
Source: .omni-loop/delivery/shipped/0261-home/outbox/settled.md, entry s3-02-enter-on-focused-controls, PRD #261
Enforced by: unenforced
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-09-27
Merged: @pierrederval, 2026-09-27, PR #263

## BR-PRODUCT-46

A fleet's mascot is one of eleven keys held in a database list, the same list and order as the sprite library's mascots: beaver, octopus, duck, spy, pirate, invincible hero, Atom Eve, shark, turtle, Allen the Alien or robot. The commander, the enemy, the plain heroes and the small icons are refused.

Serves: P-PRODUCT-43
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-01-mascot-choices, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403

## BR-PRODUCT-47

A new fleet's key is its label lowercased, with each run of non-letters and non-digits turned into a dash (c-i-a). When that key is already taken, even by a retired fleet, a number is added (beaver-2).

Serves: P-PRODUCT-44
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-03-fleet-key-from-label, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403

## BR-PRODUCT-48

When a workspace has no fleets, the arcade menu keeps its FLEETS entry, hinted as no fleets yet, and it opens the invitation screen instead of the empty fleets wall; the Hall of Heroes fleet column and TOP FLEETS are hidden.

Serves: P-PRODUCT-45
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-01-fleets-menu-with-none, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403

## BR-PRODUCT-49

A player whose fleet was retired is sent to pick a fleet only while at least one fleet in the workspace is active. When none is, they count as ready, go straight to the menu under the retired fleet's name, and their stored fleet stays unchanged.

Serves: P-PRODUCT-46
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-02-disbanded-with-no-fleets, PRD #400
Enforced by: unenforced
Stated: 2026-09-28
Decided: nobody — adopted when raised (medium), 2026-09-28
Merged: @pierrederval, 2026-09-28, PR #403

## BR-PRODUCT-50

The dashboard's waiting-for-you tile counts the same questions the page's sidebar lists, each once, even one that is both yours and shared with you. When that list cannot be read, the tile says it could not load and the rest of the dashboard still shows.

Serves: P-PRODUCT-47
Source: .omni-loop/delivery/shipped/0657-snappy-pages/outbox/settled.md, entry s2-02-waiting-count-from-the-shared-list, PRD #657
Enforced by: unenforced
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #664

## BR-PRODUCT-51

A person's name links to their profile page only when they are a member of the workspace; the name of someone outside it, such as an outside contributor, is shown without a link.

Serves: P-PRODUCT-48
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s1-01-chip-links-members-only, PRD #698
Enforced by: unenforced
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-52

On a person's profile, each PRDs stage count opens the PRD list at that stage filtered to that person, never to everyone's or the viewer's own PRDs.

Serves: P-PRODUCT-49
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s3-02-profile-stage-links, PRD #698
Enforced by: unenforced
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-53

When the PRD list is narrowed to one person, it shows only the PRDs that person started in the app, the same rule as for your own PRDs. Who opened the GitHub issue never counts, and a PRD with no recorded starter shows under nobody.

Serves: P-PRODUCT-50
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s4-01-prd-opener-rule, PRD #698
Enforced by: unenforced
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-54

On a person's profile, a PRD, bug fix or visual update is listed for the chosen week, month or season when its latest activity falls within that period, even if it was started earlier; one started in the period with no activity since is judged by that latest activity.

Serves: P-PRODUCT-51
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s5-01-profile-work-period-by-activity, PRD #698
Enforced by: unenforced
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-55

A person's profile lists only the PRDs and fixes of the workspace the profile is about, as its board does. See all opens the full list, covering every workspace the viewer and that person both belong to.

Serves: P-PRODUCT-52
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s5-02-profile-work-one-workspace, PRD #698
Enforced by: unenforced
Stated: 2026-09-29
Decided: nobody — adopted when raised (medium), 2026-09-29
Merged: @pierrederval, 2026-09-29, PR #699

## BR-PRODUCT-56

When the hero loses a life with lives left, the stage waits on its ready screen with the stage and lives left until the player presses start, as a new game does; play then resumes from the stage's start with the score kept.

Serves: P-PRODUCT-53
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s2-01-ready-screen-after-a-life-lost, PRD #817
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #818

## BR-PRODUCT-57

The corner game box never takes the page's Tab or Shift keys, so a reader can always move between links while a game is open; Escape folds the box and B goes back to the game list.

Serves: P-PRODUCT-42
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s4-02-dock-select-stays-with-the-page, PRD #817
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #818

## BR-PRODUCT-58

On a stage clear screen, A or START goes on to the next stage's ready screen with score and lives kept, and B does nothing, so a run ends only at game over or the world's end, where its score is saved.

Serves: P-PRODUCT-54
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s3-01-stage-clear-goes-on, PRD #817
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #818

## BR-PRODUCT-59

Jev is on exactly when a key is stored: turning it off deletes the key and sets every decision to Off, and no decision may be Shadow or On without a key. Only the owner sees the key's last four and date; members see only whether Jev is on.

Serves: P-PRODUCT-55
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s1-02-jev-on-means-key-stored, PRD #812
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #814

## BR-PRODUCT-60

When a terminal asks Jev about a repository, the Jev settings of the workspace that owns it apply; a repository no workspace owns goes to the person's first-joined workspace, and one owned by a workspace the person is not in is refused.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s3-03-decide-unowned-repository, PRD #812
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #814

## BR-PRODUCT-61

The Jev page's agreement rate counts only calls where Jev and the old way both answered, including answers under the confidence floor. A call where Jev failed, had no key or answered outside the options adds only to the call count.

Serves: P-PRODUCT-56
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s4-01-agreement-counts-only-answered-calls, PRD #812
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #814

## BR-PRODUCT-62

When more than one workspace tracks a repository, the canon check reads the business of the workspace whose GitHub organisation owns the repository; when none does, it reads the workspace that started tracking it first.

Serves: P-PRODUCT-57
Source: .omni-loop/delivery/shipped/0839-canon-check/outbox/settled.md, entry s1-01-app-read-workspace-choice, PRD #839
Enforced by: unenforced
Stated: 2026-09-30
Decided: nobody — adopted when raised (medium), 2026-09-30
Merged: @pierrederval, 2026-09-30, PR #840

## BR-PRODUCT-63

A link may read a repository the workspace lists, or any repository the workspace's GitHub organisation owns, exactly as a member's own read allows; any other repository is refused, and it never reads another workspace's claims.

Serves: P-PRODUCT-58
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s1-01-token-repo-scope, PRD #855
Enforced by: unenforced
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856

## BR-PRODUCT-64

When a member leaves a workspace, every link they made stops working and any call through it is refused, yet it stays in the links list marked as not working because its maker left, so an owner can revoke it for good.

Serves: P-PRODUCT-26
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s1-02-left-maker-links-listed, PRD #855
Enforced by: unenforced
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856

## BR-PRODUCT-65

When an agent sends a question naming a code project that does not belong to the team's workspace, the question is refused with the same one-line reason given when the agent reads the business for that project; it is never kept.

Serves: P-PRODUCT-27
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s3-01-report-repo-must-be-the-workspaces, PRD #855
Enforced by: unenforced
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856

## BR-PRODUCT-66

Jev judges an agent's question only on the report that first stores it; a repeat only adds to its asked count and keeps its state. Once a person brings a question back, Jev never sets it aside again.

Serves: P-PRODUCT-37
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s4-02-jev-judges-first-report-bring-back-final, PRD #855
Enforced by: unenforced
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #856

## BR-PRODUCT-67

A product's Statement is a single line of at most 400 characters, and its owner can remove it and write a new one. Never line numbers count per product, so each product's first Never line is number one.

Serves: P-PRODUCT-59
Source: .omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md, entry s1-02-statement-shape-and-never-numbers, PRD #871
Enforced by: unenforced
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #874

## BR-PRODUCT-68

The inbox check turns red for a spec break only when it can quote the spec sentence and name the Never line or Statement it breaks. Jev's answer can only confirm or clear a quoted break; with no quoted finding, the check stays green whatever Jev says.

Serves: P-PRODUCT-60
Source: .omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md, entry s5-02-jev-broken-without-quote-is-not-red, PRD #871
Enforced by: unenforced
Stated: 2026-10-01
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-01, PR #874

## BR-PRODUCT-69

The plan check accepts a slice that must come first only when it sits strictly before every other slice, ordered by landing and then wave. A slice in a later landing already waits for it, the file limit counts the paths a slice lists, and every row is checked against this repository's rules.

Serves: P-PRODUCT-61
Source: .omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md, entry s3-01-plan-rules-order-and-reach, PRD #1089
Enforced by: unenforced
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-06
Merged: @pierrederval, 2026-10-06, PR #1090

## BR-PRODUCT-70

A product's pitch look may be changed by exactly those who may edit the workspace's business, which today is every member; anyone else sees it read-only.

Serves: P-PRODUCT-62
Source: .omni-loop/delivery/shipped/0859-pitch/outbox/settled.md, entry s1-02-every-member-edits-the-look, PRD #859
Enforced by: unenforced
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-01
Merged: @pierrederval, 2026-10-06, PR #860

## BR-PRODUCT-71

When a pull request waits on another that was closed without merging, it is no longer held and care goes back to fixing it. When the awaited pull request cannot be looked up, it stays held and no fix attempt is spent.

Serves: P-PRODUCT-63
Source: .omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md, entry s1-01-waits-on-closed-or-unreadable, PRD #1118
Enforced by: unenforced
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-06
Merged: @pierrederval, 2026-10-06, PR #1119

## BR-PRODUCT-72

The care list reads a bug's fix pull requests from its fix-plan table, one per row in table order, and takes the bug's record from the pull requests GitHub links as closing it. A repository with no pull request yet is left off until one opens.

Serves: P-PRODUCT-64
Source: .omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md, entry s1-02-care-list-reads-bug-fix-plan, PRD #1118
Enforced by: unenforced
Stated: 2026-10-06
Decided: nobody — adopted when raised (medium), 2026-10-06
Merged: @pierrederval, 2026-10-06, PR #1119

## BR-PRODUCT-73

A loop that has not yet said when it will wake next reads live until one hour after the last thing it pushed; only then is it shown silent and may it be taken over.

Serves: P-PRODUCT-2
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s2-01-loop-silent-before-first-wake, PRD #1139
Enforced by: unenforced
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-74

Parking a PRD records who it waits on and the loop keeps running; a later round of that PRD takes it off the parked list. A stopping loop ends parked if PRDs still wait, else stopped, and an ended loop refuses any push.

Serves: P-PRODUCT-65
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s2-02-loop-park-and-stop, PRD #1139
Enforced by: unenforced
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-75

A signed-out visitor to the Loop page or one loop's page is asked to sign in, the same as on the Engineering page. The demo loops show only where every page shows its demo: in development or when the demo mode is switched on.

Serves: P-PRODUCT-66
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s5-02-loop-page-signed-out, PRD #1139
Enforced by: unenforced
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-76

omni loop push counts as off, printing off and exiting 1, only when ask.url is not set. It never reads dossier.enabled, so a repository with the dossier switched off still sends its loop state to the Loop page.

Serves: P-PRODUCT-67
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s4-01-loop-push-off-switch, PRD #1139
Enforced by: unenforced
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1142

## BR-PRODUCT-77

Answering a question on a PRD earns the answerer 2 points and earns their fleet the same 2 points. If that PRD is later lost, those answer points are taken back in its season, like the rest of that PRD's points.

Serves: P-PRODUCT-68
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s1-01-answers-pay-the-fleet-too, PRD #1180
Enforced by: game/rulebook.test.ts, game/projector.test.ts, game/economy.test.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181

## BR-PRODUCT-78

Every answered question earns points for the answerer when they are a current workspace member with a GitHub login, whether or not a numbered PRD claims it. An answer no PRD claims is credited on planet 0, which the map and the season's planets leave out.

Serves: P-PRODUCT-69
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s1-03-which-answers-are-paid, PRD #1180
Enforced by: supabase/checks/game_answered_rounds.sql, supabase/migrations/20261109090000_game_answered_rounds.sql, game/sources/supabase.test.ts, supabase/migrations/20261118090000_every_answer_pays.sql
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181

## BR-PRODUCT-79

A point credited to a GitHub login is credited under that login; a login with capitals is accepted, never skipped, and answer points arrive already in lower case. The event is skipped only when the name holds an at sign, a dot, a space or another character no GitHub login can hold.

Serves: P-PRODUCT-70
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s3-01-capital-login-skipped, PRD #1180
Enforced by: game/projector.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181

## BR-PRODUCT-80

When a settled decision names an approver that no GitHub login can have, such as a dotted name, its settle is skipped with a warning and earns no one credit. The decision stays open until the name is corrected, then it is credited to that login.

Serves: P-PRODUCT-71
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s3-02-dotted-approver-waits, PRD #1180
Enforced by: game/sources/parsers.test.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1181

## BR-PRODUCT-81

Any member of a roadmap's workspace may push an update to it, replacing its document and PRD rows, and the roadmap records the member who pushed last.

Serves: P-PRODUCT-72
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s2-02-roadmap-any-member-pushes, PRD #1162
Enforced by: supabase/checks/roadmaps.sql, apps/galaxy/src/roadmap/migration.test.ts, kit/lib/roadmap/push.test.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-82

The plan check refuses a target only for blockers in the repositories its own consumes list names; a chain through a middle repository is not followed. A repository installed indirectly must be listed in the target's consumes list to be refused.

Serves: P-PRODUCT-61
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s3-01-consumes-is-direct-only, PRD #1162
Enforced by: unenforced
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-83

The roadmap check refuses a project that installs another repository's package unless its wave comes after every project it waits on, directly or through others, that changes that repository. Projects that do not wait on each other may share a wave.

Serves: P-PRODUCT-61
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-01-consumer-rule-follows-blockers, PRD #1162
Enforced by: kit/lib/roadmap/grade.test.ts, kit/lib/roadmap/grade.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-84

The roadmap check accepts a row when its project's folder is in the inbox or the shipped folder, and compares its spec wherever it lives; only a row whose project is in neither is refused.

Serves: P-PRODUCT-73
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-02-shipped-prd-still-counts, PRD #1162
Enforced by: kit/lib/roadmap/grade.test.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-85

In a plan repository's roadmap, every project must name at least one repository; outside a plan repository, a repositories column is refused. The source line, like the product and target date, is optional.

Serves: P-PRODUCT-74
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-03-repos-column-and-source, PRD #1162
Enforced by: kit/lib/roadmap/parse.test.ts, kit/lib/roadmap/grade.test.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-86

omni roadmap push marks a PRD building once its feature PR is open, outbox when its draft holds open questions, ready once every part is ready, merged once every part merged; a PRD not started names its first unmerged blocker. If GitHub is unreadable, nothing is pushed.

Serves: P-PRODUCT-75
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s6-01-roadmap-push-reads-the-prs, PRD #1162
Enforced by: kit/lib/roadmap/push.test.ts, kit/bin/roadmap.test.ts
Stated: 2026-10-07
Decided: nobody — adopted when raised (medium), 2026-10-07
Merged: @pierrederval, 2026-10-07, PR #1163

## BR-PRODUCT-87

The steps to launch list only steps that have work to start and are not already running; a step that only waits is left out. Held names only steps a rule keeps back, never a step left out because every slot is full.

Serves: P-PRODUCT-76
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s1-01-steps-only-act, PRD #1205
Enforced by: kit/lib/next/follow.test.ts, kit/bin/next.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1206

## BR-PRODUCT-88

A PRD runs the wave holding a live claim (a draft sub-PR in flight, not stale or stalled) on one of its slices. Otherwise, when its feature PR has the in-progress label and a status comment fresh within the claim limit, it runs its first step not done.

Serves: P-PRODUCT-77
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s1-02-running-read, PRD #1205
Enforced by: kit/lib/next/follow.test.ts, kit/bin/next.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1206

## BR-PRODUCT-89

While a step the drive session started is not yet shown running on GitHub, the session launches no new step. It never launches a step for a PRD it already has a step agent on, and never runs more than limits.parallelSteps agents at once.

Serves: P-PRODUCT-78
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s2-01-unseen-step-holds-pool, PRD #1205
Enforced by: kit/test/plugin.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1206

## BR-PRODUCT-90

When a session's branch names a feature or a fix, the session shows that work, even if its record says it last worked on something else. Only on a branch that names nothing does it show the last recorded work.

Serves: P-PRODUCT-79
Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s2-01-branch-before-record, PRD #1208
Enforced by: kit/lib/now/now.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## BR-PRODUCT-91

The status line refreshes the links of the work a session is on when they are missing or a minute old and no refresh holds them, for a PRD not yet shipped (in review included) and a fix not yet merged; finished work is never refreshed.

Serves: P-PRODUCT-80
Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s5-03-links-refresh-for-any-live-work, PRD #1208
Enforced by: kit/bin/statusline.test.ts, kit/lib/statusline/board-cache.test.ts
Stated: 2026-10-08
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-08, PR #1210

## BR-PRODUCT-92

The dashboard counts only PRDs and fixes. A concept stored in the workspace is read without failing the dashboard and is left out of its counts, since concepts have their own list.

Serves: P-PRODUCT-30
Source: .omni-loop/delivery/shipped/1272-concepts-page/outbox/settled.md, entry s2-01-dashboard-skips-concepts, PRD #1272
Enforced by: apps/galaxy/src/data/dossiers.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-09, PR #1282

## BR-PRODUCT-93

A concept's review state is unknown when no facts are stored for it, or its stored pull request is unread or missing. The concepts list reads only stored facts and never asks GitHub; the sync or the concept's own page fills them in.

Serves: P-PRODUCT-7
Source: .omni-loop/delivery/shipped/1272-concepts-page/outbox/settled.md, entry s4-02-concept-state-unknown-until-read, PRD #1272
Enforced by: apps/galaxy/src/concepts/state.test.ts, apps/galaxy/src/concepts/list.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-08
Merged: @pierrederval, 2026-10-09, PR #1282

## BR-PRODUCT-94

An approval request's author is whoever opened the PRD, or the person asking when no opener is recorded; any request after a PRD's first is a re-ask. A request stays in the asked person's bell until someone approves the PRD at or after the time it was asked.

Serves: P-PRODUCT-81
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s2-03-who-the-author-is-and-when-a-request-stops-waiting, PRD #1322
Enforced by: supabase/checks/approval_requests.sql, apps/galaxy/src/waiting/approvals.test.ts, apps/galaxy/src/approvals/approvals.repository.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09

## BR-PRODUCT-95

The band shows the approval wait of the PRD the session is on, else the most recent wait that still shows something. While a wait shows, it checks again every 5 seconds, so an approval appears within seconds and keeps its 10-second notice.

Serves: P-PRODUCT-79
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s5-01-which-wait-the-band-shows, PRD #1322
Enforced by: kit/lib/now/wait.test.ts, kit/plugin-hud/tests/hud.test.tsx
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09

## BR-PRODUCT-96

Turning phone alerts off on one device removes that device's subscription and turns phone alerts off for the person, so none of their devices is alerted until they turn phone alerts on again.

Serves: P-PRODUCT-82
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s9-02-phone-alerts-off-is-per-person, PRD #1322
Enforced by: apps/galaxy/src/push/api.test.ts, apps/galaxy/src/profile/alerts.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09

## BR-PRODUCT-97

A fresh connection to the approval stream hears the PRD's latest request, then only what followed the later of that request and the latest void. A resumed connection hears only events after the last id it saw; an unknown id counts as none.

Serves: P-PRODUCT-83
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s3-01-what-the-stream-replays-and-its-event-ids, PRD #1322
Enforced by: apps/galaxy/src/approvals/stream.service.test.ts, apps/galaxy/src/approvals/stream.controller.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09

## BR-PRODUCT-98

When one push changes several approved files, each changed file is recorded as its own void of the approval, and the approver gets one alert and one email for that push listing every changed file. A later push does not void the same approval again.

Serves: P-PRODUCT-84
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s6-01-one-void-per-changed-file-one-alert-per-push, PRD #1322
Enforced by: supabase/checks/approval_voiding.sql, apps/galaxy/src/approvals/void.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09

## BR-PRODUCT-99

When the page cannot read who a product asks to approve, it offers Approve to every member. The server still refuses anyone the product does not ask, in its own words, and nothing is approved.

Serves: P-PRODUCT-85
Source: .omni-loop/delivery/shipped/1322-approval-handshake/outbox/settled.md, entry s7-01-approvers-unread-shows-approve, PRD #1322
Enforced by: apps/galaxy/src/dossier/page/approval.test.ts, apps/galaxy/src/approval/approval-api.test.ts
Stated: 2026-10-09
Decided: nobody — adopted when raised (medium), 2026-10-09
Merged: @pierrederval, 2026-10-09, PR #1324
Proposed: harvest 2026-10-09
