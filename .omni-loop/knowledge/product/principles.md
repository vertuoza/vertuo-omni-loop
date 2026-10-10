# Product principles

## P-PRODUCT-1

The pull request that opens a feature carries documentation only, and it may include knowledge, decision records, glossary and context edits alongside the feature folder.

Why: Opening a feature often needs knowledge and decision-record updates, and splitting them into separate pull requests adds friction without adding safety.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0003-omni-loop-kit/outbox/settled.md, entry s13-01-phase-0-docs-kind, PRD #3
Merged: @pierrederval, 2026-09-25, PR #4

## P-PRODUCT-2

The kit only reclaims a claimed slice on signals it has actually confirmed; an unknown signal never counts against the claimant.

Why: Reclaiming on an unconfirmed signal risks taking work out from under someone who is still building it.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s3-03-unknown-head-commit-date-reads-as-not-stale, PRD #7
Merged: @pierrederval, 2026-09-25, PR #9

## P-PRODUCT-3

The outbox gate stays red until a person answers the open questions, and the agent never overrides it on anyone's behalf.

Why: A red gate for person-answered items is the gate working. Treating it as a failure or overriding it would skip the human decision the gate exists to require.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s4-03-outbox-check-red-is-the-gate, PRD #7
Merged: @pierrederval, 2026-09-25, PR #9

## P-PRODUCT-4

Work on a slice is visibly claimed before building begins, whatever path starts it.

Why: A visible claim stops two builders from taking the same slice and shows others that the work is under way.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s5-02-claim-first-alone, PRD #7
Merged: @pierrederval, 2026-09-25, PR #9

## P-PRODUCT-5

A pull request is marked ready only when nothing about it is still open.

Why: Reviewers and CI should treat ready as finished work, not work still waiting on answers.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0007-omni-loop-skills/outbox/settled.md, entry s9-01-gate-red-stays-draft, PRD #7
Merged: @pierrederval, 2026-09-25, PR #9

## P-PRODUCT-6

Agents are bound by a repository's product laws only once someone has actually written some, never merely because the place to write them exists.

Why: Every install now creates the knowledge folder, so treating that folder alone as a signal would switch on empty laws in repositories that never chose to have any.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s4-02-laws-source-from-register-entries, PRD #45
Merged: @pierrederval, 2026-09-25, PR #46

## P-PRODUCT-7

A kit default never shows a guessed value; anything the kit cannot fill exactly stays visible and is reported.

Why: Readers and templates must be able to trust filled text, and a visible gap is safer than a silent or invented value.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-01-kit-default-names-an-unset-setting, PRD #45
Merged: @pierrederval, 2026-09-25, PR #46

## P-PRODUCT-8

What the repository wrote in a form always shows, never hidden behind the kit's shared default, and an open question is never dropped from the count.

Why: People and agents must see the repository's own guidance, and open questions must stay visible until a person answers them.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s1-02-section-with-text-and-open-questions, PRD #45
Merged: @pierrederval, 2026-09-25, PR #46

## P-PRODUCT-9

The kit's setup never overwrites what a person wrote in the knowledge base, even when the person did not label it.

Why: A person's words are the knowledge base's source of truth; silently losing them on a refresh would destroy trust in the kit.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-03-terraform-treats-an-unmarked-section-as-a-persons, PRD #45
Merged: @pierrederval, 2026-09-25, PR #46

## P-PRODUCT-10

A refresh of the knowledge base never asks a person again the questions a previous run already put to them.

Why: Repeating questions that are already written down wastes people's attention and buries the ones that are actually new.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0045-knowledge-forms/outbox/settled.md, entry s5-05-terraform-marks-a-form-holding-only-questions-filled, PRD #45
Merged: @pierrederval, 2026-09-25, PR #46

## P-PRODUCT-11

Once a question has been answered, that answer is final, and the page never takes an answer that nobody will read.

Why: An answer Claude never receives would mislead the person who gave it. A changed answer would silently rewrite what the terminal already acted on.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s2-04-round-moves-forward, PRD #71
Merged: @pierrederval, 2026-09-26, PR #73

## P-PRODUCT-12

