import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.mjs';
import { readDecisions } from './decisions.mjs';

describe('readDecisions', () => {
  it('reads only NNNN-<slug>.md files directly in the folder, whatever the spelling of paths.adr', () => {
    const { ctx } = makeRepo({
      config: { paths: { adr: 'records/' } },
      files: {
        'records/0001-a.md': 'Intro.\n\n## Not the title\n\n# 0001 — A\n',
        'records/0002-b.txt': '# not a record\n',
        'records/12-short.md': '# not a record\n',
        'records/README.md': '# The records\n',
        'records/old/0003-c.md': '# not in the folder\n',
      },
    });
    expect(readDecisions({ ctx })).toEqual({
      dir: 'records',
      records: [{ number: '0001', file: 'records/0001-a.md', title: '0001 — A' }],
      shared: [],
      next: '0002',
    });
  });

  it('takes the next free number past the highest, never a gap', () => {
    const { ctx } = makeRepo({ files: { '.omni-loop/knowledge/adr/0001-a.md': '# A\n', '.omni-loop/knowledge/adr/0007-g.md': '# G\n' } });
    expect(readDecisions({ ctx }).next).toBe('0008');
  });
});
