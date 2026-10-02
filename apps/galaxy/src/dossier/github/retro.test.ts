import { describe, expect, it, vi } from 'vitest';
import { readRetro, retroSource } from './retro';
import type { PullRef } from './summary';

// Where the PRD page reads a PRD's retro.md (PRD 426, s3): from the retro branch while its pull request
// is open, from the default branch once it is merged, and nowhere when there is no retro PR. Pure: the
// file is read through a stub, never GitHub.

const WHERE = { delivery: 'loop/delivery', folder: '0426-prd-page-stage', defaultBranch: 'trunk', retroBranch: 'docs/retro-prd-page-stage' };
const retroPr = (state: PullRef['state']): PullRef => ({ number: 440, url: 'https://github.com/acme/widgets/pull/440', state, draft: false });

describe('where the retro is read', () => {
  it('reads retro.md in the shipped folder on the retro branch while its PR is open', () => {
    expect(retroSource(retroPr('open'), WHERE)).toEqual({ file: 'loop/delivery/shipped/0426-prd-page-stage/retro.md', ref: 'docs/retro-prd-page-stage' });
  });

  it('reads it on the default branch once the retro PR is merged', () => {
    expect(retroSource(retroPr('merged'), WHERE)).toEqual({ file: 'loop/delivery/shipped/0426-prd-page-stage/retro.md', ref: 'trunk' });
  });

  it('reads nothing when there is no retro PR, or no folder to find it in', () => {
    expect(retroSource(null, WHERE)).toBeNull();
    expect(retroSource(retroPr('open'), { ...WHERE, folder: null })).toBeNull();
  });
});

describe('the retro text', () => {
  it('is the file as the source holds it', async () => {
    const raw = vi.fn(() => Promise.resolve('# Retro\n\nIt went well.\n'));
    expect(await readRetro(retroPr('open'), WHERE, raw)).toBe('# Retro\n\nIt went well.\n');
    expect(raw).toHaveBeenCalledWith('loop/delivery/shipped/0426-prd-page-stage/retro.md', 'docs/retro-prd-page-stage');
  });

  it('is none, with no read, when there is no retro PR; none when the file is not there yet', async () => {
    const raw = vi.fn(() => Promise.resolve(null));
    expect(await readRetro(null, WHERE, raw)).toBeNull();
    expect(raw).not.toHaveBeenCalled();
    expect(await readRetro(retroPr('merged'), WHERE, raw)).toBeNull();
  });

  it('lets a failed read fail, so the summary marks it unread', async () => {
    await expect(readRetro(retroPr('open'), WHERE, () => Promise.reject(new Error('GitHub answered 502')))).rejects.toThrow('502');
  });
});
