# Settled outbox items — PRD 1059

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-one-parse-stops-every-command -->

## s1-01-one-parse-stops-every-command — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-one-parse-stops-every-command
prd: 1059
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When one setting in the environment is half filled in or malformed, should every command of the loop's tool stop, or only the commands that use that setting?

## The decision, in plain words

Every command stops, with one message naming each setting that is wrong and never its value. The tool reads all its settings once when it starts, so a bad setting is found at once rather than deep inside a run.

## The intro, for fun

One typo in a setting, and the whole toolbox stays shut.

## The punchline, for fun

Loud and early beats quiet and wrong an hour later.

## The options, in plain words

A. A. One read at startup: any half-set or malformed group stops every command, naming its variables.
B. B. Each command reads only the groups it uses: a wrong setting it does not use is ignored.
C. C. As A, but the status line never stops: it draws as before and ignores the error.

## What I had to decide

Whether a wrong setting a command does not use (the game's database pair, the model's key) should stop that command too.

## What I did meanwhile

Every omni command, the status line included, and every game script and check:changed stop with exit 2 and one line naming the variables when any group of the kit's, the game's or the scripts' environment is half set or malformed.

## What it costs to change later

Answering B means a read per group in kit/lib/env/read.ts and each command asking for its own groups: a few hours, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a half-set group fails at startup but does not say whether a group the running command never reads counts.
- (author) The status line used to draw whatever the environment held; it now prints the error line instead when a setting is wrong.

```

<!-- /omni-outbox-settled: s1-01-one-parse-stops-every-command -->

<!-- omni-outbox-settled: s1-02-optional-setting-alone-is-half-set -->

## s1-02-optional-setting-alone-is-half-set — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-optional-setting-alone-is-half-set
prd: 1059
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

When only the optional part of a feature's settings is filled in, such as the model's name without the key that pays for it, should that count as a mistake or as the feature being off?

## The decision, in plain words

It counts as a mistake: the feature is half set up, and the tool says which setting is missing. Before, the feature quietly stayed off.

## The intro, for fun

A model's name without its key is a car with no ignition.

## The punchline, for fun

Better to hear it now than to wonder why nothing was sorted.

## The options, in plain words

A. A. An optional member set alone makes the group half set: one error names the missing variables.
B. B. A group is off until one of its required members is set: an optional member alone is ignored, as before.

## What I had to decide

Whether a group whose only set variables are optional ones (OPENROUTER_MODEL without OPENROUTER_API_KEY) is half set, or off.
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

envReader in kit/lib/env/group.ts reports it as half set, naming every variable of the group; the GitHub App and the arcade will inherit the rule in wave 2.

## What it costs to change later

Answering B is one condition in readGroup (count only required members when deciding whether a group is set) and its test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says a group is null when none of its variables is set; it does not say how an optional member alone is read.

```

<!-- /omni-outbox-settled: s1-02-optional-setting-alone-is-half-set -->

<!-- omni-outbox-settled: s2-01-production-is-vercel-production -->

## s2-01-production-is-vercel-production — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-production-is-vercel-production
prd: 1059
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The GitHub App must refuse to start in production when its webhook secret or its own identity is missing. How does it know it is running in production, and not on a preview of a pull request?

## The decision, in plain words

Only the live deployment counts as production. Previews of a pull request and local runs start without those secrets, as they do today, because the setup guide never says previews are given them.

## The intro, for fun

Every preview dresses like production; only one of them pays the rent.

## The punchline, for fun

So only the real one is asked for its keys at the door.

## The options, in plain words

A. A. Production is the hosting platform naming its live deployment: previews and local runs require none of the production secrets.
B. B. Production is the build mode saying production: every Vercel deployment, previews included, requires them.
C. C. As A, plus previews require them too, once the preview environment is confirmed to hold them.

## What I had to decide

Whether the app reads production from the hosting platform's own environment name (production only) or from the Node build mode, which is also set to production on every preview.

## What I did meanwhile

apps/omni-app/src/env.ts sets production to VERCEL_ENV === 'production'. A preview (VERCEL_ENV=preview), a development server and a test require neither GITHUB_WEBHOOK_SECRET nor GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY; the production deployment fails at start, naming them, when one is missing. A half-set or malformed group still fails everywhere.

## What it costs to change later

Answering B or C is one line in readEnv (the production flag) and its test: under an hour, no migration. B would make every preview deployment of the app fail at start unless its preview environment is given the three secrets.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says 'in the GitHub App in production' without saying which signal names production.
- (author) apps/omni-app/README.md lists the variables for the Vercel project and never says whether the preview environment holds them; whether previews of this project have them set today could not be checked from here.

