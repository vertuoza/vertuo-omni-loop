// PRD #324, slices s4 and s5: which PRD a session works on, read from its branch — the slice, feature
// and phase-0 templates, a slice branch read as a slice first, and the topic to its folder — and,
// when the branch names none, from the record of what the session last worked on.
import { describe, expect, it } from 'vitest';
import { branchNames, folderOfNumber, folderOfTopic, templatePattern, whichPrd } from './which-prd.ts';

const BRANCHES = {
  feature: 'feat/{topic}',
  fix: 'fix/{topic}',
  phase0: 'docs/phase-0-{topic}',
  slice: 'feat/{topic}--{slice}',
};
const FOLDERS = ['0003-alpha', '0007-bravo', '0009-charlie', '0011-delta'];

describe('templatePattern', () => {
  it('reads `{topic}` as one or more characters, the shortest that matches', () => {
    expect(templatePattern('feat/{topic}--{slice}').exec('feat/a--b--c')?.groups).toEqual({ topic: 'a', slice: 'b--c' });
    expect(templatePattern('feat/{topic}').exec('feat/')).toBeNull();
  });

  it('reads `{slice}` as one or more characters other than `/`', () => {
    expect(templatePattern('feat/{topic}--{slice}').exec('feat/x--s1/more')).toBeNull();
    expect(templatePattern('feat/{topic}/{slice}').exec('feat/x/s1/more')?.groups).toEqual({ topic: 'x/s1', slice: 'more' });
    expect(templatePattern('feat/{topic}--{slice}').exec('feat/x--')).toBeNull();
  });

  it('reads every other character literally, the whole branch and nothing less', () => {
    expect(templatePattern('feat.{topic}+(x)').exec('feat.a+(x)')?.groups?.topic).toBe('a');
    expect(templatePattern('feat.{topic}+(x)').exec('featXa+(x)')).toBeNull();
    expect(templatePattern('feat/{topic}').exec('refs/feat/a')).toBeNull();
  });

  it('reads a second `{topic}` as the same topic', () => {
    expect(templatePattern('{topic}/work-{topic}').exec('a/work-a')?.groups?.topic).toBe('a');
    expect(templatePattern('{topic}/work-{topic}').exec('a/work-b')).toBeNull();
  });
});

describe('branchNames', () => {
  it('reads a slice branch as a slice first', () => {
    expect(branchNames('feat/help-and-status--s2', BRANCHES)).toEqual({ topic: 'help-and-status', slice: 's2' });
  });

  it('reads `feat/x--s1` as the slice `s1` of `x`, never as a feature named `x--s1`', () => {
    expect(branchNames('feat/x--s1', BRANCHES)).toEqual({ topic: 'x', slice: 's1' });
  });

  it('reads a feature branch, then a phase-0 branch, with no slice', () => {
    expect(branchNames('feat/bravo', BRANCHES)).toEqual({ topic: 'bravo', slice: null });
    expect(branchNames('docs/phase-0-delta', BRANCHES)).toEqual({ topic: 'delta', slice: null });
  });

  it('names nothing for a branch no template reads, and for no branch', () => {
    expect(branchNames('main', BRANCHES)).toBeNull();
    expect(branchNames('HEAD', BRANCHES)).toBeNull();
    expect(branchNames('fix/bravo', BRANCHES)).toBeNull();
    expect(branchNames('', BRANCHES)).toBeNull();
    expect(branchNames(null, BRANCHES)).toBeNull();
  });

  it('reads the templates the config gives, not the kit defaults', () => {
    const own = { feature: 'topic/{topic}', phase0: 'review/{topic}', slice: 'topic/{topic}/{slice}' };
    expect(branchNames('topic/bravo/s3', own)).toEqual({ topic: 'bravo', slice: 's3' });
    expect(branchNames('topic/bravo', own)).toEqual({ topic: 'bravo', slice: null });
    expect(branchNames('review/delta', own)).toEqual({ topic: 'delta', slice: null });
    expect(branchNames('feat/bravo', own)).toBeNull();
  });
});

describe('folderOfTopic', () => {
  it('finds the folder `<nnnn>-<topic>`', () => {
    expect(folderOfTopic(FOLDERS, 'bravo')).toEqual({ prd: 7, topic: 'bravo', folder: '0007-bravo' });
  });

  it('finds nothing for a topic with no folder, or a name that is no PRD folder', () => {
    expect(folderOfTopic(FOLDERS, 'zulu')).toBeNull();
    expect(folderOfTopic(['bravo', '7-bravo', 'notes'], 'bravo')).toBeNull();
  });

  it('reads the highest PRD number when two folders share the topic', () => {
    expect(folderOfTopic(['0003-alpha', '0012-alpha', '0007-alpha'], 'alpha')).toEqual({ prd: 12, topic: 'alpha', folder: '0012-alpha' });
  });
});

