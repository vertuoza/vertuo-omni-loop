# Widgets — plan

**PRD:** #7 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/widget` → `main`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | The colour is stored | `src/store/` `src/registry.mjs` | — | 1 |
| s2 | The colour is read back | `src/read/` `src/registry.mjs` | s1 | 2 |
| s3 | The colour is shown | `src/show/` | s1 | 2 |

**Shared ground.** `src/registry.mjs` is declared by s1 and s2, which each add one line to it; their
waves keep them apart. `src/show/` is s3's alone.
