---
prd: 1407
slice: s9
written: 2026-10-10
---

# Dogfood: design memory on omni-loop

PRD 1407's last slice turned design craft on in omni-loop itself, filled its `design` form from
evidence, drafted four screens of the library and ran the kit's design tools for real. The point
was to find the design concepts the generic kit is missing. This page records what each tool did,
what it got wrong, and the concepts a design lead would expect a design memory to hold that this
one does not. Each concept is an outbox item (`s9-01` to `s9-14`, all medium); `s9-15` is this
slice's own decision on `design.paths`. Nothing here was built: a person decides which become a
follow-up PRD.

## What was set up

| what | where | from |
| --- | --- | --- |
| `design.enabled: true`, `design.paths` over `apps/galaxy/src/`, `apps/galaxy/app/`, `apps/omni-app/src/`, `packages/design/` | `.omni-loop/config.yml` | the spec; `apps/galaxy/app/` added (item `s9-15`) |
| The `design` form: Product, System, Deliberate, Review filled, Language left to a person, 4 `TODO(human)` | `.omni-loop/knowledge/playbook/design.md` | 27 files, each `path@hash` |
| Draft screens `home` (`/`), `game-room` (`/play#games`), `prd-dossier` (`/prd/<id>`), `dashboard` (`/app`) | `.omni-loop/knowledge/design/screens/` | the routes and components of `apps/galaxy`, each with a Source list |

## The tools, run for real

| command | result | exit |
| --- | --- | --- |
| `omni design screens` | `dashboard draft — /app` · `game-room draft — /play#games` · `home draft — /` · `prd-dossier draft — /prd/<id>` | 0 |
| `omni check design` | first run refused `prd-dossier.md`: `front matter is not YAML — Missing , or : between flow sequence items` (an unquoted `apps/galaxy/app/prd/[id]/` in `implements`); after quoting: `4 screen(s), 0 locked; 0 locked law(s); compared with origin/main` | 1, then 0 |
| `omni check kb` | `15 form(s): 11 filled, 3 blank, 1 missing; 91 warning(s)`. The design form's own warnings are its four questions; the others are older forms' stale evidence and old spellings, none of this slice's | 0 |
| `omni kb show design` | Product, System, Deliberate, Review read `[repo]`; Language reads the kit's empty slot | 0 |
| `omni design touched origin/feat/design-memory` (this slice) | `ui: no`: the slice changes config and Markdown only | 0 |
| `omni design touched origin/main` (the whole feature) | `ui: yes`, matching only `apps/galaxy/src/docs/docs.test.ts` and `apps/galaxy/src/docs/guide.test.ts` | 0 |
| `omni design words` over every `before-after.html` of the inbox (6) and shipped (134) folders | 140 pages read, none refused; 1 marks a screen, 139 read whole; 2,662 findings | 0 |
| `omni check all` | red only on the known N-PRODUCT-1 and N-PRODUCT-6 entries of shipped PRDs 3 and 45 | 1 |

### `omni design touched` on past diffs

`touched` reads the branch's own diff, so past commits were replayed through the kit's own
`designTouched` and `screensTouched` (`kit/lib/design/touched.ts`) with this config and library,
from each commit's changed paths. Read-only; nothing was committed.

