# Settled outbox items — PRD 7

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-colour-format -->

## s1-01-colour-format — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-20
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-colour-format
prd: 7
slice: s1
rank: medium
---
```

<!-- /omni-outbox-settled: s1-01-colour-format -->

<!-- omni-outbox-settled: s2-01-read-cache -->

## s2-01-read-cache — agreed

- Verdict: agreed
- Approved by: ada
- Approved at: 2026-09-20
- Channel: feature pull request #12
- Basis: stated — the answer says it agrees
- Closed: yes — agreed; nothing to rework
- Rank: high
- Bears on: none
- Raised: 2026-09-20
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
A. Keep it.
```

### The item, as it was raised

```text
---
id: s2-01-read-cache
prd: 7
slice: s2
rank: high
---
```

<!-- /omni-outbox-settled: s2-01-read-cache -->

<!-- omni-outbox-settled: s2-02-read-order -->

## s2-02-read-order — drifted

- Verdict: drifted
- Approved by: ada
- Approved at: 2026-09-20
- Channel: feature pull request #12
- Basis: stated — the answer picks another option
- Closed: yes — reworked by #88, the sub-pull request that brought the build back in line
- Rank: high
- Bears on: none
- Raised: 2026-09-20
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
B. Read the newest first.
```

### The item, as it was raised

```text
---
id: s2-02-read-order
prd: 7
slice: s2
rank: high
---
```

<!-- /omni-outbox-settled: s2-02-read-order -->

<!-- omni-outbox-settled: s3-01-show-default -->

## s3-01-show-default — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-20
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-show-default
prd: 7
slice: s3
rank: medium
---
```

<!-- /omni-outbox-settled: s3-01-show-default -->

<!-- omni-outbox-settled: s3-01-show-default -->

## s3-01-show-default — drifted

- Verdict: drifted
- Approved by: grace
- Approved at: 2026-09-21
- Channel: feature pull request #12
- Basis: stated — an objection to an adopted item
- Closed: no — a rework must bring the build back in line
- Rank: medium
- Bears on: none
- Raised: 2026-09-20
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
No: show the colour the widget had last.
```

### The item, as it was raised

```text
---
id: s3-01-show-default
prd: 7
slice: s3
rank: medium
---
```

<!-- /omni-outbox-settled: s3-01-show-default -->
