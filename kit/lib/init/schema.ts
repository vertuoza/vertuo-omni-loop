// What `omni init` reads from outside the kit, as schemas: the repository's package.json and
// composer.json, its `.claude/settings.json`, and what `gh` and `claude` print as JSON. Init never
// throws on what it reads, so a value these refuse is read as missing — the same as one that is
// not there — and every caller falls back exactly as it does for an absent file or a failed command.
import { z } from 'zod';
import { PrNumberSchema } from '../ids.ts';

/** A JSON object: anything else (an array, `null`, a string) is not one. */
export const JsonObjectSchema = z.record(z.string(), z.unknown());

/** A package.json or composer.json, the one key `detectCommands` reads: its scripts by name. */
export const ScriptsFileSchema = z.looseObject({ scripts: JsonObjectSchema.optional() });

/** The kit checkout's own package.json, the one key `runningKit` reads: a non-empty `version`, else null. */
export const KitPackageSchema = z.looseObject({
  version: z.unknown().optional().transform((value) => (typeof value === 'string' && value ? value : null)),
});

/** `gh repo view --json nameWithOwner,defaultBranchRef`. */
export const GhRepoSchema = z.looseObject({
  nameWithOwner: z.string().nullish(),
  defaultBranchRef: z.looseObject({ name: z.string().nullish() }).nullish(),
});

/** `gh label list --json name`. */
export const GhLabelsSchema = z.array(z.looseObject({ name: z.string() }));

/** `gh pr list --json url,number`. */
export const GhPullRequestsSchema = z.array(
  z.looseObject({ url: z.string().nullish(), number: PrNumberSchema.nullish() }),
);

/** `claude plugin list --json`: an element that is no plugin object reads as `null`, matching nothing. */
export const ClaudePluginsSchema = z.array(z.looseObject({ id: z.unknown() }).nullable().catch(null));

/** `claude plugin marketplace list --json`: likewise, by `name`. */
export const ClaudeMarketplacesSchema = z.array(z.looseObject({ name: z.unknown() }).nullable().catch(null));

/** A `statusLine` value whose `command` is text: the only shape the kit's own line can have. */
export const CommandStatusLineSchema = z.looseObject({ command: z.string() });