The page never invites an answer that nobody is waiting to read.

Why: An answer stored after the hook has given up is silently lost, and the person believes they answered.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-02-question-moves-on-time, PRD #71
Merged: @pierrederval, 2026-09-26, PR #73

## P-PRODUCT-13

Everything a person chose or typed in an answer reaches Claude, in a predictable order; nothing they gave is silently dropped.

Why: If an answer loses or reorders what the person gave, Claude acts on something they did not say.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s4-03-own-answer-with-several-choices, PRD #71
Merged: @pierrederval, 2026-09-26, PR #73

## P-PRODUCT-14

An unreachable or refusing server never leaves the kit half-switched: a failed change leaves things as they were, and a person can always turn a mode off locally.

Why: People must be able to stop sending questions from their computer whatever the remote side does, without being stuck in a broken state.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md, entry s5-02-switching-when-the-page-is-away, PRD #71
Merged: @pierrederval, 2026-09-26, PR #73

## P-PRODUCT-15

A retro never shows a line that blames a person, a role or a group.

Why: Retros exist to improve the loop. A line pointing at someone turns a lesson into blame and makes people less willing to take part.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s2-04-prose-caps-and-refused-words, PRD #72
Merged: @pierrederval, 2026-09-26, PR #75

## P-PRODUCT-16

A retro finding keeps one identity from run to run, so the same problem is never counted or reported as two.

Why: Finding ids and their retro issues are built from the name, so a changing name opens duplicate issues and leaves the old ones open.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s3-03-one-name-per-failing-test, PRD #72
Merged: @pierrederval, 2026-09-26, PR #75

## P-PRODUCT-17

The retro measures the work that was actually merged into the feature, never work that was thrown away unmerged.

Why: Findings drawn from merged work stay reproducible and comparable across retros, and the counts do not depend on abandoned branches.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s4-01-churn-counts-merged-work, PRD #72
Merged: @pierrederval, 2026-09-26, PR #75

## P-PRODUCT-18

The retro judges a slice's changes against what the plan declares in its table, never against a reading of the plan's prose.

Why: Notes often name a path in order to fence it off. Reading prose as a list would hide the very breaches the note meant to prevent.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s5-01-shared-ground-is-computed, PRD #72
Merged: @pierrederval, 2026-09-26, PR #75

## P-PRODUCT-19

What the model writes in a retro never carries a number or link it did not copy from the evidence it was given.

Why: Readers trust retro lessons as grounded; an invented figure or foreign link would pass as fact and mislead.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s6-03-what-the-guard-counts-as-copied, PRD #72
Merged: @pierrederval, 2026-09-26, PR #75

## P-PRODUCT-20

The after-merge report ties bugs and fixes to a request only through links the code host records, not guesses or hand-read history.

Why: A count built on recorded links can be checked and repeated, so a request is judged by the same evidence every time.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0072-retro/outbox/settled.md, entry s8-05-what-ties-a-bug-to-the-prd, PRD #72
Merged: @pierrederval, 2026-09-26, PR #75

## P-PRODUCT-21

The kit refuses a setting that would make it write a broken credit line, rather than letting the broken line go out.

Why: A malformed Co-authored-by line credits no one, and the phase-0 check would then look for that broken line.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s1-01-signature-name-address-shape, PRD #99
Merged: @pierrederval, 2026-09-26, PR #103

## P-PRODUCT-22

The credits report never prints from a search it could not finish, and anything it leaves out is named, never dropped silently.

Why: A report built on a half-read record would credit people wrongly while looking complete.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s3-02-credits-other-github-failures, PRD #99
Merged: @pierrederval, 2026-09-26, PR #103

## P-PRODUCT-23

The credits record keeps what the loop's own app opened apart from the work it credits, so the app never inflates or dates the signed counts.

Why: Counting the app's own items as signed or missed work would distort the record of how the loop was actually used.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-01-credits-app-items-counted-apart, PRD #99
Merged: @pierrederval, 2026-09-26, PR #103

## P-PRODUCT-24

A kit report never shows a count it did not look for as zero; what was not searched is left out rather than printed as nothing found.

