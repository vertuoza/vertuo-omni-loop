<!-- omni-outbox-retro: prd=7 finding=repeated-red:e2e -->
**Retro of PRD 7** (#7 · feature PR #12 · retro PR #930) · F2

## What happened

The check e2e was red on 4 commits in 2 slices.

## Why it matters

Each red run held a slice back and hid whether the change itself was sound.

## Proposed lesson

Fix the flaky step before the next wave starts.

- Keep the end-to-end check green between waves.
- Answer decisions before the wave that builds on them.

## Why it is kept

No earlier lesson says to fix a flaky step between waves.

## Evidence

- [run 7001](https://github.com/acme/widgets/actions/runs/7001)
- [run 7002](https://github.com/acme/widgets/actions/runs/7002)

```yaml
prd: 7
finding: repeated-red:e2e
kind: repeated-red
retro: .omni-loop/delivery/shipped/0007-widget/retro.md
evidence: [https://github.com/acme/widgets/actions/runs/7001, https://github.com/acme/widgets/actions/runs/7002]
```
