# Porting record

Every module under `kit/lib` that came from `vertuo-ai-domain` has one file here, named after it: its source, the
pinned sha (`c4a210122`), every literal replaced by the context, every test assertion changed and
every test deleted. A reviewer reads this beside the diff against upstream.

Each record names the files as they were when the module was ported, `.mjs` then. The kit's
modules and tests have since moved to `.ts` (ADR-0054): read `kit/lib/<name>.mjs` as
`kit/lib/<name>.ts`. The records stay as written, since they describe the port, not the tree.