Why: A zero claims a search found nothing. Printing one for a search that never ran would mislead the reader about the repository's activity.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0099-omni-man-credits/outbox/settled.md, entry s4-03-credits-lines-not-looked-for, PRD #99
Merged: @pierrederval, 2026-09-26, PR #103

## P-PRODUCT-25

A colour is accepted in one exact form everywhere in the app, so a colour one check accepts is never refused by another.

Why: The database and the client schema must agree, and browser colour pickers already give lowercase hex, so one form avoids silent mismatches.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-02-theme-colours-lowercase, PRD #100
Merged: @pierrederval, 2026-09-26, PR #101

## P-PRODUCT-26

Only people who belong to a workspace can act on players; being signed in alone grants nothing.

Why: Access follows workspace membership rather than one company's accounts, so outsiders never touch player data.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s1-03-link-github-needs-a-workspace, PRD #100
Merged: @pierrederval, 2026-09-26, PR #101

## P-PRODUCT-27

Who may use the game's features is decided by workspace membership, never by the domain of an email address.

Why: Workspaces are how people reach the game, so access follows them.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace, PRD #100
Merged: @pierrederval, 2026-09-26, PR #101

## P-PRODUCT-28

In the game, a person is never told they are an outsider because the database could not be read; an unknown membership never counts against them.

Why: An outage would otherwise tell real members their account is wrong, and RLS already keeps data closed to non-members.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0100-workspaces/outbox/settled.md, entry s5-02-out-of-reach-is-not-outsider, PRD #100
Merged: @pierrederval, 2026-09-26, PR #101

## P-PRODUCT-29

A page open to visitors without an account never shows a workspace's own data, such as its teams or fleets.

Why: Public pages can be seen by anyone, so showing a customer's teams there would expose them to people outside the workspace.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0141-design-system/outbox/settled.md, entry s6-01-design-page-shows-the-built-in-fleets, PRD #141
Merged: @pierrederval, 2026-09-26, PR #153

## P-PRODUCT-30

In the game, one part that cannot be read never hides the parts that were read; the unreadable part is named as out of reach, and no made-up data fills the gap.

Why: People should still see and play what loaded, and be told honestly which piece is missing rather than losing the whole page.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entries s2-01-xp-read-in-the-workspace-played and s5-04-scores-read-on-their-own, PRD #160
Merged: @pierrederval, 2026-09-27, PR #161

## P-PRODUCT-31

Turning the phone never changes the state of a game in progress; only the next game adapts to the new screen.

Why: A player who turns the phone mid-game should not lose or disrupt their game.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-03-a-game-keeps-its-field, PRD #160
Merged: @pierrederval, 2026-09-27, PR #161

## P-PRODUCT-32

In the arcade games, what a player sees reflects the game's actual rules, so a change to the rules never leaves the screen telling a different story.

Why: The person asked that the top row pay most; tying the layout to the values keeps that promise when the scoring changes.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s3-04-rows-follow-the-close-values, PRD #160
Merged: @pierrederval, 2026-09-27, PR #161

## P-PRODUCT-33

A person who leaves a workspace takes their game record with them; nothing of theirs stays on show to the crew.

Why: A departed person should not keep a public presence in a space they no longer belong to, and removing a member should never be blocked by leftover data.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s5-01-scores-leave-with-the-player, PRD #160
Merged: @pierrederval, 2026-09-27, PR #161

## P-PRODUCT-35

A player is always told about a game they unlocked, even when they climbed past its unlock level between two visits.

Why: Returning players and the demo guest skip levels, and a game that opened silently would never be announced.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0160-game-room/outbox/settled.md, entry s6-02-levels-climbed-between-visits, PRD #160
Merged: @pierrederval, 2026-09-27, PR #161

## P-PRODUCT-36

The app never shows a guessed cost; what it cannot price from its own list stays blank.

Why: A cost estimated from a similar model looks exact but may be wrong, so people would trust a number nobody checked.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s1-03-price-table-values, PRD #144
Merged: @pierrederval, 2026-09-27, PR #147

## P-PRODUCT-37

A person's choice always outranks the model's guess; the model only fills what nobody has decided.

