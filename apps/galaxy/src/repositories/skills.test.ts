import { describe, expect, it } from 'vitest';
import { frontmatterOf, skillsReader, type SkillsSource } from './skills';

// The repository's own skills, read live from its default branch (PRD 2313 s3), on a stubbed reader:
// each `.claude/skills/<name>/SKILL.md` with its frontmatter's name and description; a folder with no
// SKILL.md, a name that is not valid, one that is not its folder's and a fixed skill's are left out; a
// failed read answers its reason.

const FILES: Record<string, string | null> = {
  '.claude/skills/validate-prd/SKILL.md': '---\nname: validate-prd\ndescription: "Checks a PRD\'s criteria on its preview."\n---\n# Validate\n',
  '.claude/skills/release-notes/SKILL.md': '---\nname: release-notes\ndescription: >\n  Drafts the release notes\n  of a merged PR.\n---\nbody',
  '.claude/skills/no-skill-file/SKILL.md': null,
  '.claude/skills/Bad_Name/SKILL.md': '---\nname: Bad_Name\n---\n',
  '.claude/skills/other/SKILL.md': '---\nname: another\n---\n',
  '.claude/skills/yolo/SKILL.md': '---\nname: yolo\n---\n',
  '.claude/skills/bare/SKILL.md': 'no frontmatter at all',
};

const source = (over: Partial<SkillsSource> = {}): SkillsSource => ({
  folders: () => Promise.resolve(Object.keys(FILES).map((p) => p.split('/')[2] ?? '')),
  file: (_installation, _repository, path) => Promise.resolve(FILES[path] ?? null),
  defaultBranch: () => Promise.resolve('main'),
  ...over,
});

describe('frontmatterOf', () => {
  it('reads plain, quoted and folded values', () => {
    expect(frontmatterOf('---\nname: a\ndescription: plain words\n---\n')).toEqual({ name: 'a', description: 'plain words' });
    expect(frontmatterOf('---\ndescription: "quoted: yes"\n---\n')).toEqual({ description: 'quoted: yes' });
    expect(frontmatterOf('---\ndescription: >-\n  one\n  two\nname: b\n---\n')).toEqual({ description: 'one two', name: 'b' });
  });

  it('reads nothing from a file without frontmatter', () => {
    expect(frontmatterOf('# Title')).toEqual({});
  });
});

describe('skillsReader', () => {
  it('lists the skills of the default branch with their description, sorted', async () => {
    expect(await skillsReader(source()).read(7, 'acme/widgets')).toEqual({
      ok: true,
      branch: 'main',
      skills: [
        { name: 'bare', description: null },
        { name: 'release-notes', description: 'Drafts the release notes of a merged PR.' },
        { name: 'validate-prd', description: "Checks a PRD's criteria on its preview." },
      ],
    });
  });

  it('answers no skills for a repository without the folder', async () => {
    expect(await skillsReader(source({ folders: () => Promise.resolve([]) })).read(7, 'acme/widgets')).toEqual({ ok: true, branch: 'main', skills: [] });
  });

  it('answers the reason of a failed read', async () => {
    const failing = source({ folders: () => Promise.reject(new Error('GitHub answered 502 to acme/widgets/.claude/skills')) });
    expect(await skillsReader(failing).read(7, 'acme/widgets')).toEqual({ ok: false, reason: 'GitHub answered 502 to acme/widgets/.claude/skills' });
  });

  it('reads the branch as unknown when GitHub does not say', async () => {
    const unknown = source({ defaultBranch: () => Promise.reject(new Error('down')) });
    expect(await skillsReader(unknown).read(7, 'acme/widgets')).toMatchObject({ ok: true, branch: null });
  });
});
