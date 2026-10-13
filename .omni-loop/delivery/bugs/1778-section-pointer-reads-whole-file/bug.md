# Bug 1778: omni kb show releasing prints 145 KB: its pointer to apps/galaxy/README.md#deploy-to-production runs past its section to the end of the file

## Triage

- **Domain:** the kit's playbook: `omni kb show`, section pointers (`kit/lib/playbook/resolve.ts`)
- **Risk:** medium — every agent that reads a form with a section pointer (releasing and setup here) reads the whole target file instead of its section, about 33k extra tokens per read of releasing; nothing breaks, and the workaround is to replace the pointer with text (Jev, 0.84)
- **Regression:** new bug — no evidence this ever worked: `resolveSlot` has passed `null` instead of the anchor to `readTarget` since the forms shipped (PRD 45, c6f93fb2)

## Reproduction

- **File:** `kit/lib/playbook/section-pointer.test.ts`
- **Red:** × a See: <path>#<anchor> line: only the section that anchor names, its own subsections included

## Fix

A `See: <path>#<anchor>` line parsed its anchor but never used it: the resolver printed the whole target file. It now prints only the section whose heading GitHub links as that anchor, its subsections included, up to the next heading of its level or higher, ignoring headings inside code blocks; an anchor that names no heading is reported by `omni check kb` and prints nothing. `omni kb show releasing` goes from about 148 KB to 18.8 KB, and `setup` from 7.5 KB to 1.4 KB.

## Guard

The context budget: the ceilings of `form:releasing` and `form:setup` are lowered to their fixed sizes (19 KiB, 2 KiB), so a pointer that runs past its section again turns `omni check context` and the `omni / budgets` check red. On main's resolver, `omni check context` exits 1 (releasing 145.8 KB over 19 KB, setup 7.5 KB over 2 KB); on the fix, it exits 0.

## Mutation

mutation: no changed core file against origin/main (76ca3690): nothing to mutate
