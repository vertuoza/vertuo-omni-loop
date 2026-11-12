import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { parseDecisionRecord, readDecisions } from './decisions.ts';

describe('parseDecisionRecord', () => {
  const FILE = '.omni-loop/knowledge/adr/0067-a-link.md';

  it('reads the number, file, title, status and whole text from the file name and text alone', () => {
    const text = '# ADR-0067 — A link\n\n**Status:** adopted · **Date:** 2026-10-01 · **PRD:** #855 · **Layers:** api · **Domain:** access\n\n## Context\n\nx\n';
    expect(parseDecisionRecord(FILE, text)).toEqual({
      number: '0067',
      file: FILE,
      title: 'ADR-0067 — A link',
      status: 'adopted',
      text,
      prd: 855,
      layers: ['api'],
      domain: 'access',
    });
  });

  it('gives title null with no # heading, and status null with no Status header', () => {
    const record = parseDecisionRecord('records/0003-c.md', 'no heading here\n');
    expect(record.title).toBeNull();
    expect(record.status).toBeNull();
    expect(record.number).toBe('0003');
    expect(record.prd).toBeNull();
    expect(record.text).toBe('no heading here\n');
  });

  it('reads the status only from the header above the first section', () => {
    expect(parseDecisionRecord(FILE, '# T\n\n## Context\n\n**Status:** accepted\n').status).toBeNull();
  });
});

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
      records: [{ number: '0001', file: 'records/0001-a.md', title: '0001 — A', prd: null }],
      shared: [],
      next: '0002',
    });
  });

  it('takes the next free number past the highest, never a gap', () => {
    const { ctx } = makeRepo({ files: { '.omni-loop/knowledge/adr/0001-a.md': '# A\n', '.omni-loop/knowledge/adr/0007-g.md': '# G\n' } });
    expect(readDecisions({ ctx }).next).toBe('0008');
  });

  it('reads the PRD a record names on its header line, and none for a record without one (PRD 1797)', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/knowledge/adr/0001-a.md': '# ADR-0001 — A\n\n**Status:** adopted · **Date:** 2026-09-25 · **PRD:** #7 · **Decided:** nobody\n\n## Context\n\nx\n',
        '.omni-loop/knowledge/adr/0002-b.md': '# ADR-0002 — B\n\n**Status:** adopted · **Date:** 2026-09-25\n\n## Context\n\nAs PRD #7 says, **PRD:** #7 in the body is no header.\n',
        '.omni-loop/knowledge/adr/0003-c.md': '# ADR-0003 — C\n\n**PRD:** #1797\n',
        '.omni-loop/knowledge/adr/0004-d.md': '# ADR-0004 — D\n\n**PRD:** #0 · **PRD:** none\n',
      },
    });
    expect(readDecisions({ ctx }).records.map(({ number, prd }) => [number, prd])).toEqual([
      ['0001', 7],
      ['0002', null],
      ['0003', 1797],
      ['0004', null],
    ]);
  });

  it('reads the layers and the domain a record tags itself with on its header line (PRD 2346)', () => {
    const { ctx } = makeRepo({
      files: {
        '.omni-loop/knowledge/adr/0001-a.md': '# ADR-0001 — A\n\n**Status:** accepted · **Date:** 2026-10-21 · **PRD:** #7 · **Layers:** db, `auth` · **Domain:** ask\n\n## Context\n\nx\n',
        '.omni-loop/knowledge/adr/0002-b.md': '# ADR-0002 — B\n\n**Status:** accepted · **Layers:** api\n\n## Context\n\n**Layers:** db and **Domain:** ask in the body are no tags.\n',
        '.omni-loop/knowledge/adr/0003-c.md': '# ADR-0003 — C\n\n**Status:** accepted · **Date:** 2026-10-21\n',
      },
    });
    expect(readDecisions({ ctx }).records.map(({ number, layers, domain }) => [number, layers, domain])).toEqual([
      ['0001', ['db', 'auth'], 'ask'],
      ['0002', ['api'], undefined],
      ['0003', undefined, undefined],
    ]);
  });
});
