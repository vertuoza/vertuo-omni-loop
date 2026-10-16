import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, packFiles, sha256Of } from './files.ts';

const hex = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

describe('sha256Of', () => {
  it('is the lower-case hex sha256 of the bytes, as knowledge_pack_put() computes it of the content', () => {
    const bytes = Buffer.from('# Rules\n\nÉté — a rule.\n', 'utf8');
    expect(sha256Of(bytes)).toBe(hex(bytes));
    expect(sha256Of(Buffer.from(''))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('packFiles', () => {
  it('packs each text file with its content and the sha256 of its bytes, in path order', () => {
    const files = new Map([
      ['.omni-loop/knowledge/b.md', Buffer.from('b — été\n')],
      ['.omni-loop/config.yml', Buffer.from('kit: 1\n')],
    ]);
    expect(packFiles(files)).toEqual({
      files: [
        { path: '.omni-loop/config.yml', content: 'kit: 1\n', sha256: hex(Buffer.from('kit: 1\n')) },
        { path: '.omni-loop/knowledge/b.md', content: 'b — été\n', sha256: hex(Buffer.from('b — été\n')) },
      ],
      left: [],
    });
  });

  it('leaves out, naming why, a file that is not UTF-8 text, one holding a NUL, and one over 1 MiB, and keeps the rest', () => {
    const files = new Map([
      ['k/mockup.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe])],
      ['k/nul.md', Buffer.from('a\u0000b')],
      ['k/big.md', Buffer.alloc(MAX_FILE_BYTES + 1, 'a')],
      ['k/max.md', Buffer.alloc(MAX_FILE_BYTES, 'a')],
      ['k/ok.md', Buffer.from('ok\n')],
    ]);
    const { files: packed, left } = packFiles(files);
    expect(packed.map((file) => file.path)).toEqual(['k/max.md', 'k/ok.md']);
    expect(left).toEqual([
      { path: 'k/big.md', why: 'over 1 MiB' },
      { path: 'k/mockup.png', why: 'not UTF-8 text' },
      { path: 'k/nul.md', why: 'holds a NUL character' },
    ]);
  });

  it('keeps a byte-order mark as part of the content, so the content hashes to the file', () => {
    const bytes = Buffer.from([0xef, 0xbb, 0xbf, 0x61]);
    const [file] = packFiles(new Map([['k/bom.md', bytes]])).files;
    expect(file?.sha256).toBe(hex(bytes));
    expect(Buffer.from(file?.content ?? '', 'utf8').equals(bytes)).toBe(true);
  });
});
