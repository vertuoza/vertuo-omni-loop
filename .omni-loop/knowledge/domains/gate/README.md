# Gate

Glossary term: Outbox gate

The gate a pull request passes before a person merges it: the outbox check, the questions it holds open, the base branch it reads its rules from, and the merge only a person makes.

Its files are the `gate` area of `.omni-loop/config.yml` (`flow.areas.gate`, `knowledge: gate`): `omni kb laws --paths` lists this folder's entries under **Applies here** for any file there (PRD 2346). An entry moved here from `product/` keeps its id, marked by its `Kept id:` line.
