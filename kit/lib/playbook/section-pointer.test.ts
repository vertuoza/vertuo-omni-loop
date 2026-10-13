import { describe, expect, it } from 'vitest';
import { formText as fixtureFormText, makeRepo } from '../../test/fixture.ts';
import { resolveForm } from './resolve.ts';

// Issue 1778: a section pointer (`See: <path>#<anchor>`) printed its whole target file, so
// `omni kb show releasing` read the galaxy README from its deploy section to the end, 145 KB.

/** `formText`'s options, typed here until `kit/test/fixture.ts` is (PRD 725, s17). */
type FormTextOptions = {
  frontMatter?: Record<string, unknown>;
  slots?: { id: string; heading: string; required: boolean; body: string }[];
};
const formText = fixtureFormText as (options?: FormTextOptions) => string;

const FILE = '.omni-loop/knowledge/playbook/testing.md';
const TEMPLATE = formText({ slots: [{ id: 'never', heading: 'Never', required: true, body: 'A test never depends on the order it runs in.' }] });

/** The testing form's one section, its body the line `see`, resolved beside `files`. */
function resolvedSee(see: string, files: Record<string, string>) {
  const form = formText({ frontMatter: { state: 'filled' }, slots: [{ id: 'never', heading: 'Never', required: true, body: see }] });
  const { ctx } = makeRepo({ files: { [FILE]: form, ...files } });
  const result = resolveForm('testing', { ctx, template: TEMPLATE });
  return { section: result.sections.find((entry) => entry.slot === 'never'), problems: result.problems };
}

describe('a section pointer (issue 1778)', () => {
  it('a See: <path>#<anchor> line: only the section that anchor names, its own subsections included', () => {
    const result = resolvedSee('See: guides/handbook.md#deploy-to-production', {
      'guides/handbook.md':
        '# Handbook\n\n## Run it\n\nStart the app.\n\n## Deploy to production\n\nPush to main.\n\n### 1. Create the project\n\nOne project per app.\n\n## The game room\n\nFour cabinets.\n',
    });
    expect(result.section).toMatchObject({
      source: 'pointer',
      label: '[→ guides/handbook.md#deploy-to-production]',
      text: '## Deploy to production\n\nPush to main.\n\n### 1. Create the project\n\nOne project per app.',
    });
    expect(result.problems).toEqual([]);
  });

  it('a See: anchor is the heading as GitHub links it, and a heading inside a code block ends no section', () => {
    const result = resolvedSee('See: guides/handbook.md#screenshots-of-every-scene-and-of-app', {
      'guides/handbook.md':
        '## Run it\n\nStart the app.\n\n### Screenshots of every scene, and of `/app`\n\n```bash\n# not a heading\npnpm shots\n```\n\n### With a local Supabase\n\nStart it first.\n',
    });
    expect(result.section).toMatchObject({
      text: '### Screenshots of every scene, and of `/app`\n\n```bash\n# not a heading\npnpm shots\n```',
    });
    expect(result.problems).toEqual([]);
  });

  it('reports a See: anchor that names no heading of its page, and shows nothing for it', () => {
    const result = resolvedSee('See: guides/handbook.md#gone', { 'guides/handbook.md': '# Handbook\n\n## Run it\n\nStart the app.\n' });
    expect(result.section).toMatchObject({ source: 'pointer', text: '' });
    expect(result.problems).toEqual([`${FILE}: "## Never" See: guides/handbook.md#gone names no heading of guides/handbook.md`]);
  });
});