```

<!-- /omni-outbox-settled: s2-01-production-is-vercel-production -->

<!-- omni-outbox-settled: s3-01-short-master-key-stays-off -->

## s3-01-short-master-key-stays-off — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-short-master-key-stays-off
prd: 1059
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the key that locks each workspace's Jev key is set but has the wrong length, should the arcade refuse to start, or keep running with Jev switched off?

## The decision, in plain words

The arcade keeps running and Jev is off, as before: the settings page says Jev is not available here. Only a setting filled in halfway or one that is not even readable stops the start.

## The intro, for fun

A key one tooth short still fits in the pocket.

## The punchline, for fun

It just will not open anything, and the settings page says so.

## The options, in plain words

A. A key of the wrong length keeps Jev off, as today; only a half-set group or an unreadable value stops the start.
B. A key that is not 32 bytes of base64 is a malformed value: the arcade refuses to start, naming the master key setting.

## What I had to decide

Whether a SECRETS_MASTER_KEY that is set but is not 32 bytes of base64 is a malformed value the startup parse refuses, or stays what the feature reads as off.

## What I did meanwhile

apps/galaxy/src/env.ts reads SECRETS_MASTER_KEY as a plain set-or-unset secret; masterKey in src/jev/secret-box.ts still turns a value of the wrong length or alphabet into null, so Settings › Jev says Jev is not available, as .env.example documents.

## What it costs to change later

Answering B is a refine on the group's schema in src/env.ts (32 bytes once decoded from base64) and two test lines: under an hour, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a malformed value fails at startup, and also that a feature's behaviour when its configuration is set stays as it is; a key of the wrong length sits between the two.
- (author) .env.example and Settings › Jev both document the wrong-length key as Jev not being available.

```

<!-- /omni-outbox-settled: s3-01-short-master-key-stays-off -->

<!-- omni-outbox-settled: s3-02-service-address-belongs-to-the-service-key -->

## s3-02-service-address-belongs-to-the-service-key — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s3
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-service-address-belongs-to-the-service-key
prd: 1059
slice: s3
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The arcade's own database address for its back-office access is only useful with the back-office key. If someone sets the address without the key, should the arcade refuse to start, or ignore the address?

## The decision, in plain words

The address and the key are one group: the address alone is a half-filled setting, and the arcade refuses to start, naming the missing key. With neither, the back-office access is off, as before.

## The intro, for fun

An address with no key to the door is a postcard, not a visit.

## The punchline, for fun

Better to be told at the gate than to knock all night.

## The options, in plain words

A. The address alone is half set: the arcade refuses to start and names the missing key.
B. The address is optional on its own: set without the key, it is ignored and nothing stops.

## What I had to decide

Whether SUPABASE_URL belongs to the service role's group (set alone, it is half set) or stands as an optional value of its own.

## What I did meanwhile

apps/galaxy/src/env.ts groups SUPABASE_SERVICE_ROLE_KEY with an optional SUPABASE_URL: the key alone is fine (the season cache falls back on the public address), the address alone is refused at startup. pnpm releases:sync still needs both.

## What it costs to change later

Answering B moves SUPABASE_URL into a group of its own in src/env.ts and changes one test: under an hour.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the Supabase pair as a half-set example but does not say whether the service role's own address counts as part of it.
- (author) Whether any deployment sets SUPABASE_URL without the service key today is not known from the repository: the settings are checked before merging, as the spec's risks ask.

```

<!-- /omni-outbox-settled: s3-02-service-address-belongs-to-the-service-key -->

<!-- omni-outbox-settled: s4-01-readme-variable-list-is-a-marked-section -->

## s4-01-readme-variable-list-is-a-marked-section — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-03
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-03
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-readme-variable-list-is-a-marked-section
prd: 1059
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

The check that keeps the setup guides honest must know which part of each guide is its list of settings. How does it find that list?

## The decision, in plain words

Each guide carries one list of settings between two invisible markers, and the check reads only the setting names inside it. A setting named anywhere else in the guide is ordinary prose and is not checked.

## The intro, for fun

A guide that mentions a setting on every page is not the same as a guide that lists it.

## The punchline, for fun

So each guide now has one list, fenced in, and the check reads only that.

## The options, in plain words

A. A. One marked section per README, read between two hidden markers; names elsewhere are prose.
B. B. A heading named Environment variables in each README, and every name under it up to the next heading.
C. C. Every backticked setting name anywhere in the README, compared with what the code reads.

## What I had to decide

How a README's variable list is recognised by the docs check: a marked section, a heading, or every backticked name in the file.

## What I did meanwhile

The docs check (kit/lib/env/docs.ts, run by scripts/env-docs.test.ts and each app's src/env-docs.test.ts) reads the backticked names between <!-- omni:env-variables --> and <!-- /omni:env-variables --> (exactly one section per README, else it fails) and compares them both ways with the runtime's VARIABLES: README.md with the kit's, game/README.md with the game's groups (workspace and Supabase), apps/omni-app/README.md with its groups plus SDK_VARIABLES (INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, and INNGEST_DEV, now listed as local only), apps/galaxy/README.md with the arcade's. apps/galaxy/.env.example is read as every NAME= line. Platform values (PLATFORM_VARIABLES) are listed nowhere. README.md and game/README.md gained a short list; omni-app's setup list gained OPENROUTER_MODEL, STAGE_EVENT_SECRET, GALAXY_URL and INNGEST_DEV; galaxy's Vercel step gained the full list.

## What it costs to change later

Answering B or C is a change to readmeNames in kit/lib/env/docs.ts and the markers in four READMEs: under an hour, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every README variable list must match the schemas but does not say how a list is told apart from prose that names a variable.
- (author) The root README listed no kit variable before; whether it is the right home for the kit's list, rather than a kit page, is not settled anywhere.

```

<!-- /omni-outbox-settled: s4-01-readme-variable-list-is-a-marked-section -->
