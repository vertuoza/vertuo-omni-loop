---
id: s25-01-arcade-casts-and-reads-left-as-they-were
prd: 725
slice: s25
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

In this part of the web app, should every shortcut the code takes with its types carry a written reason, and should every value it reads from outside be checked against a rule, as the rest of the repository now does?

## The decision, in plain words

Not in this step: the web app was changed only where the stricter list checks and the typed database needed it, as the design says. The shortcuts and the outside reads stay as they were, for the final tightening step to settle.

## The intro, for fun

Three hundred type shortcuts sat in a row, each waiting to explain itself.

## The punchline, for fun

They were told the explaining starts in the last chapter.

## The options, in plain words

A. A: leave the arcade's existing casts and outside reads as they were; the ratchet slice decides whether its guard covers the web app
B. B: mark every existing cast in these folders with a written reason now, a comments-only change
C. C: mark every cast and add schemas at every outside read in these folders now

## What I had to decide

Whether the arcade slices must mark every source `as`/`any` with `// ts-allow: <reason>` and parse every outside read through a Zod schema, when the spec's Out list says the arcade's code changes only for its index checks and the Database type.

## What I did meanwhile

apps/galaxy/src/{ask,dashboard,profile,signup,proxy,working} and apps/galaxy/proxy.ts pass `tsc -p apps/galaxy --noUncheckedIndexedAccess` and `--erasableSyntaxOnly` with no error; the Supabase clients the territory opens are created with `<Database>`. About 300 existing source casts are left unmarked, and outside reads (env, JSON bodies, OpenRouter, GitHub) keep their existing hand checks with no new Zod schema. The few new casts this slice wrote (a YYYY-MM-DD split read as three numbers) carry `// ts-allow:`.

## What it costs to change later

Comments only for the casts (one `// ts-allow: <reason>` per line, about 300 lines across the six folders), or a scope line in the s29 guard that leaves apps/galaxy out; Zod schemas at the arcade's outside reads would be a separate behaviour-neutral pass per folder.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the s29 guard is meant to scan apps/galaxy is not written: the plan's done-when asks every typing slice to mark casts, while the spec's Out list keeps the arcade's code unchanged beyond index checks and Database
- (author) The sibling arcade slices (s24, s26 to s28) may have answered this differently in the same wave
