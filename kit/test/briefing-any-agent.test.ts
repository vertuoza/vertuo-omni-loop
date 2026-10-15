// PRD 1858, s1: the briefing's **Any agent** section — how a coding agent other than Claude runs the
// kit's skills — printed as a kit default in a repository whose own briefing has none, at step 0 of
// every skill, and small enough that every session of every repository can read it.
import { describe, expect, it } from 'vitest';
import { main } from '../bin/omni.ts';
import { formText, makeRepo } from './fixture.ts';

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const HEADING = '## Any agent  [kit default]';
const MAX_BYTES = 950;

/** A briefing of the repository's own, with a never section and no **Any agent** section. */
const BRIEFING = formText({
  frontMatter: { form: 'briefing', state: 'filled' },
  title: 'Briefing',
  opener: 'Use this page when a session starts: the rules that cost the most when broken.',
  slots: [{ id: 'never', heading: 'Never', required: true, body: '- Never merge into main.' }],
});

/** `omni <argv>` run in a fixture repository holding the briefing above: what it printed. */
async function omni(argv: string[]) {
  const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/knowledge/playbook/briefing.md': BRIEFING } });
  const out: string[] = [];
  const code = await main(argv, {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write() {} },
    env: { OMNI_SESSION_ID: 'session-1' },
    tokens: { read: () => null, write() {} },
    fetch: () => Promise.reject(new TypeError('fetch failed')),
  });
  return { code, out: out.join('') };
}

/** The **Any agent** section as printed: from its heading to the next one. */
function section(out: string): string {
  const start = out.indexOf(HEADING);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = out.indexOf('\n## ', start + HEADING.length);
  return out.slice(start, next === -1 ? undefined : next + 1);
}

describe('the briefing\'s Any agent section', () => {
  it('is printed as a kit default, between Links and Where to read next', async () => {
    const { code, out } = await omni(['kb', 'show', 'briefing']);
    expect(code).toBe(0);
    const at = (heading: string) => out.indexOf(heading);
    expect(at('## Links  [kit default]')).toBeGreaterThan(0);
    expect(at(HEADING)).toBeGreaterThan(at('## Links  [kit default]'));
    expect(at('## Where to read next')).toBeGreaterThan(at(HEADING));
  });

  it('says how to run a skill, ask the person, work without parallel agents, wait and start afresh', async () => {
    const text = section((await omni(['kb', 'show', 'briefing'])).out);
    expect(text).toContain('`/omni:<name>`');
    expect(text).toContain('(in Claude: `AskUserQuestion`)');
    expect(text).toContain('`omni ask question --file <file>`');
    expect(text).toContain('`omni ask wait <id>`');
    expect(text).toContain('`omni ask answer <round> --file <file>`');
    for (const exit of ['0', '3', '4']) expect(text).toMatch(new RegExp(`exit ${exit}\\b`));
    expect(text).toContain('one after another');
    expect(text).toContain('background');
    expect(text).toContain('(in Claude: `/clear`)');
  });

  it('says an agent that cannot choose a model per subagent runs every slice on the terminal\'s model (PRD 1934)', async () => {
    const text = section((await omni(['kb', 'show', 'briefing'])).out);
    expect(text).toContain('**Models.**');
    expect(text).toContain('model per subagent');
    expect(text).toContain('terminal\'s model');
  });

  it(`holds at most ${String(MAX_BYTES)} bytes as printed`, async () => {
    const text = section((await omni(['kb', 'show', 'briefing'])).out);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('is printed by `omni session start` too', async () => {
    const { code, out } = await omni(['session', 'start']);
    expect(code).toBe(0);
    expect(out).toContain(HEADING);
  });
});
