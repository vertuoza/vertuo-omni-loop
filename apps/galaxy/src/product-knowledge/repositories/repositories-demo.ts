import { repositoriesSection, type RepositoriesData, type RepositoryPack } from './repositories-section';

// The demo's Repositories section (PRD 2419 s1): the demo product's two repositories, one with a
// knowledge pack whose pages read every level of the tree, one with none, and its plan repository.
// Fictional, as every demo is.

const DEMO_PRODUCT = 'demo-product-1';

const form = (id: string, title: string, text: string, owner?: string) => [
  '---',
  `form: ${id}`,
  'form-version: 1',
  'state: filled',
  'points-to: null',
  'evidence: null',
  'invaded: null',
  ...(owner === undefined ? [] : [`owner: [${owner}]`]),
  '---',
  '',
  `# ${title}`,
  '',
  '## One',
  '<!-- slot: one · required -->',
  text,
  '',
].join('\n');

const file = (path: string, content: string) => ({ path, content });
const PLAYBOOK = '.omni-loop/knowledge/playbook';
const ADR = '.omni-loop/knowledge/adr';

const API: RepositoryPack = {
  sha: '3f2a9c1d4e5b6a7980f1e2d3c4b5a69788776655',
  committedAt: '2026-11-18T10:00:00Z',
  files: [
    file('.omni-loop/config.yml', 'kit: 1\nlaws:\n  owners: [anna]\n'),
    file(`${PLAYBOOK}/testing.md`, form('testing', 'Testing', 'Run the suite with the test command.')),
    file(`${PLAYBOOK}/setup.md`, form('setup', 'Setup', 'Install once from the root.', 'dev')),
    file(`${ADR}/0001-one-database.md`, '# One database for every service\n'),
  ],
};

const PLAN: RepositoryPack = {
  sha: '9a8b7c6d5e4f30211203a4b5c6d7e8f901234567',
  committedAt: '2026-11-15T08:30:00Z',
  files: [
    file('.omni-loop/config.yml', 'kit: 1\nlaws:\n  owners: [pat]\n'),
    file(`${PLAYBOOK}/ci.md`, form('ci', 'CI', 'Every pull request runs the full suite.')),
    file(`${ADR}/0002-releases-weekly.md`, '# Releases go out every week\n'),
  ],
};

/** The demo product's section, or null for any other product. */
export function demoRepositories(product: string): RepositoriesData | null {
  if (product !== DEMO_PRODUCT) return null;
  return repositoriesSection({
    product,
    repositories: ['widgets/api', 'widgets/web'],
    plan: 'widgets/plan',
    packs: new Map([['widgets/api', API], ['widgets/plan', PLAN]]),
    settings: {
      repository: 'widgets/plan',
      level: { pages: [{ form: 'review', file: '.omni-loop/settings/playbook/review.md', text: form('review', 'Review', 'Fix what the playbook asks; push back with a reason.') }], records: [], lawOwners: ['pat'] },
    },
  });
}