Why: People must trust that what they sorted stays sorted, and the app holds no key that could write over them.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s3-02-model-guess-never-overrides, PRD #144
Merged: @pierrederval, 2026-09-27, PR #147

## P-PRODUCT-38

A person's name or email address is shown only to people who share a workspace with them, never to anyone outside it.

Why: Members need a recognisable label to share questions with each other, but outsiders must not learn who belongs to a workspace.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0144-question-history/outbox/settled.md, entry s4-01-teammates-named-by-email, PRD #144
Merged: @pierrederval, 2026-09-27, PR #147

## P-PRODUCT-39

Every way into the game's menu behaves the same, so a player never misses a celebration because of the route they took.

Why: A deep link that skipped the level-up would make the celebration depend on navigation, not on the player's progress.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-02-level-up-before-menu-link, PRD #238
Merged: @pierrederval, 2026-09-27, PR #239

## P-PRODUCT-40

A link into the game never lands a person somewhere the home address would not take them.

Why: So a person always reaches the screen meant for them, never a menu they cannot use.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s1-03-menu-link-without-galaxy, PRD #238
Merged: @pierrederval, 2026-09-27, PR #239

## P-PRODUCT-41

While the arcade asks a person a question, the game never moves on beneath it; declining leaves them on the screen they were on.

Why: A person who says no should find the same screen they left, not one that changed while they were deciding.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0238-game-app-switch/outbox/settled.md, entry s3-02-timed-screens-wait-under-confirm, PRD #238
Merged: @pierrederval, 2026-09-27, PR #239

## P-PRODUCT-42

A page-wide keyboard shortcut in the game never takes over a control that has the focus; the focused control keeps its own meaning.

Why: Keyboard and assistive-technology users must be able to rely on Enter activating what they focused, not something else.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0261-home/outbox/settled.md, entry s3-02-enter-on-focused-controls, PRD #261
Merged: @pierrederval, 2026-09-27, PR #263

## P-PRODUCT-43

An owner can only pick a fleet mascot from a fixed list of fleet characters the game already draws; arbitrary keys are never stored.

Why: Rejecting unknown keys at the database means the app never has to guess or fall back to a stand-in picture.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-01-mascot-choices, PRD #400
Merged: @pierrederval, 2026-09-28, PR #403

## P-PRODUCT-44

A fleet's key never changes once made and never names more than one fleet, retired fleets included.

Why: Anything that points at a fleet by its key must keep reaching that fleet and never be silently redirected to a newer one.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s1-03-fleet-key-from-label, PRD #400
Merged: @pierrederval, 2026-09-28, PR #403

## P-PRODUCT-45

In the game, a person can always reach the way forward from an empty state; hiding an empty view never hides the invitation to fill it.

Why: If both the fleet step and the menu entry vanished, owners and members would never learn how to set fleets up.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-01-fleets-menu-with-none, PRD #400
Merged: @pierrederval, 2026-09-28, PR #403

## P-PRODUCT-46

In the game, a player is never left on a screen with no way forward; when no choice exists, they play on as they are.

Why: A pick screen with nothing to pick is a dead end, and a fleet is optional, so blocking play there would lock a player out.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0400-own-fleets/outbox/settled.md, entry s2-02-disbanded-with-no-fleets, PRD #400
Merged: @pierrederval, 2026-09-28, PR #403

## P-PRODUCT-47

A count on the dashboard always agrees with the list it summarises, and each question counts once, however many ways it reaches a person.

Why: A tile that disagrees with the list beside it, or counts one question twice, misleads a person about how much is waiting.
Decided: @pierrederval, 2026-10-07
Source: .omni-loop/delivery/shipped/0657-snappy-pages/outbox/settled.md, entry s2-02-waiting-count-from-the-shared-list, PRD #657
Merged: @pierrederval, 2026-09-29, PR #664

## P-PRODUCT-48

The app never offers a link that leads only to a page with nothing to show.

Why: A click that ends on an empty 'not in this workspace' page wastes the person's time and reads as a broken link.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s1-01-chip-links-members-only, PRD #698
Merged: @pierrederval, 2026-09-29, PR #699

## P-PRODUCT-49

