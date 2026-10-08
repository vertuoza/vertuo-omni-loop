---
roadmap: 1280
title: Validation e2e: de la bêta à la pratique
milestone: The e2e validation moves from a manual beta to a delivery practice: the skill works in a real repository, healed steps are safe to accept, it is wired into /omni:yolo, and it runs after each deploy on QA.
---

## PRDs

| id | PRD | title | blocked by | why | wave |
|---|---|---|---|---|---|
| P1 | #1273 | The e2e beta works in a real repository | – | – | 1 |
| P2 | #1274 | Healed e2e steps are safe to accept | – | – | 1 |
| P3 | #1275 | The e2e skill is followed by /omni:yolo when the spec asks | P1, P2 | a run on its own must work without a manual setup (P1) and never commit an unconfirmed healed recording (P2) | 2 |
| P4 | #1276 | First e2e use on a Vertuoza product | P1 | the e2e project must work in a real repository (P1) before real tests are put in it | 2 |
| P5 | #1277 | The e2e tests run after each deploy on QA | P4 | a proven suite and a QA target (P4) must exist before they are replayed automatically | 3 |
| P6 | #1278 | A mobile trial of the e2e tests | P4 | the same QA target and test account (P4) as the web use | 3 |
| P7 | #1279 | Hygiene of the e2e suite | P5 | unstable tests only show once the suite is replayed continuously (P5) | 4 |

## Open questions

| id | question | recommendation | blocks | kind |
|---|---|---|---|---|
| Q1 | What are the three user flows to cover first? | – | P4 | person |
| Q2 | Seeded QA tenant: a reset, or records with a name unique to each run? | Records with a name unique to each run (the idea's own answer). | P4 | default |
| Q3 | Which test account do automated runs sign in with, and how is it kept out of the code? | – | P4 | person |
| Q4 | Who on QA confirms or rejects a healed step when it lands in the outbox? | – | P3 | person |
| Q5 | Which existing e2e suites should this sit beside, and what would make QA trust it enough to keep it? | – | P3 | person |
| Q6 | Which stack is the mobile app built on (React Native, Flutter, native)? | – | P6 | person |
| Q7 | Where do the recordings of a product spanning several repositories live? | The plan repository (vertuo-automation-plan), which starts the environment they run against. | P4, P5 | default |
| Q8 | For the job after each deploy on QA: which runner (Node 24.8 or newer) and which access to the target? | – | P5 | person |
