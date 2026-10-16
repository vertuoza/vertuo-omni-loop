import { describe, expect, it } from 'vitest';
import { parseConfig } from 'vertuo-omni-plan/kit/lib/config.ts';
import { flowFiles, knowledgeFolders, packPaths, repositoryPath, touchesPack } from './paths.ts';

const config = (yaml: string) => parseConfig(`kit: 1\n${yaml}`);

const FLOW = `
flow:
  hooks:
    do-work.test:
      replace: .agents/hooks/tests.md
    pr.open:
      before: [.agents/hooks/pr-a.md, { path: /create-pr, alias: claude }]
  areas:
    kernel:
      paths: ['^kernel/']
      hooks:
        do-work.review: .omni-loop/flow/kernel/review.md
        do-work.test:
          after: [.agents/hooks/tests.md, { path: .claude/hooks/kernel.md, alias: claude }]
`;

describe('repositoryPath', () => {
  it('reads a repository path, dropping `./`, `.` segments and a trailing slash', () => {
    expect(repositoryPath('.omni-loop/knowledge')).toBe('.omni-loop/knowledge');
    expect(repositoryPath('./docs/knowledge/')).toBe('docs/knowledge');
    expect(repositoryPath('a/./b//c')).toBe('a/b/c');
  });

  it('refuses what is no repository path', () => {
    for (const path of ['', '/', '/etc/passwd', '../x', 'a/../../b', 'a\\b', '.']) expect(repositoryPath(path)).toBeNull();
  });
});

describe('knowledgeFolders', () => {
  it('is the knowledge folder alone when the decision records and the playbook lie inside it (the defaults)', () => {
    expect(knowledgeFolders(config(''))).toEqual(['.omni-loop/knowledge']);
  });

  it('adds a decision folder, a playbook or a glossary that lies outside it, each once, sorted', () => {
    const outside = config('paths:\n  knowledge: docs/knowledge/\n  adr: docs/adr\n  playbook: ./docs/knowledge/playbook\n  glossary: GLOSSARY.md\n');
    expect(knowledgeFolders(outside)).toEqual(['GLOSSARY.md', 'docs/adr', 'docs/knowledge']);
  });

  it('never takes a folder that only shares a prefix for one inside', () => {
    expect(knowledgeFolders(config('paths:\n  knowledge: kb\n  adr: kb-adr\n  playbook: kb/playbook\n'))).toEqual(['kb', 'kb-adr']);
  });

  it('leaves out a path that is no repository path', () => {
    expect(knowledgeFolders(config('paths:\n  knowledge: kb\n  adr: ../elsewhere\n  playbook: kb/playbook\n'))).toEqual(['kb']);
  });
});

describe('flowFiles', () => {
  it('is the config file alone with no flow', () => {
    expect(flowFiles(config(''))).toEqual(['.omni-loop/config.yml']);
  });

  it('adds every hook file the flow names, at the root and in each area, each once; a slash command adds none', () => {
    expect(flowFiles(config(FLOW))).toEqual([
      '.agents/hooks/pr-a.md',
      '.agents/hooks/tests.md',
      '.claude/hooks/kernel.md',
      '.omni-loop/config.yml',
      '.omni-loop/flow/kernel/review.md',
    ]);
  });
});

describe('packPaths', () => {
  it('lists the folders, and the files no folder already holds', () => {
    const inside = config(`paths:\n  knowledge: .omni-loop/knowledge\nflow:\n  hooks:\n    do-work.test: .omni-loop/knowledge/hooks/tests.md\n`);
    expect(packPaths(inside)).toEqual({ folders: ['.omni-loop/knowledge'], files: ['.omni-loop/config.yml'] });
  });
});

describe('touchesPack', () => {
  const paths = packPaths(config(FLOW));

  it('is true for a change under the knowledge folder, to the config, or to a hook file', () => {
    expect(touchesPack([{ path: '.omni-loop/knowledge/product/rules.md' }], paths)).toBe(true);
    expect(touchesPack([{ path: '.omni-loop/config.yml' }], paths)).toBe(true);
    expect(touchesPack([{ path: 'src/a.ts' }, { path: '.omni-loop/flow/kernel/review.md' }], paths)).toBe(true);
  });

  it('is true for a file renamed out of the knowledge folder, by its old path', () => {
    expect(touchesPack([{ path: 'docs/old-rules.md', previous: '.omni-loop/knowledge/product/rules.md' }], paths)).toBe(true);
  });

  it('is false for any other change, a folder that only shares a prefix included', () => {
    expect(touchesPack([], paths)).toBe(false);
    expect(touchesPack([{ path: 'src/a.ts' }, { path: '.omni-loop/delivery/inbox/7-x/spec.md' }], paths)).toBe(false);
    expect(touchesPack([{ path: '.omni-loop/knowledge-old/a.md' }, { path: '.omni-loop/config.yml.bak' }], paths)).toBe(false);
  });
});
