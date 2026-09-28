import { describe, expect, it } from 'vitest';
import { badgeLabel, codeKinds, fenceProblem, rehypeCodeBadges, type HastElement, type HastNode } from './badges';

// Where a guide code block goes (PRD 373): the words after the language on its opening fence, read
// into kinds when the guide is compiled, and turned into the arcade chips drawn above the code.

describe('the fence words', () => {
  it('reads terminal agent as both kinds, in order', () => {
    expect(codeKinds('terminal agent')).toEqual([{ kind: 'terminal' }, { kind: 'agent' }]);
  });

  it('puts TERMINAL first whatever the order written', () => {
    expect(codeKinds('agent terminal')).toEqual([{ kind: 'terminal' }, { kind: 'agent' }]);
  });

  it('carries a file\'s path', () => {
    expect(codeKinds('file=.omni-loop/config.yml')).toEqual([{ kind: 'file', path: '.omni-loop/config.yml' }]);
  });

  it('reads github, and nothing from no meta', () => {
    expect(codeKinds('github')).toEqual([{ kind: 'github' }]);
    expect(codeKinds(undefined)).toEqual([]);
    expect(codeKinds(null)).toEqual([]);
    expect(codeKinds('')).toEqual([]);
  });

  it('labels each kind as its badge reads', () => {
    expect(codeKinds('terminal agent').map(badgeLabel)).toEqual(['TERMINAL', 'CODING AGENT']);
    expect(badgeLabel({ kind: 'file', path: '.omni-loop/config.yml' })).toBe('FILE · .omni-loop/config.yml');
    expect(badgeLabel({ kind: 'github' })).toBe('GITHUB COMMENT');
  });
});

describe('a fence the guard refuses', () => {
  it.each([
    ['', 'names no kind (terminal, agent, file=<path>, github)'],
    ['foo', 'names "foo", which is no kind'],
    ['terminal foo', 'names "foo", which is no kind'],
    ['file', 'names file with no path'],
    ['file=', 'names file with no path'],
    ['github terminal', 'names github beside another kind: it stands alone'],
    ['file=a.yml agent', 'names file= beside another kind: it stands alone'],
    ['file=a.yml file=b.yml', 'names file= beside another kind: it stands alone'],
  ])('%j: %s', (meta, problem) => {
    expect(fenceProblem(meta)).toBe(problem);
  });

  it.each(['terminal', 'agent', 'terminal agent', 'agent terminal', 'file=.omni-loop/config.yml', 'github'])('%j holds', (meta) => {
    expect(fenceProblem(meta)).toBeNull();
  });
});

describe('the compile step', () => {
  const text = (value: string): HastNode => ({ type: 'text', value });
  const pre = (meta?: string): HastElement => ({
    type: 'element', tagName: 'pre', properties: {},
    children: [{ type: 'element', tagName: 'code', properties: {}, children: [text('git pull\n')], ...(meta ? { data: { meta } } : {}) }],
  });
  const root = (...children: HastNode[]) => ({ type: 'root' as const, children });

  it('sets the badges above the code, in one block', () => {
    const tree = root(pre('terminal agent'));
    rehypeCodeBadges()(tree);
    const block = tree.children[0] as HastElement;
    expect(block).toMatchObject({ tagName: 'div', properties: { className: ['docs-code'] } });
    const [badges, code] = block.children as HastElement[];
    expect(badges.properties).toEqual({ className: ['docs-badges'] });
    expect(badges.children).toEqual([
      { type: 'element', tagName: 'span', properties: { className: ['docs-badge'], dataKind: 'terminal' }, children: [text('TERMINAL')] },
      { type: 'element', tagName: 'span', properties: { className: ['docs-badge'], dataKind: 'agent' }, children: [text('CODING AGENT')] },
    ]);
    expect(code.tagName).toBe('pre');
  });

  it('finds a block nested in a list, and leaves one with no meta alone', () => {
    const list: HastElement = { type: 'element', tagName: 'li', properties: {}, children: [pre('github'), pre()] };
    rehypeCodeBadges()(root(list));
    expect((list.children[0] as HastElement).properties).toEqual({ className: ['docs-code'] });
    expect((list.children[1] as HastElement).tagName).toBe('pre');
  });
});