A count that is a link opens exactly the items it counted, never a wider or different set.

Why: A person who follows a number should see what that number described, so the count and the list never tell different stories.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s3-02-profile-stage-links, PRD #698
Merged: @pierrederval, 2026-09-29, PR #699

## P-PRODUCT-50

Narrowing a list to a person means the same thing whoever that person is, you included.

Why: A filter that changes meaning with the person chosen would make the same list tell different stories about the same work.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s4-01-prd-opener-rule, PRD #698
Merged: @pierrederval, 2026-09-29, PR #699

## P-PRODUCT-51

A person's profile shows the work that actually moved in the chosen period, not only the work begun in it.

Why: Long-running work that moves this week is part of the person's recent contribution, and it matches how the lists already sort by latest activity.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s5-01-profile-work-period-by-activity, PRD #698
Merged: @pierrederval, 2026-09-29, PR #699

## P-PRODUCT-52

A view about one workspace shows only that workspace's work; anything spanning more workspaces is reached deliberately.

Why: So a workspace's profile stays consistent with its board and never mixes in work from other workspaces unasked.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0698-person-profile/outbox/settled.md, entry s5-02-profile-work-one-workspace, PRD #698
Merged: @pierrederval, 2026-09-29, PR #699

## P-PRODUCT-53

In the arcade games, play never resumes on its own after a setback; the player always chooses when to go again.

Why: A player who just lost a life should never be thrown back into play before they are ready.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s2-01-ready-screen-after-a-life-lost, PRD #817
Merged: @pierrederval, 2026-09-30, PR #818

## P-PRODUCT-54

In the arcade games, a run never ends by a route that loses its score; every way a game can end saves the score reached.

Why: A player should never lose a score they earned because of the route they took out of a game.
Decided: @pierrederval, 2026-10-07
Source: .omni-loop/delivery/shipped/0817-super-omni-world/outbox/settled.md, entry s3-01-stage-clear-goes-on, PRD #817
Merged: @pierrederval, 2026-09-30, PR #818

## P-PRODUCT-55

Jev never appears switched on when it cannot run; its on state and every decision follow from whether a key is actually stored.

Why: A separate switch could show Jev or a decision as on with no key behind it, telling owners and members something that is not true.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s1-02-jev-on-means-key-stored, PRD #812
Merged: @pierrederval, 2026-09-30, PR #814

## P-PRODUCT-56

A call that produced no answer is never scored as agreement or disagreement; it is left out of the comparison, not counted against either side.

Why: Counting failures as disagreements would make the agreement rate measure outages rather than judgement, misleading anyone comparing Jev with the old way.
Decided: @pierrederval, 2026-10-07
Source: .omni-loop/delivery/shipped/0812-jev-decisions/outbox/settled.md, entry s4-01-agreement-counts-only-answered-calls, PRD #812
Merged: @pierrederval, 2026-09-30, PR #814

## P-PRODUCT-57

A repository's spec is always judged against one workspace's business, chosen the same way every time.

Why: Mixing or switching between workspaces' claims would make the check's verdict unpredictable and unfair to the repository's owners.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0839-canon-check/outbox/settled.md, entry s1-01-app-read-workspace-choice, PRD #839
Merged: @pierrederval, 2026-09-30, PR #840

## P-PRODUCT-58

An agent's link never reaches further than the member's own read would; it grants no access the person does not already have.

Why: So handing a link to an agent never widens what the workspace exposes, and the link and the member always see the same repositories.
Decided: @pierrederval, 2026-10-07
Source: .omni-loop/delivery/shipped/0855-agent-connect/outbox/settled.md, entry s1-01-token-repo-scope, PRD #855
Merged: @pierrederval, 2026-10-01, PR #856

## P-PRODUCT-59

Each product owns its own Statement and Never list, and another product's lines never shift or claim its numbers.

Why: People cite Never lines by number, so numbering must stay local to a product and stable once cited.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md, entry s1-02-statement-shape-and-never-numbers, PRD #871
Merged: @pierrederval, 2026-10-01, PR #874

## P-PRODUCT-60

A check turns red only on a finding it can show. A model's judgement may confirm or clear that finding, but never raises one on its own.