| commit | changed | ui | matched | of which tests | `screens:` line |
| --- | ---: | --- | ---: | ---: | --- |
| a5950cd4 fix(dossier): the approve moment on a phone (#1358) | 9 | yes | 7 | 1 | prd-dossier (draft) |
| 14d8e55b feat(home): the loop, your customers and the fleet game (#972) | 42 | yes | 32 | 12 | home (draft) |
| 633f933e feat(galaxy): person and fleet chips everywhere (#654) | 109 | yes | 101 | 41 | dashboard, prd-dossier |
| 1fe06612 feat(arcade): OMNI KART (#1362) | 50 | yes | 38 | 18 | game-room (draft) |
| 1b6cb8ce fix(omni-app): only a merge into the default branch starts a retro (#1412) | 4 | yes | 2 | 1 | none |
| 16f9a70e feat(knowledge): laws are born with their test (#1343) | 119 | yes | 29 | 12 | none |
| f9906c42 feat(domain): Omni Loop on its own domain (#984) | 38 | yes | 17 | 6 | home (draft) |
| 9a3ccd4f chore(lint): type-aware linting at zero (#977) | 949 | yes | 670 | 341 | all four |
| 1882f430 refactor(ts): import boundaries (#1067) | 284 | yes | 257 | 217 | all four |

The `screens:` line is right on every UI commit (the dossier fix names the PRD page, OMNI KART the
game room). The `ui:` answer is `yes` on all nine, including a server-only fix of the GitHub App and
two refactors that changed no pixel: a slice would run the design review on each.

## The word pass, per page

`design.words.avoid` is empty in the committed config, so `avoided-word` never fires there. The
last column is a second run with HOME's six avoided words (`apps/galaxy/src/home/lingo.ts`) set as
`design.words.avoid` for the run only, then taken back out, to see what a product-wide list would do.

| page | screens | words | sentence-on-control | two-primaries | explains-at-rest | avoided-word | avoided-word, HOME list tried |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| inbox/1262-people-count | whole page | 49 | 0 | 0 | 2 | 0 | 0 |
| inbox/1277-e2e-after-deploy-on-qa | whole page | 89 | 0 | 0 | 4 | 0 | 0 |
| inbox/1278-e2e-mobile-trial | whole page | 96 | 0 | 0 | 3 | 0 | 0 |
| inbox/1279-e2e-suite-hygiene | whole page | 81 | 0 | 0 | 3 | 0 | 0 |
| inbox/1359-omni-kart | whole page | 501 | 0 | 0 | 19 | 0 | 0 |
| inbox/1407-design-memory | 1 | 27 | 0 | 1 | 2 | 0 | 0 |
| shipped/0003-omni-loop-kit | whole page | 1131 | 0 | 0 | 47 | 0 | 10 |
| shipped/0007-omni-loop-skills | whole page | 241 | 0 | 0 | 12 | 0 | 5 |
| shipped/0028-omni-app-outbox-check | whole page | 303 | 0 | 0 | 13 | 0 | 5 |
| shipped/0039-omni-init | whole page | 483 | 0 | 0 | 17 | 0 | 3 |
| shipped/0045-knowledge-forms | whole page | 3254 | 0 | 0 | 119 | 0 | 8 |
| shipped/0050-question-intros | whole page | 822 | 0 | 0 | 33 | 0 | 1 |
| shipped/0068-omni-invade | whole page | 383 | 0 | 0 | 18 | 0 | 0 |
| shipped/0071-ask-mode | whole page | 474 | 3 | 0 | 15 | 0 | 0 |
| shipped/0072-retro | whole page | 777 | 0 | 0 | 38 | 0 | 1 |
| shipped/0082-knowledge-harvest | whole page | 873 | 0 | 0 | 30 | 0 | 2 |
| shipped/0094-game-boy-handheld | whole page | 1338 | 0 | 0 | 50 | 0 | 0 |
| shipped/0099-omni-man-credits | whole page | 752 | 0 | 0 | 28 | 0 | 3 |
| shipped/0100-workspaces | whole page | 838 | 0 | 0 | 28 | 0 | 0 |
| shipped/0141-design-system | whole page | 841 | 0 | 0 | 27 | 0 | 1 |
| shipped/0142-ask-tabs | whole page | 466 | 0 | 0 | 18 | 0 | 0 |
| shipped/0144-question-history | whole page | 548 | 0 | 0 | 21 | 0 | 0 |
| shipped/0149-knowledge-map | whole page | 1213 | 0 | 0 | 40 | 0 | 0 |
| shipped/0160-game-room | whole page | 1302 | 0 | 0 | 45 | 0 | 0 |
| shipped/0215-linked-signature | whole page | 524 | 0 | 0 | 22 | 0 | 0 |
| shipped/0216-prd-dossiers | whole page | 948 | 0 | 0 | 32 | 0 | 16 |
| shipped/0238-game-app-switch | whole page | 941 | 0 | 0 | 29 | 0 | 0 |
| shipped/0251-outbox-answers | whole page | 1291 | 0 | 0 | 54 | 0 | 15 |
| shipped/0261-home | whole page | 535 | 5 | 0 | 22 | 0 | 1 |
| shipped/0262-release-notes | whole page | 1143 | 0 | 0 | 41 | 0 | 6 |
| shipped/0284-omni-theme | whole page | 649 | 0 | 0 | 18 | 0 | 0 |
| shipped/0285-home-value | whole page | 1407 | 0 | 0 | 69 | 0 | 0 |
| shipped/0292-what-is-next | whole page | 520 | 0 | 0 | 14 | 0 | 16 |
| shipped/0301-yolo-what-is-next | whole page | 968 | 0 | 0 | 26 | 0 | 19 |
| shipped/0315-help-and-status | whole page | 1236 | 0 | 0 | 25 | 0 | 10 |
| shipped/0324-statusline | whole page | 804 | 0 | 0 | 29 | 0 | 3 |
| shipped/0328-personal-dashboard | whole page | 672 | 0 | 0 | 27 | 0 | 0 |
| shipped/0346-getting-started | whole page | 404 | 0 | 0 | 17 | 0 | 0 |
| shipped/0347-cli-releases | whole page | 458 | 0 | 0 | 15 | 0 | 3 |
| shipped/0359-github-sign-up | whole page | 451 | 0 | 0 | 18 | 0 | 1 |
| shipped/0373-guide-path-and-badges | whole page | 405 | 0 | 0 | 17 | 0 | 0 |
| shipped/0384-prd-page-usability | whole page | 505 | 0 | 0 | 27 | 0 | 2 |
| shipped/0394-home-hero-polish | whole page | 402 | 0 | 0 | 17 | 0 | 0 |
| shipped/0400-own-fleets | whole page | 360 | 0 | 0 | 17 | 0 | 0 |
| shipped/0413-prd-list-and-links | whole page | 402 | 0 | 0 | 12 | 0 | 8 |
| shipped/0420-easy-install | whole page | 432 | 0 | 0 | 12 | 0 | 2 |
| shipped/0426-prd-page-stage | whole page | 554 | 0 | 0 | 21 | 0 | 9 |
| shipped/0433-large-repo-file-list | whole page | 260 | 0 | 0 | 11 | 0 | 1 |
| shipped/0438-app-sidebar | whole page | 559 | 0 | 0 | 18 | 0 | 0 |
| shipped/0451-fullscreen-opt-in | whole page | 271 | 0 | 0 | 5 | 0 | 0 |
| shipped/0459-workspace-gate | whole page | 470 | 0 | 0 | 24 | 0 | 5 |
| shipped/0476-prd-page-header | whole page | 367 | 0 | 0 | 17 | 0 | 3 |
| shipped/0487-retro-worth-it | whole page | 560 | 0 | 0 | 20 | 0 | 3 |
| shipped/0498-lighter-app-pages | whole page | 568 | 0 | 0 | 22 | 0 | 0 |
| shipped/0499-waiting-notifications | whole page | 501 | 0 | 0 | 23 | 0 | 0 |
| shipped/0517-more-mascots | whole page | 553 | 0 | 0 | 23 | 0 | 0 |
| shipped/0522-mega-invade | whole page | 501 | 0 | 0 | 24 | 0 | 2 |
| shipped/0523-knowledge-repo-menu | whole page | 514 | 0 | 0 | 20 | 0 | 0 |
| shipped/0533-roomier-questions | whole page | 291 | 0 | 0 | 10 | 0 | 5 |
| shipped/0541-visual-fix | whole page | 490 | 0 | 0 | 20 | 0 | 5 |
| shipped/0549-mega-brainstorm | whole page | 499 | 0 | 0 | 19 | 0 | 16 |
| shipped/0556-bug-fix | whole page | 463 | 0 | 0 | 23 | 0 | 4 |
| shipped/0563-ultra-yolo | whole page | 398 | 0 | 0 | 16 | 0 | 8 |
| shipped/0572-dashboards | whole page | 533 | 0 | 0 | 17 | 0 | 0 |
| shipped/0579-new-documents-alert | whole page | 259 | 0 | 0 | 11 | 0 | 0 |
| shipped/0580-skills-docs | whole page | 491 | 0 | 0 | 16 | 0 | 18 |
| shipped/0587-real-stages | whole page | 425 | 0 | 0 | 10 | 0 | 4 |
| shipped/0598-pr-checks | whole page | 317 | 0 | 0 | 17 | 0 | 1 |
| shipped/0603-several-repositories-guide | whole page | 233 | 0 | 0 | 8 | 0 | 4 |
| shipped/0612-engineering-board | whole page | 392 | 0 | 0 | 12 | 0 | 0 |
| shipped/0620-screenshot-answers | whole page | 328 | 0 | 0 | 16 | 0 | 1 |
| shipped/0627-fixes-under-work | whole page | 423 | 0 | 0 | 13 | 0 | 2 |
| shipped/0645-engineering-repo-page | whole page | 292 | 0 | 0 | 7 | 0 | 0 |
| shipped/0652-person-fleet-chips | whole page | 440 | 0 | 0 | 12 | 0 | 1 |
| shipped/0657-snappy-pages | whole page | 474 | 0 | 0 | 12 | 0 | 4 |
| shipped/0675-inbox-check | whole page | 251 | 0 | 0 | 8 | 0 | 7 |
| shipped/0686-think-big | whole page | 1281 | 0 | 0 | 59 | 0 | 1 |
| shipped/0691-fast-fix-lists | whole page | 224 | 0 | 0 | 8 | 0 | 2 |
| shipped/0698-person-profile | whole page | 259 | 0 | 0 | 6 | 0 | 0 |
| shipped/0714-loop-health | whole page | 487 | 0 | 0 | 20 | 0 | 2 |
| shipped/0725-typescript | whole page | 412 | 0 | 0 | 23 | 0 | 0 |
| shipped/0728-points-every-repo | whole page | 291 | 0 | 0 | 11 | 0 | 0 |
| shipped/0733-menu-rework | whole page | 278 | 0 | 0 | 8 | 0 | 0 |
| shipped/0748-business-store | whole page | 1100 | 0 | 0 | 34 | 0 | 1 |
| shipped/0752-readable-questions | whole page | 400 | 0 | 0 | 14 | 0 | 1 |
| shipped/0757-play-while-working | whole page | 368 | 0 | 0 | 15 | 0 | 2 |
| shipped/0774-business-evidence-draft | whole page | 630 | 0 | 0 | 25 | 0 | 0 |
| shipped/0790-pr-care | whole page | 589 | 0 | 0 | 26 | 0 | 5 |
| shipped/0798-proof-video | whole page | 346 | 0 | 0 | 17 | 0 | 3 |
| shipped/0799-business-personas | whole page | 537 | 0 | 0 | 19 | 0 | 0 |
| shipped/0812-jev-decisions | whole page | 552 | 0 | 0 | 20 | 0 | 0 |
| shipped/0817-super-omni-world | whole page | 247 | 0 | 0 | 12 | 0 | 0 |
| shipped/0822-customer-voice | whole page | 550 | 0 | 0 | 18 | 0 | 2 |
| shipped/0839-canon-check | whole page | 495 | 0 | 0 | 15 | 0 | 5 |
| shipped/0855-agent-connect | whole page | 509 | 0 | 0 | 23 | 0 | 0 |
| shipped/0859-pitch | whole page | 447 | 0 | 0 | 17 | 0 | 0 |
| shipped/0871-product-constituents | whole page | 396 | 0 | 0 | 14 | 0 | 1 |
| shipped/0893-init-already-installed | whole page | 367 | 0 | 0 | 12 | 0 | 0 |
| shipped/0902-github-budget | whole page | 554 | 0 | 0 | 24 | 0 | 0 |
| shipped/0932-app-selector | whole page | 339 | 0 | 0 | 8 | 0 | 0 |
| shipped/0942-ts-cleanup | whole page | 295 | 0 | 0 | 15 | 0 | 0 |
| shipped/0962-grounded-dashboards | whole page | 394 | 0 | 0 | 8 | 0 | 0 |
| shipped/0971-home-loop-and-fleets | whole page | 444 | 0 | 0 | 18 | 0 | 0 |
| shipped/0976-ts-lint | whole page | 301 | 0 | 0 | 15 | 0 | 0 |
| shipped/0983-own-domain | whole page | 208 | 0 | 0 | 11 | 0 | 0 |
| shipped/1006-home-signed-in | whole page | 265 | 0 | 0 | 10 | 0 | 0 |
| shipped/1017-people-ranking | whole page | 632 | 0 | 0 | 13 | 0 | 0 |
| shipped/1023-ts-flags | whole page | 195 | 0 | 0 | 10 | 0 | 0 |
| shipped/1030-no-escape-hatches | whole page | 333 | 0 | 0 | 14 | 0 | 0 |
| shipped/1042-fast-feedback | whole page | 222 | 0 | 0 | 9 | 0 | 3 |
| shipped/1049-branded-ids | whole page | 214 | 0 | 0 | 10 | 0 | 0 |
| shipped/1059-parsed-env | whole page | 205 | 0 | 0 | 8 | 0 | 0 |
| shipped/1066-import-boundaries | whole page | 188 | 0 | 0 | 7 | 0 | 0 |
| shipped/1072-mutation-testing | whole page | 188 | 0 | 0 | 11 | 0 | 1 |
| shipped/1089-repo-flow | whole page | 467 | 0 | 0 | 20 | 0 | 4 |
| shipped/1108-pitch-studio | whole page | 312 | 0 | 0 | 8 | 0 | 0 |
| shipped/1118-mega-care-bug-fix | whole page | 472 | 0 | 0 | 16 | 0 | 2 |
| shipped/1130-mega-retro | whole page | 299 | 0 | 0 | 15 | 0 | 0 |
| shipped/1138-generated-files | whole page | 316 | 0 | 0 | 13 | 0 | 5 |
| shipped/1139-loop-drive | whole page | 527 | 0 | 0 | 20 | 0 | 3 |
| shipped/1162-roadmap | whole page | 613 | 0 | 0 | 22 | 0 | 5 |
| shipped/1171-enforced-by | whole page | 305 | 0 | 0 | 17 | 0 | 0 |
| shipped/1180-answers-earn-points | whole page | 328 | 0 | 0 | 15 | 0 | 0 |
| shipped/1205-parallel-loop-steps | whole page | 336 | 0 | 0 | 11 | 0 | 0 |
| shipped/1208-session-hud | whole page | 508 | 0 | 0 | 25 | 0 | 1 |
| shipped/1217-roadmap-human-work | whole page | 361 | 0 | 0 | 17 | 0 | 0 |
| shipped/1218-roadmap-prerequisites | whole page | 612 | 0 | 0 | 17 | 0 | 1 |
| shipped/1233-validate-e2e | whole page | 290 | 0 | 0 | 14 | 0 | 3 |
| shipped/1246-public-ideas-board | whole page | 430 | 0 | 0 | 17 | 0 | 0 |
| shipped/1258-members-vote-private-board | whole page | 172 | 0 | 0 | 8 | 0 | 0 |
| shipped/1272-concepts-page | whole page | 386 | 0 | 0 | 12 | 0 | 3 |
| shipped/1273-e2e-beta-real-repo | whole page | 210 | 0 | 0 | 4 | 0 | 1 |
| shipped/1274-e2e-healed-steps-safe | whole page | 144 | 0 | 0 | 3 | 0 | 2 |
| shipped/1275-yolo-follows-e2e | whole page | 111 | 0 | 0 | 4 | 0 | 3 |
| shipped/1276-e2e-first-product-use | whole page | 133 | 0 | 0 | 3 | 0 | 0 |
| shipped/1299-server-approval | whole page | 537 | 0 | 0 | 21 | 0 | 14 |
| shipped/1318-layered-data-access | whole page | 398 | 0 | 0 | 16 | 0 | 1 |
| shipped/1322-approval-handshake | whole page | 471 | 0 | 0 | 20 | 0 | 5 |
| shipped/1342-laws-with-their-test | whole page | 393 | 0 | 0 | 27 | 0 | 0 |
| shipped/1369-design-craft | whole page | 368 | 0 | 0 | 14 | 0 | 3 |
| **all 140 pages** | 1 marked, 139 whole | 70257 | 8 | 1 | 2653 | 0 | 329 |

### The most telling examples

- **The one marked mock, and the fault it was drawn to show, missed.** PRD 1407's own page marks its
  "today" mock with `data-screen`, two `data-primary` spans, and the label
  `Click here to send this quote to the customer now`. The pass caught `two-primaries`, but reported
  the ten-word label as `explains-at-rest`, not `sentence-on-control`: a `<span data-primary>` is a
  primary but not a control (`isControl` in `kit/lib/design/words/pass.ts` takes a button, a link,
  a control role or a submit input only). It also joined the heading and its caption into one
  string, `New quote Use this screen to create…`, and the two buttons into
  `Save Click here to send…`: strings split only at block tags, and this mock lays them out with
  CSS grid and flex.
- **A true finding, years late.** With HOME's list tried, the HOME before/after page (PRD 261) is
  flagged for `worktree` in "One agent per slice, in its own worktree, test-first…": a word HOME's
  copy rules now refuse. The pass would have caught it at the time.
- **A missed one beside it.** The same page's OCTOPOD card says "Eight arms, eight sub-PRs." and is
  not flagged: the avoided word is `sub-PR` and the match is exact, while HOME's own check
  (`says()` in `lingo.ts`) takes the plural, and HOME's test skips the fleet cards on purpose. The
  kit has neither the plural nor the exception.
- **Words glued together.** The HOME page's flip cards read as
  `BEAVERBuilds the dam. Secures the zone.BEAVERA secured zone scores 10.` and are flagged as
  sentences on a control: inside a control, children are joined with no space
  (`textOf`), so a card's front and back faces become one word salad.
- **A choice card is not a sentence on a button.** The Ask mode page (PRD 71) offers three options
  as cards, each a button holding a title, a Recommended tag and a one-line description; all three
  are flagged `sentence-on-control` (22, 18, 15 words). The rule counts the whole control, not its
  name: a title-and-description card, a common and good pattern, always fails.
- **The pass reads documents as screens.** 139 of 140 pages mark no screen, so each is read whole and
  every caption, heading and paragraph explaining the change is a sentence at rest: 2,653
  `explains-at-rest` findings, a median page of 432 words, PRD 45's of 3,254 with 119 findings.
  None of those is about a screen.
- **A product-wide list shouts in the wrong room.** HOME's six avoided words, tried as one list,
  raise 329 findings on 72 pages: `yolo` 131, `phase-0` 87, `dossier` 68, `sub-PR` 25, `territory`
  12, `worktree` 6. Nearly all are pages written for the people who run the loop, where these are
  the product's own words; the reading pages say `dossier` on purpose.

### What the tools got wrong

| tool | false positive | missed fault | fix it calls for |
| --- | --- | --- | --- |
| `design words` | 2,653 `explains-at-rest` on pages that are documents about screens | — | an unmarked page reports nothing, or its prose apart (`s9-06`) |
| `design words` | a heading and its caption, two side-by-side buttons, read as one string | — | split strings at every element, not only block tags (`s9-06`) |
| `design words` | a control's children glued with no space (`BEAVERBuilds`) | — | join a control's text nodes with a space (`s9-06`) |
| `design words` | a title-and-description choice card counted as a sentence on a button | — | count a control's name, not every word inside it (`s9-06`) |
| `design words` | — | a ten-word label on a `<span data-primary>` | an element marked primary is a control (`s9-06`) |
| `design words` | 329 `avoided-word` hits where the word belongs | `sub-PRs`, the plural | scoped lists, plurals, exceptions (`s9-02`) |
| `design touched` | `ui: yes` on a test-only change, a server-only fix and two refactors | — | exclusions in `design.paths` (`s9-13`) |
| `design touched` | — | no screen named for a change to the root layout or the app shell | frames in the library (`s9-08`) |
| `design touched` | — | a shared part (the fleet chip) names only the screens listing its file | a component inventory (`s9-04`) |
| `check design` / the reader | — | the refusal of an unquoted `[id]` path does not say to quote it | a hint in the refusal, one route notation (`s9-14`) |
| `check kb` | — | a `TODO(human)` wrapped over two lines is shown cut at the first line | read the question to its end (no item: small) |

`omni design screens`, `omni check design` once quoted, `omni kb show design` and the `screens:`
line of `touched` did what the spec says on every case tried.

## Filling the form: what the evidence did not decide

The four `TODO(human)` of the form, each a question for a person:

1. Is there a list of words the whole product avoids? HOME's six are HOME's own.
2. Under what light and on which screens are the app pages read?
3. Is zoom being off on the reading pages on purpose? The root layout turns it off for the Game Boy,
   and `/app` inherits it.
4. Are HOME's kicker, its ★ glyphs and its hard offset shadows the print ad's on purpose? All three
   are on the craft floor's refuse list.

The form held most of the repository's design well, because `@omni/design` and its README already
write the system down. What it could not hold is the subject of the items below: one product with
three looks, its copy rules scoped to one of them, its motion, its shared parts and its themes.

## What a mature design memory has, and this one lacks

Judged as a design lead would, against what a design memory that compounds holds, and against what
our own four screens needed while the form was filled. Each is a medium outbox item with the fix it
would make.

| item | concept | what our dogfood showed | the fix it would make |
| --- | --- | --- | --- |
| `s9-01` | **Areas, a colour and material system per surface** | HOME (print ad), the arcade (pixel art, named colours), the app pages (a reading surface, Ask's tokens in three themes) share one package and three looks; the form has one System | an optional areas list in the form, each with its product, system, deliberate and review; a screen names its area |
| `s9-02` | **Copy laws, scoped** | HOME bans six words the app pages use; the kit's list is product-wide, exact-match, no exceptions | avoided words per area or screens, plurals, skipped parts, and a "say instead" |
| `s9-03` | **Motion vocabulary** | blink, flyby, planet spin, level-up rays, each stilled under reduced motion in 20 files; nothing written | an optional motion slot: named moments, timing, the reduced-motion version |
| `s9-04` | **Component inventory** | the fleet chip, the person chip, the sign-in card, the notice: one change to a chip touched 101 paths | an inventory with paths, states and the screens using each; touched names them |
| `s9-05` | **Accessibility floor per product area** | Ask's colour pairs are AA-tested; the arcade's pixel text and the site-wide zoom lock are not stated anywhere | an accessibility slot per area: contrast, smallest text, zoom, motion, input paths |
| `s9-06` | **Mock conventions** | 139 of 140 before/after pages mark no screen; the pass's segmentation and primaries are wrong | unmarked pages read nothing, strings split per element, primaries are controls, a warning on a new page with no screen |
| `s9-07` | **Screens that are not pages** | the game room is a scene at `/play#games`; the PRD page is a dozen tabs | a screen says how it is reached and which screen it is part of |
| `s9-08` | **Frames and shells** | the root layout and the app shell frame every screen; no screen lists them | a frame in the library; touched names every screen in a changed frame |
| `s9-09` | **Themes as a review dimension** | the app pages ship Omni, Light and Dark, and are shot in each | the review shoots each theme; a mockup per theme |
| `s9-10` | **A way to see the library, a gallery of locked screens** | the library is text and a terminal list; no draft has a picture | a page rendering each screen with its picture, status and questions |
| `s9-11` | **The primary action of a screen** | three of four drafts open their questions on "which action leads?" | a Primary section in the screen format, checked against the mock and the built screen |
| `s9-12` | **A reference for a screen that already exists** | all four drafts have `mock: null`, so a lock today holds no picture | capture today's screen as its reference before it is locked |
| `s9-13` | **Paths that leave files out** | tests, fixtures and server files match `design.paths` | exclusions in `design.paths`, proposed by invade |
| `s9-14` | **One route notation** | `/prd/<id>`, `/quotes/:id`, `app/prd/[id]/`; `[id]` breaks the YAML list | one notation, and a refusal that says to quote |

Not raised, because the kit already holds them or the spec keeps them out: brand rules (logo forms,
whole-number scales, minimum sizes) sit well in Deliberate, pointed at `packages/design/README.md`;
breakpoints and grids sit in Review; demo data with every feature and motion skills are out of the
spec's scope.
