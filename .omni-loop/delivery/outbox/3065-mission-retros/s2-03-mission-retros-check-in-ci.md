---
id: s2-03-mission-retros-check-in-ci
prd: 3065
slice: s2
rank: human-action
bears-on: none
raised: 2026-11-18
wave: 1
---

## The question, in plain words

The new database check for mission retros has to run in the automatic checks on every pull request, but the agent is not allowed to change the automatic checks' settings. Can a person add that one step?

## The decision, in plain words

The agent wrote the check and proved it passes on a local database, but its push was refused when it tried to add the check to the automatic checks. Until a person adds that step, nothing runs the new check on a pull request.

## The intro, for fun

The guard is hired, trained and in uniform.

## The punchline, for fun

Somebody just has to put it on the rota.

## What a person must do

On the branch feat/mission-retros (or feat/mission-retros--s2 before it merges), in .github/workflows/supabase.yml, right after the step "A mission's token budget, its fleet's daily cap and a budget stop's answer", add:

```yaml
      - name: A mission's stuck repairs, milestone retros and own outbox
        # A repair reads failure unless it says stuck; a stuck one may name no PRD and spends from the same 3 per cause and 9
        # per mission. One retro per milestone, never changed; an item names a target, a wording and cited evidence, and a
        # member answers it once as themselves, nobody else; paused by stuck only while paused; the five event kinds, the
        # two job keys, and a stuck repair claimed first (PRD 3065).
        run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/mission_retros.sql
```

Commit and push it with an account that may change workflows, then answer this item.

## What I had to decide

The slice's territory includes .github/workflows/supabase.yml, and conventions › A new database check runs in CI asks for a named step. The push of that change was refused: "refusing to allow a GitHub App to create or update workflow `.github/workflows/supabase.yml` without `workflows` permission". The step was dropped from the slice so the rest could be pushed.

Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

supabase/checks/mission_retros.sql is committed and passed on a local database (supabase db start, then psql -f), along with every other check the workflow names.

## What it costs to change later

None to add later: one step, no other file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the wave runner can be given the workflows permission, so a later slice can add such a step itself, is not known here.