describe('whichPrd', () => {
  it('names the PRD and the slice of a slice branch', () => {
    expect(whichPrd({ branch: 'feat/bravo--s2', branches: BRANCHES, folders: FOLDERS })).toEqual({
      prd: 7,
      topic: 'bravo',
      folder: '0007-bravo',
      slice: 's2',
    });
  });

  it('names the PRD of a feature and of a phase-0 branch', () => {
    expect(whichPrd({ branch: 'feat/charlie', branches: BRANCHES, folders: FOLDERS })).toEqual({ prd: 9, topic: 'charlie', folder: '0009-charlie', slice: null });
    expect(whichPrd({ branch: 'docs/phase-0-delta', branches: BRANCHES, folders: FOLDERS })).toEqual({ prd: 11, topic: 'delta', folder: '0011-delta', slice: null });
  });

  it('names no PRD for a topic with no folder, even when another template would find one', () => {
    expect(whichPrd({ branch: 'feat/zulu', branches: BRANCHES, folders: FOLDERS })).toBeNull();
    const own = { feature: 'w/{topic}', phase0: 'r/{topic}', slice: 'w/{topic}-{slice}' };
    expect(whichPrd({ branch: 'w/zulu-s1', branches: own, folders: [...FOLDERS, '0013-zulu-s1'] })).toBeNull();
    expect(whichPrd({ branch: 'w/zulu-s1', branches: own, folders: [...FOLDERS, '0013-zulu'] })).toMatchObject({ prd: 13, slice: 's1' });
  });

  it('names no PRD on a branch no template reads', () => {
    expect(whichPrd({ branch: 'main', branches: BRANCHES, folders: FOLDERS })).toBeNull();
    expect(whichPrd({ branch: null, branches: BRANCHES, folders: FOLDERS })).toBeNull();
  });
});

describe('whichPrd: what the session last worked on', () => {
  it('names the PRD of the record on `main`, with no slice, and no PRD without a record', () => {
    expect(whichPrd({ branch: 'main', branches: BRANCHES, folders: FOLDERS, recorded: 7 })).toEqual({ prd: 7, topic: 'bravo', folder: '0007-bravo', slice: null });
    expect(whichPrd({ branch: 'main', branches: BRANCHES, folders: FOLDERS, recorded: null })).toBeNull();
    expect(whichPrd({ branch: null, branches: BRANCHES, folders: FOLDERS, recorded: 3 })).toMatchObject({ prd: 3, topic: 'alpha' });
  });

  it('lets a branch that names a PRD win over the record', () => {
    expect(whichPrd({ branch: 'feat/charlie', branches: BRANCHES, folders: FOLDERS, recorded: 7 })).toMatchObject({ prd: 9, topic: 'charlie' });
    expect(whichPrd({ branch: 'feat/bravo--s2', branches: BRANCHES, folders: FOLDERS, recorded: 9 })).toMatchObject({ prd: 7, slice: 's2' });
  });

  it('reads the record when the branch names a topic with no folder', () => {
    expect(whichPrd({ branch: 'feat/zulu', branches: BRANCHES, folders: FOLDERS, recorded: 9 })).toEqual({ prd: 9, topic: 'charlie', folder: '0009-charlie', slice: null });
  });

  it('names no PRD for a record whose PRD has no folder', () => {
    expect(whichPrd({ branch: 'main', branches: BRANCHES, folders: FOLDERS, recorded: 42 })).toBeNull();
    expect(whichPrd({ branch: 'main', branches: BRANCHES, folders: ['notes', '42-x'], recorded: 42 })).toBeNull();
  });
});

describe('folderOfNumber', () => {
  it('finds the folder `<nnnn>-<topic>` carrying the number', () => {
    expect(folderOfNumber(FOLDERS, 11)).toEqual({ prd: 11, topic: 'delta', folder: '0011-delta' });
    expect(folderOfNumber(['12345-wide'], 12345)).toEqual({ prd: 12345, topic: 'wide', folder: '12345-wide' });
  });

  it('finds nothing for a number no folder carries, or no number', () => {
    expect(folderOfNumber(FOLDERS, 42)).toBeNull();
    expect(folderOfNumber(FOLDERS, null as unknown as number)).toBeNull();
    expect(folderOfNumber(undefined, 7)).toBeNull();
  });

  it('reads the first folder carrying the number, in the order found', () => {
    expect(folderOfNumber(['0007-bravo', '0007-bravo-renamed'], 7)).toMatchObject({ folder: '0007-bravo' });
  });
});
