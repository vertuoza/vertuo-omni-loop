---
form: testing
form-version: 1
state: blank
points-to: null
evidence: []
terraformed: null
---

<!-- Ported from vertuo-ai-domain@db67fd9da:docs/agents/testing.md — changes in kit/porting/templates--testing.md -->

# Testing

Use this page when adding, changing, or choosing tests.

## Commands
<!-- slot: commands · required -->
`{config:commands.test}` runs the whole suite. While iterating, run the narrowest test that covers
the change; run the whole suite before handing off.

## Where tests live
<!-- slot: layout · required -->
Name one existing test per kind that shows the house style: a new test starts from it rather than
from a blank file.

## Choosing the level
<!-- slot: levels · optional -->
- Start from the behaviour, invariant, or integration risk the change creates.
- Prefer red-green-refactor when the expected behaviour is clear.
- Add characterization tests before a risky refactor, so existing behaviour is pinned before the
  code is reshaped.
- Choose the narrowest test that proves the risk. Broaden only when the risk is in the integration
  between layers.

| Change | Useful test shape |
|---|---|
| A schema, config, normalizer, or parser | A unit test with valid and invalid inputs |
| A domain invariant or business rule | A test of the service or capability where the rule lives |
| Storage or migration behaviour | A persistence test with realistic rows |
| An API boundary | A test for validation, response shape, and failures |
| Behaviour across layers, at the edge | An acceptance scenario |
| A UI workflow | A component or page test for its states and actions; a manual browser path for visual risk |

Cover invalid inputs at a boundary, not only the happy path; error behaviour and the failure states
a user sees, when they are part of the workflow; the invariants that must survive a refactor;
contract compatibility when a shared schema changes; and the existing workflows the change could
plausibly affect.

## Never
<!-- slot: never · required -->
- A test never proves implementation trivia: it proves behaviour or risk.
- Coverage measures execution, not correctness. Never write an assertion-free test to colour lines,
  and never lower a coverage floor or exclude logic to reach a number.
- A test never waits on wall-clock time it cannot name. Poll for the condition, or make the delay a
  parameter the test sets; raising a timeout is not a fix.
- A log assertion reads the emitted structured records, never a logger spy, and never expects
  sensitive content (prompts, tokens, keys, cookies, passwords) to appear in a log.

## Test data
<!-- slot: data · optional -->
- Keep test data small, domain-named, and explicit.
- A test that creates shared state (a database, a schema, a folder) tears it down after itself.
- What a run writes to a shared environment, it keeps: every record a test creates there gets a
  name of its own.