Why: Every red can then be checked by a person against quoted text, rather than taken on a model's word.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0871-product-constituents/outbox/settled.md, entry s5-02-jev-broken-without-quote-is-not-red, PRD #871
Merged: @pierrederval, 2026-10-01, PR #874

## P-PRODUCT-61

Work that installs a part of the code always comes after the work that changes that part and that it waits on, never alongside it; work that does not wait on the change may go at the same time.

Why: Work that builds on a part that is not yet finished would rest on ground that may still change, while holding back unrelated work gains nothing.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1089-repo-flow/outbox/settled.md, entry s3-01-plan-rules-order-and-reach, PRD #1089
Merged: @pierrederval, 2026-10-06, PR #1090

## P-PRODUCT-62

Who may change how a product is presented always follows who may edit that product's business, never a separate grant.

Why: One source of edit rights means presentation and business can never drift apart in who controls them.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/0859-pitch/outbox/settled.md, entry s1-02-every-member-edits-the-look, PRD #859
Merged: @pierrederval, 2026-10-06, PR #860

## P-PRODUCT-63

Care spends a fix attempt only on what it has confirmed; an unreadable dependency never triggers work on a guess.

Why: Fix attempts are limited, and acting on a guessed state wastes them or fixes the wrong thing, while a dependency confirmed dead no longer justifies waiting.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md, entry s1-01-waits-on-closed-or-unreadable, PRD #1118
Merged: @pierrederval, 2026-10-06, PR #1119

## P-PRODUCT-64

The care list shows a bug's fixes only from what the bug's plan and the code host actually record, never a guessed or not-yet-existing pull request.

Why: So a person looking after a bug sees real work only, and nothing missing or invented is presented as a fix.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1118-mega-care-bug-fix/outbox/settled.md, entry s1-02-care-list-reads-bug-fix-plan, PRD #1118
Merged: @pierrederval, 2026-10-06, PR #1119

## P-PRODUCT-65

Waiting on a person holds back only the PRD that waits, never the rest of the loop, and a loop that has ended is final.

Why: One open question should not stall unrelated work, and a fresh run with its own ledger keeps each loop's history clear.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s2-02-loop-park-and-stop, PRD #1139
Merged: @pierrederval, 2026-10-07, PR #1142

## P-PRODUCT-66

Every member page treats a signed-out visitor the same way: it asks them to sign in, and shows demo content only in the app's demo mode.

Why: A visitor should never get a different experience depending on which member page they reached first.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s5-02-loop-page-signed-out, PRD #1139
Merged: @pierrederval, 2026-10-07, PR #1142

## P-PRODUCT-67

Watching a repository's loops on the Omni page never depends on also sharing its PRD documents; each kind of sending stands on its own.

Why: A team can follow its loops without being made to send documents it chose to keep back.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1139-loop-drive/outbox/settled.md, entry s4-01-loop-push-off-switch, PRD #1139
Merged: @pierrederval, 2026-10-07, PR #1142

## P-PRODUCT-68

In the game, every personal credit counts the same way: it scores for the person and for their fleet, and it is withdrawn when the PRD it came from is lost.

Why: Fleet rankings should reflect every member's contribution consistently, and no kind of credit should survive the loss of the work that earned it.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s1-01-answers-pay-the-fleet-too, PRD #1180
Merged: @pierrederval, 2026-10-07, PR #1181

## P-PRODUCT-69

In the game, every question a crew member answers pays them, whatever work it belongs to, and only the people the dashboards list are paid.

Why: Answers on fixes, spikes and unnumbered drafts are real work too, and the score never pays people no longer part of the crew.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s1-03-which-answers-are-paid, PRD #1180
Merged: @pierrederval, 2026-10-07, PR #1181

## P-PRODUCT-70

In the game, a contributor is credited under the name the code host gives them; a valid name is never refused for how it is spelt.

Why: Refusing capitalised logins would silently stop crediting real members, such as the 12 in the organisation, with every new point.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s3-01-capital-login-skipped, PRD #1180
Merged: @pierrederval, 2026-10-07, PR #1181

## P-PRODUCT-71

