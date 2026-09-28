// The `.omni-loop/config.yml` that `omni init` writes: minimal and commented. Only `kit`, `repo`,
// `labels.autoCreate`, `commands`, `laws`, `ask`, `dossier` and `signature` are written; every other
// key keeps its schema default. `signature` is written with its default values, so who signs the
// loop's work is visible and editable in the repository rather than hidden in the kit. `ask.url` is
// written as the Omni Loop home page (`signature.home`'s default, ADR-0047) and `dossier.enabled` as
// true (PRD 420): init writes them, the schema's own defaults stay null and false, so a config
// written before reads as it did.
// The text is returned only once the kit's own parser accepts it.
import { stringify } from 'yaml';
import { CONFIG_FILE, CONFIG_VERSION, ConfigSchema, parseConfig } from '../config.mjs';

const section = (key, value) => stringify({ [key]: value }).trimEnd();

/**
 * @param {{ slug: string|null, defaultBranch: string|null, commands: { test, preflight, preflightFull }, lawsSource: string }} values
 * @returns {{ text: string, config: object }} the file's text and the config it parses to
 */
export function renderConfig({ slug, defaultBranch, commands, lawsSource }) {
  const repo = { slug };
  if (defaultBranch) repo.defaultBranch = defaultBranch;
  const { signature } = ConfigSchema.parse({ kit: CONFIG_VERSION });
  const text = [
    `# Omni Loop config, written by \`omni init\`. A key not written here keeps its schema default.`,
    `kit: ${CONFIG_VERSION}`,
    '',
    '# The repository the loop opens pull requests on.',
    section('repo', repo),
    '',
    '# Whether a skill may create a missing loop label while it runs (omni init creates them regardless).',
    section('labels', { autoCreate: false }),
    '',
    '# What the loop runs. null: not known yet; fill it in before the loop needs it.',
    section('commands', { test: commands.test, preflight: commands.preflight, preflightFull: commands.preflightFull }),
    '',
    '# Where the laws a slice must not break are read from: knowledge, claudeMdInvariants or none.',
    section('laws', { source: lawsSource }),
    '',
    "# The Omni page ask mode's questions and the dossiers go to. null: ask mode and dossiers off.",
    section('ask', { url: signature.home }),
    '',
    "# Whether omni dossier sends this repository's PRD folders to ask.url.",
    section('dossier', { enabled: true }),
    '',
    "# Who co-signs the loop's commits, pull requests and issues. null: nobody.",
    section('signature', signature),
    '',
  ].join('\n');
  return { text, config: parseConfig(text, CONFIG_FILE) };
}
