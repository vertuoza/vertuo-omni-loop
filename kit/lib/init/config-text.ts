// The `.omni-loop/config.yml` that `omni init` writes: minimal and commented. Only `kit`, `repo`,
// `agents` (when given, PRD 1890), `labels.autoCreate`, `commands`, `laws`, `ask`, `dossier`, `answers` and `signature` are written; every other
// key keeps its schema default. `signature` is written with its default values, so who signs the
// loop's work is visible and editable in the repository rather than hidden in the kit. `ask.url` is
// written as the Omni Loop home page (`signature.home`'s default, ADR-0047) and `dossier.enabled` as
// true (PRD 420): init writes them, the schema's own defaults stay null and false, so a config
// written before reads as it did. `answers.enabled` is written as true, its schema default (PRD 251).
// The `sync` block (PRD 1990) is written commented, with its defaults, so the weights `omni sync`
// uses are visible where a person would change them.
// The text is returned only once the kit's own parser accepts it.
import { stringify } from 'yaml';
import { AGENTS, CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig, SYNC_CHECKS } from '../config.ts';
import type { Agent, Config } from '../types.ts';

/** The commands `omni init` writes, each `null` when not known yet. */
export type InitCommands = { setup: string | null; test: string | null; preflight: string | null; preflightFull: string | null };

/** What `renderConfig` fills in: everything else keeps its schema default. */
export type ConfigValues = {
  slug: string | null;
  defaultBranch: string | null;
  commands: InitCommands;
  lawsSource: Config['laws']['source'];
  /** The agents the repository uses (PRD 1890): written when given; left out, the key keeps its default. */
  agents?: readonly Agent[];
};

const section = (key: string, value: unknown): string => stringify({ [key]: value }).trimEnd();

/** The `sync` block, commented, holding the schema's defaults. */
function syncBlock({ order, levels, mainRedAfter }: Config['sync']): string[] {
  return [
    '# How omni sync weighs its checks: the order decides the headline, a level caps the colour a check',
    '# may show. These are the defaults; uncomment the block to change them.',
    '# sync:',
    `#   order: [${order.join(', ')}]   # the weight order, heaviest first`,
    '#   levels:                               # the highest colour each check may show: red | orange | off',
    ...SYNC_CHECKS.map((check) => `#     ${check}: ${levels[check]}`),
    `#   mainRedAfter: ${mainRedAfter}                     # how old a missing commit of the default branch may be before main is red`,
  ];
}

/** The file's text, and the config it parses to. */
export function renderConfig({ slug, defaultBranch, commands, lawsSource, agents }: ConfigValues): { text: string; config: Config } {
  const repo: { slug: string | null; defaultBranch?: string } = { slug };
  if (defaultBranch) repo.defaultBranch = defaultBranch;
  // The schema's default signature, never null: only a config that writes `signature: null` has none.
  const { signature, sync } = ConfigSchema.parse({ kit: CONFIG_VERSION });
  const text = [
    `# Omni Loop config, written by \`omni init\`. A key not written here keeps its schema default.`,
    `kit: ${CONFIG_VERSION}`,
    '',
    '# The repository the loop opens pull requests on.',
    section('repo', repo),
    '',
    ...(agents === undefined
      ? []
      : [`# The coding agents the skills are installed for: any of ${AGENTS.join(', ')}.`,section('agents', [...agents]), '']),
    '# Whether a skill may create a missing loop label while it runs (omni init creates them regardless).',
    section('labels', { autoCreate: false }),
    '',
    '# What the loop runs. null: not known yet; fill it in before the loop needs it. setup prepares a',
    '# fresh checkout for the preflight, proposed from the lockfile; null: none needed.',
    section('commands', { setup: commands.setup, test: commands.test, preflight: commands.preflight, preflightFull: commands.preflightFull }),
    '',
    '# Where the laws a slice must not break are read from: knowledge, claudeMdInvariants (the ADRs',
    '# the context files list under the invariants heading) or none.',
    section('laws', { source: lawsSource }),
    '',
    "# The Omni page ask mode's questions and the dossiers go to. null: ask mode and dossiers off.",
    section('ask', { url: signature?.home ?? null }),
    '',
    "# Whether omni dossier sends this repository's PRD folders to ask.url.",
    section('dossier', { enabled: true }),
    '',
    '# Whether the outbox may be answered outside the pull request, at the end of /omni:yolo. false: only on the pull request.',
    section('answers', { enabled: true }),
    '',
    "# Who co-signs the loop's commits, pull requests and issues. null: nobody.",
    section('signature', signature),
    '',
    ...syncBlock(sync),
    '',
  ].join('\n');
  return { text, config: parseConfig(text, CONFIG_FILE) };
}