In the game, a settle's credit is never lost or given to no one because of a malformed name; it waits until it can go to the right person.

Why: Closing a settle on no one would destroy earned credit for good, while waiting costs nothing and keeps the board honest.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1180-answers-earn-points/outbox/settled.md, entry s3-02-dotted-approver-waits, PRD #1180
Merged: @pierrederval, 2026-10-07, PR #1181

## P-PRODUCT-72

A roadmap belongs to its workspace, not to the person who first sent it, so every member can keep it current.

Why: Several people often drive one roadmap, and its page must stay current whoever pushed last.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s2-02-roadmap-any-member-pushes, PRD #1162
Merged: @pierrederval, 2026-10-07, PR #1163

## P-PRODUCT-73

A roadmap stays valid as its projects ship; shipping a project never makes the roadmap that planned it fail its check.

Why: Otherwise every roadmap would fail as soon as its first project merged, forcing an edit on each ship.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-02-shipped-prd-still-counts, PRD #1162
Merged: @pierrederval, 2026-10-07, PR #1163

## P-PRODUCT-74

A roadmap in a plan repository always says which repositories each project's work lands in, never leaving it to be assumed.

Why: With several repositories in play, a project with no named repository would be sent to a guessed place.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s4-03-repos-column-and-source, PRD #1162
Merged: @pierrederval, 2026-10-07, PR #1163

## P-PRODUCT-75

A roadmap shows each piece's standing only from what the code host records; when the host cannot be read, nothing is sent rather than a guessed state.

Why: People plan around the roadmap, so a guessed or stale state would mislead them about what is waiting and on what.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1162-roadmap/outbox/settled.md, entry s6-01-roadmap-push-reads-the-prs, PRD #1162
Merged: @pierrederval, 2026-10-07, PR #1163

## P-PRODUCT-76

The loop never launches an agent for a step with nothing to start, and never launches the same running step twice.

Why: Launching an agent only to wait spends tokens for nothing, and a second launch of a running step duplicates the work.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s1-01-steps-only-act, PRD #1205
Merged: @pierrederval, 2026-10-08, PR #1206

## P-PRODUCT-77

The loop never starts a second agent on a PRD someone is already working on; what is running is read from what GitHub actually shows.

Why: Two agents on one PRD would collide, and GitHub is the only shared record of who is working where.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s1-02-running-read, PRD #1205
Merged: @pierrederval, 2026-10-08, PR #1206

## P-PRODUCT-78

The loop never runs two steps on the same work at once, even before the code host shows the first one running.

Why: Two steps on one PRD or one path collide and waste work; GitHub lags behind what the session has just started.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1205-parallel-loop-steps/outbox/settled.md, entry s2-01-unseen-step-holds-pool, PRD #1205
Merged: @pierrederval, 2026-10-08, PR #1206

## P-PRODUCT-79

A session always shows the work it is actually on now, not merely the work it touched last.

Why: The branch is where the work is happening, so showing older recorded work would mislead the person about what the session is doing.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s2-01-branch-before-record, PRD #1208
Merged: @pierrederval, 2026-10-08, PR #1210

## P-PRODUCT-80

The status line keeps the links of any unfinished work current, and spends no refresh on work that is finished.

Why: A person reading the status line during review or a fix needs links that still lead where the work now is, not only where the board is kept.
Decided: @pierrederval, 2026-10-09
Source: .omni-loop/delivery/shipped/1208-session-hud/outbox/settled.md, entry s5-03-links-refresh-for-any-live-work, PRD #1208
Merged: @pierrederval, 2026-10-08, PR #1210

## P-PRODUCT-81

Only a confirmed entry of a repository's own knowledge is held to that repository's law requirements; an unconfirmed entry or another repository's copy is not.

Why: An entry nobody has confirmed is not a law yet, and a copied knowledge base answers to the choices of the repository it came from.
Source: .omni-loop/delivery/shipped/1342-laws-with-their-test/outbox/settled.md, entry s1-01-require-proof-skips-proposed-and-copies, PRD #1342
Decided: @pierrederval, 2026-10-10
Merged: @pierrederval, 2026-10-10, PR #1343
