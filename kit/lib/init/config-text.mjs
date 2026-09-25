// The `.omni-loop/config.yml` that `omni init` writes: minimal and commented. Only `kit`, `repo`,
// `labels.autoCreate`, `commands` and `laws` are written; every other key keeps its schema default.
// The text is returned only once the kit's own parser accepts it.
import { stringify } from 'yaml';
import { CONFIG_FILE, CONFIG_VERSION, parseConfig } from '../config.mjs';

const section = (key, value) => stringify({ [key]: value }).trimEnd();

/**
 * @param {{ slug: string|null, defaultBranch: string|null, commands: { test, preflight, preflightFull }, lawsSource: string }} values
 * @returns {{ text: string, config: object }} the file's text and the config it parses to
 */
export function renderConfig({ slug, defaultBranch, commands, lawsSource }) {
  const repo = { slug };
  if (defaultBranch) repo.defaultBranch = defaultBranch;
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
  ].join('\n');
  return { text, config: parseConfig(text, CONFIG_FILE) };
}
