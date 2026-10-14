import { describe, expect, it } from 'vitest';
import { FlowsError, parseFlows } from './flows.ts';

const good = `# Critical flows

Intro text is ignored.

## sign-in: Signing in
A user who cannot sign in cannot use anything.

## invoicing: Issuing an invoice
Revenue stops.
Second line of cost.
`;

describe('parseFlows', () => {
  it('yields each flow id, name and cost, in order', () => {
    expect(parseFlows('critical-flows.md', good)).toEqual({
      kind: 'list',
      flows: [
        { id: 'sign-in', name: 'Signing in', cost: 'A user who cannot sign in cannot use anything.' },
        { id: 'invoicing', name: 'Issuing an invoice', cost: 'Revenue stops.\nSecond line of cost.' },
      ],
    });
  });

  it('reports an empty or blank file as no list, not as an error', () => {
    expect(parseFlows('f.md', '')).toEqual({ kind: 'none' });
    expect(parseFlows('f.md', '  \n\n')).toEqual({ kind: 'none' });
    expect(parseFlows('f.md', '# Critical flows\n\nNothing yet.\n')).toEqual({ kind: 'none' });
  });

  it('reports an absent file (undefined) as no list', () => {
    expect(parseFlows('f.md', undefined)).toEqual({ kind: 'none' });
  });

  it('refuses a flow without an id, naming the flow', () => {
    expect(() => parseFlows('f.md', '## : Signing in\ncost\n')).toThrow(FlowsError);
    expect(() => parseFlows('f.md', '## : Signing in\ncost\n')).toThrow(/f\.md.*flow 1.*"Signing in".*no id/);
  });

  it('refuses a flow without a name, naming the flow', () => {
    expect(() => parseFlows('f.md', '## sign-in:\ncost\n')).toThrow(/flow "sign-in".*no name/);
    expect(() => parseFlows('f.md', '## sign-in\ncost\n')).toThrow(/flow "sign-in".*no name/);
  });

  it('refuses an id used twice, naming it', () => {
    const text = '## a: One\nx\n## b: Two\ny\n## a: Three\nz\n';
    expect(() => parseFlows('f.md', text)).toThrow(/id "a" is used twice/);
  });

  it('refuses an id that cannot be a tag suffix', () => {
    expect(() => parseFlows('f.md', '## Sign In: Signing in\nx\n')).toThrow(/id "Sign In".*lowercase/);
  });
});
