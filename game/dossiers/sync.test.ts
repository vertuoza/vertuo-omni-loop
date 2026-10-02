import { describe, it, expect } from 'vitest';
import { syncDossiers, type RepositoryReport } from './sync.ts';
import { dossierStore, type Dossier, type DossierStore } from './store.ts';
import { fakeDossiers, type DossierRow, type DossierTables } from './fake-supabase.ts';
import { fakeGitHub, type FakeRepo, type World } from './fake-github.ts';
import { gitBlobSha } from './folders.ts';

const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const ACME = 'b0000000-0000-4000-8000-000000000002';
const C1 = 'c1000000000000000000000000000000000000c1';
const C2 = 'c2000000000000000000000000000000000000c2';
const NOW = new Date('2026-09-27T12:00:00Z');
const D = '.omni-loop/delivery';
const ON = 'kit: 1\nask:\n  url: https://ask.example.com\ndossier:\n  enabled: true\n';

const SPEC = '---\nprd: 216\ntitle: PRD dossiers — versioned and shareable\nblocked-by: [144]\nspec: file\n---\n\n# PRD dossiers\n';
const PLAN = '# Plan: PRD dossiers\n\n| id | slice |\n';
const PAGE = '<!doctype html><title>before/after</title>\n';
const OLD_SPEC = '# Ask mode\n\nNo front matter here.\n';

// The plan repository, dossiers switched on, with a PRD in the inbox and one already shipped.
function omniLoop(over: Partial<FakeRepo> = {}): FakeRepo {
  return {
    commit: C1,
    files: {
      '.omni-loop/config.yml': ON,
      'README.md': '# readme\n',
      [`${D}/inbox/0216-prd-dossiers/spec.md`]: SPEC,
      [`${D}/inbox/0216-prd-dossiers/plan.md`]: PLAN,
      [`${D}/inbox/0216-prd-dossiers/before-after.html`]: PAGE,
      [`${D}/shipped/0003-ask-mode/spec.md`]: OLD_SPEC,
      [`${D}/outbox/0216-prd-dossiers/s1-02-x.md`]: '---\nid: s1-02-x\n---\n',
    },
    ...over,
  };
}

function setup(world: World, tables: DossierTables = {}) {
  const github = fakeGitHub(world);
  const fake = fakeDossiers(tables);
  const store = dossierStore({ url: 'https://x.supabase.co', key: 'service', fetch: fake.fetch });
  const lines: string[] = [];
  const log = { log: (m: string) => lines.push(m), warn: (m: string) => lines.push(m) };
  // `github.exec` is read at each call, so a test can put a failing gh in front of the fake.
  // Each report is read as a repository's: a skipped one is compared whole, never read field by field.
  const run = (repos = ['vertuo-omni-loop'], { org = 'vertuoza', using = store }: { org?: string; using?: DossierStore } = {}) =>
    syncDossiers({ exec: (args) => github.exec(args), store: using, workspaceId: VERTUOZA, org, repos, now: NOW, log }) as Promise<RepositoryReport[]>;
  const blobReads = () => github.calls.filter((c) => c.includes('/git/blobs/'));
  const versions = (prd: number) => {
    const d = fake.tables.dossiers!.find((x) => x.prd === prd);
    return fake.tables.dossier_versions!.filter((v) => v.dossier_id === d!.id).map((v) => [v.kind, v.content]);
  };
  return { github, fake, store, run, lines, blobReads, versions, world };
}

describe('syncDossiers: the first run', () => {
  it('creates a dossier per PRD folder, titled from the spec or else the topic, with versions from GitHub at the head commit', async () => {
    const { fake, run, github, lines } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    const [report] = await run();
    expect(report).toEqual({
      slug: 'vertuoza/vertuo-omni-loop', commit: C1, folders: 2, created: [3, 216], fetched: 4,
      added: [{ prd: 3, kind: 'spec', version: 1 }, { prd: 216, kind: 'spec', version: 1 }, { prd: 216, kind: 'plan', version: 1 }, { prd: 216, kind: 'before-after', version: 1 }],
    });
    expect(fake.tables.dossiers!.map((d) => [d.workspace_id, d.home_repo, d.prd, d.title, d.numbered_at, d.opened_by])).toEqual([
      [VERTUOZA, 'vertuoza/vertuo-omni-loop', 3, 'ask-mode', NOW.toISOString(), null],
      [VERTUOZA, 'vertuoza/vertuo-omni-loop', 216, 'PRD dossiers — versioned and shareable', NOW.toISOString(), null],
    ]);
    const spec216 = fake.tables.dossier_versions!.find((v) => v.content === SPEC);
    expect(spec216).toMatchObject({ source: 'github', commit_sha: C1, git_blob: gitBlobSha(SPEC), uploaded_by: null });
    expect(github.calls.filter((c) => c.includes('/git/trees/'))).toHaveLength(1);
    expect(lines[0]).toBe('vertuoza/vertuo-omni-loop @ c1000000 (main): 2 PRD folders · 2 dossiers created · 4 files fetched · added: #3 spec v1, #216 spec v1, #216 plan v1, #216 before-after v1');
  });

  it('keeps the home repository in lower case, as the kit and the migration do', async () => {
    const { fake, run } = setup({ 'Vertuoza/Vertuo-Omni-Loop': omniLoop() });
    await run(['Vertuo-Omni-Loop'], { org: 'Vertuoza' });
    expect(fake.tables.dossiers!.map((d) => d.home_repo)).toEqual(['vertuoza/vertuo-omni-loop', 'vertuoza/vertuo-omni-loop']);
  });
});

describe('syncDossiers: the runs after', () => {
  it('adds nothing and fetches no blob when nothing changed', async () => {
    const { run, blobReads, fake, lines } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    await run();
    const before = { dossiers: fake.tables.dossiers!.length, versions: fake.tables.dossier_versions!.length, blobs: blobReads().length };
    const [report] = await run();
    expect(report).toMatchObject({ created: [], added: [], fetched: 0 });
    expect(fake.tables.dossiers).toHaveLength(before.dossiers);
    expect(fake.tables.dossier_versions).toHaveLength(before.versions);
    expect(blobReads()).toHaveLength(before.blobs);
    expect(lines.at(-1)).toBe('vertuoza/vertuo-omni-loop @ c1000000 (main): 2 PRD folders · nothing added');
  });

  it('fetches only the changed file and adds one version of it, at the new commit, retitling from a changed spec', async () => {
    const { run, blobReads, fake, versions, world } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    await run();
    const spec2 = SPEC.replace('versioned and shareable', 'every version kept');
    world['vertuoza/vertuo-omni-loop']!.commit = C2;
    world['vertuoza/vertuo-omni-loop']!.files[`${D}/inbox/0216-prd-dossiers/spec.md`] = spec2;
    const fetchedBefore = blobReads().length;
    const [report] = await run();
    expect(blobReads().slice(fetchedBefore)).toEqual([expect.stringContaining(`/git/blobs/${gitBlobSha(spec2)} `)]);
    expect(report!.added).toEqual([{ prd: 216, kind: 'spec', version: 2 }]);
    expect(versions(216)).toEqual([['spec', SPEC], ['plan', PLAN], ['before-after', PAGE], ['spec', spec2]]);
    expect(fake.tables.dossier_versions!.at(-1)).toMatchObject({ commit_sha: C2, git_blob: gitBlobSha(spec2) });
    expect(fake.tables.dossiers!.find((d) => d.prd === 216)!.title).toBe('PRD dossiers — every version kept');
  });

  it('adds a version when a file goes back to an earlier content, as the version rule says', async () => {
    const { run, versions, world } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    const path = `${D}/inbox/0216-prd-dossiers/plan.md`;
    await run();
    world['vertuoza/vertuo-omni-loop']!.files[path] = `${PLAN}| s1 | changed |\n`;
    await run();
    world['vertuoza/vertuo-omni-loop']!.files[path] = PLAN;
    const [report] = await run();
    expect(report!.added).toEqual([{ prd: 216, kind: 'plan', version: 3 }]);
    expect(versions(216).filter(([kind]) => kind === 'plan').map(([, c]) => c)).toEqual([PLAN, `${PLAN}| s1 | changed |\n`, PLAN]);
  });

  it('finds the dossier the kit pushed, and fetches a file only when it differs from what the kit stored', async () => {
    const kitDossier = { id: 'd-kit', workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-loop', prd: 216, title: 'PRD dossiers — versioned and shareable', opened_by: 'u1', claude_session_id: 's1', created_at: '2026-09-27T08:00:00Z', numbered_at: '2026-09-27T09:00:00Z' };
    const kit = (id: string, kind: string, content: string, at: string) => ({ id, dossier_id: 'd-kit', kind, content, sha256: 'x'.repeat(64), bytes: Buffer.byteLength(content), source: 'kit', uploaded_by: 'u1', commit_sha: null, git_blob: null, created_at: at });
    const { run, blobReads, fake, lines } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() }, {
      dossiers: [kitDossier] as unknown as DossierRow[],
      // The spec as the kit pushed it; a plan the kit pushed before its last change on the branch.
      dossier_versions: [kit('k1', 'spec', SPEC, '2026-09-27T09:00:00Z'), kit('k2', 'plan', PLAN.replace('Plan', 'Plan!'), '2026-09-27T09:00:01Z')],
    });
    const [report] = await run(['vertuo-omni-loop']);
    // The spec is not fetched: the kit's stored spec hashes to the tree's blob. The plan differs.
    expect(blobReads().map((c) => c.split(' ')[1]!.split('/').pop())).toEqual([gitBlobSha(OLD_SPEC), gitBlobSha(PLAN), gitBlobSha(PAGE)]);
    expect(report!.created).toEqual([3]);
    expect(report!.added).toEqual([{ prd: 3, kind: 'spec', version: 1 }, { prd: 216, kind: 'plan', version: 2 }, { prd: 216, kind: 'before-after', version: 1 }]);
    expect(fake.tables.dossiers!.filter((d) => d.prd === 216)).toHaveLength(1);
    expect(fake.tables.dossiers!.find((d) => d.prd === 216)!.opened_by).toBe('u1');
    expect(lines.join('\n')).not.toContain('!');
  });
});

describe('syncDossiers: what it skips, and logs, without failing', () => {
  it('skips a repository with no config, with the switch off, or with ask.url unset, before listing its tree', async () => {
    const off = (config: string | null) => ({ commit: C1, files: { ...(config === null ? {} : { '.omni-loop/config.yml': config }), [`${D}/inbox/0001-a/spec.md`]: SPEC } });
    const { run, github, fake, lines } = setup({
      'vertuoza/no-config': off(null),
      'vertuoza/switch-off': off('kit: 1\nask:\n  url: https://ask.example.com\n'),
      'vertuoza/no-ask-url': off('kit: 1\ndossier:\n  enabled: true\n'),
      'vertuoza/vertuo-omni-loop': omniLoop(),
    });
    const reports = await run(['no-config', 'switch-off', 'no-ask-url', 'vertuo-omni-loop']);
    expect(reports.map((r) => [r.slug, r.skipped ?? null])).toEqual([
      ['vertuoza/no-config', 'no .omni-loop/config.yml on main'],
      ['vertuoza/switch-off', 'dossier.enabled is false'],
      ['vertuoza/no-ask-url', 'ask.url is not set'],
      ['vertuoza/vertuo-omni-loop', null],
    ]);
    expect(github.calls.filter((c) => c.includes('/git/'))).toEqual(github.calls.filter((c) => c.includes('repos/vertuoza/vertuo-omni-loop/git/')));
    expect(new Set(fake.tables.dossiers!.map((d) => d.home_repo))).toEqual(new Set(['vertuoza/vertuo-omni-loop']));
    expect(lines.slice(0, 3)).toEqual([
      '  - skipped vertuoza/no-config: no .omni-loop/config.yml on main',
      '  - skipped vertuoza/switch-off: dossier.enabled is false',
      '  - skipped vertuoza/no-ask-url: ask.url is not set',
    ]);
  });

  it('skips and logs a folder whose name does not parse and a file over 512 KiB, and still reads the rest', async () => {
    const big = `<html>${'x'.repeat(512 * 1024)}</html>`;
    const repo = omniLoop();
    repo.files[`${D}/inbox/drafts/spec.md`] = SPEC;
    repo.files[`${D}/inbox/0216-prd-dossiers/before-after.html`] = big;
    const { run, blobReads, versions, lines } = setup({ 'vertuoza/vertuo-omni-loop': repo });
    const [report] = await run();
    expect(report!.created).toEqual([3, 216]);
    expect(versions(216).map(([kind]) => kind)).toEqual(['spec', 'plan']);
    expect(blobReads().some((c) => c.includes(gitBlobSha(big)))).toBe(false);
    expect(lines).toContain(`  ! skipped ${D}/inbox/0216-prd-dossiers/before-after.html in vertuoza/vertuo-omni-loop: ${Buffer.byteLength(big)} bytes, over 512 KiB`);
    expect(lines).toContain(`  ! skipped ${D}/inbox/drafts in vertuoza/vertuo-omni-loop: the folder name does not read as <nnnn>-<topic>`);
  });

  it('skips and logs a repository that cannot be read, and reads the next', async () => {
    const { run, fake, lines } = setup({ 'vertuoza/gone': { unreadable: true, commit: C1, files: {} }, 'vertuoza/vertuo-omni-loop': omniLoop() });
    const reports = await run(['gone', 'vertuo-omni-loop']);
    expect(reports[0]).toEqual({ slug: 'vertuoza/gone', skipped: 'cannot be read: gh: Not Found (HTTP 404)' });
    expect(reports[1]!.created).toEqual([3, 216]);
    expect(lines[0]).toBe('  ! skipped vertuoza/gone: cannot be read: gh: Not Found (HTTP 404)');
    expect(fake.tables.dossiers).toHaveLength(2);
  });

  it('skips a file whose blob cannot be fetched, and fetches it at the next run', async () => {
    const { github, run, versions, lines } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    const planBlob = gitBlobSha(PLAN);
    const exec = github.exec;
    let failing = true;
    github.exec = async (args) => {
      if (failing && args[1]!.endsWith(`/git/blobs/${planBlob}`)) throw Object.assign(new Error('Command failed'), { stderr: 'gh: Server Error (HTTP 502)\n' });
      return exec(args);
    };
    const [first] = await run();
    expect(first!.added.map((a) => `${a.prd} ${a.kind}`)).toEqual(['3 spec', '216 spec', '216 before-after']);
    expect(lines).toContain(`  ! skipped ${D}/inbox/0216-prd-dossiers/plan.md in vertuoza/vertuo-omni-loop: cannot be read: gh: Server Error (HTTP 502)`);
    failing = false;
    const [second] = await run();
    expect(second!.added).toEqual([{ prd: 216, kind: 'plan', version: 1 }]);
    expect(versions(216).map(([kind]) => kind)).toEqual(['spec', 'before-after', 'plan']);
  });

  it('logs a PRD it could not store, and goes on with the next', async () => {
    const { run, store, lines } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    const refusing = { ...store, open: async (d: Parameters<DossierStore['open']>[0]) => (d.prd === 3 ? Promise.reject(new Error('Supabase: write dossiers 0–1 failed (503)')) : store.open(d)) };
    const [report] = await run(['vertuo-omni-loop'], { using: refusing });
    expect(report!.created).toEqual([216]);
    expect(lines).toContain('  ! skipped PRD 3 of vertuoza/vertuo-omni-loop: Supabase: write dossiers 0–1 failed (503)');
  });

  it('logs a file whose version is refused, and still adds its siblings', async () => {
    const { run, store, versions, lines } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() });
    const refusing = { ...store, addVersion: async (v: Parameters<DossierStore['addVersion']>[0]) => (v.kind === 'plan' ? Promise.reject(new Error('Supabase: add a plan version failed (400)')) : store.addVersion(v)) };
    await run(['vertuo-omni-loop'], { using: refusing });
    expect(versions(216).map(([kind]) => kind)).toEqual(['spec', 'before-after']);
    expect(lines).toContain(`  ! skipped ${D}/inbox/0216-prd-dossiers/plan.md in vertuoza/vertuo-omni-loop: Supabase: add a plan version failed (400)`);
  });

  it('takes the dossier the kit opened between the listing and the insert, rather than a second one', async () => {
    const kitDossier = { id: 'd-kit', workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-loop', prd: 216, title: 'From the kit', opened_by: 'u1', claude_session_id: null, created_at: '2026-09-27T08:00:00Z', numbered_at: '2026-09-27T08:00:00Z' };
    const { run, store, fake } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() }, { dossiers: [kitDossier] as unknown as DossierRow[] });
    const stale = { ...store, dossiersOf: (w: string, r: string, prd: number | null = null) => (prd === null ? Promise.resolve(new Map<number, Dossier>()) : store.dossiersOf(w, r, prd)) };
    const [report] = await run(['vertuo-omni-loop'], { using: stale });
    expect(report!.created).toEqual([3]);
    expect(fake.tables.dossiers!.filter((d) => d.prd === 216).map((d) => d.id)).toEqual(['d-kit']);
    expect(fake.tables.dossier_versions!.filter((v) => v.dossier_id === 'd-kit').map((v) => v.kind)).toEqual(['spec', 'plan', 'before-after']);
  });
});

describe('syncDossiers: visual and bug fixes (PRD 627)', () => {
  const V548 = '<!doctype html><title>Visual 548 before/after</title>\n';
  const V561 = '<!doctype html><title>Sidebar Omni foot</title>\n';
  const BUG = '# Bug 571: omni reads 1e2 as a PRD number\n';
  const R1 = '<!doctype html><title>Round 1</title>\n';
  const R2 = '<!doctype html><title>Round 2</title>\n';

  function withFixes() {
    const repo = omniLoop();
    repo.files[`${D}/visual/0548-omni-links-new-tab/before-after.html`] = V548;
    repo.files[`${D}/visual/0561-omni-links-footer/before-after.html`] = V561;
    repo.files[`${D}/bugs/0571-number-args/bug.md`] = BUG;
    repo.issues = { 548: 'Visual: Docs and Release notes open in a new tab', 571: 'Bug: omni reads 1e2 or 0x10 as a PRD number' };
    return repo;
  }
  const fixes = (fake: ReturnType<typeof fakeDossiers>, kind: string) => fake.tables.dossiers!.filter((d) => d.kind === kind).map((d) => [d.prd, d.title, d.numbered_at]);
  const versionsOf = (fake: ReturnType<typeof fakeDossiers>, kind: string, prd: number) => {
    const d = fake.tables.dossiers!.find((x) => x.kind === kind && x.prd === prd);
    return fake.tables.dossier_versions!.filter((v) => v.dossier_id === d!.id).map((v) => [v.kind, v.content]);
  };

  it('makes two visual and one bug dossier for #548, #561 and #571, titled after their issues or else their topics', async () => {
    const { fake, run, lines } = setup({ 'vertuoza/vertuo-omni-loop': withFixes() });
    const [report] = await run();
    expect(fixes(fake, 'visual')).toEqual([
      [548, 'Docs and Release notes open in a new tab', NOW.toISOString()],
      [561, 'omni-links-footer', NOW.toISOString()],
    ]);
    expect(fixes(fake, 'bug')).toEqual([[571, 'omni reads 1e2 or 0x10 as a PRD number', NOW.toISOString()]]);
    expect(fake.tables.dossiers!.filter((d) => d.kind === 'prd').map((d) => d.prd)).toEqual([3, 216]);
    expect(versionsOf(fake, 'visual', 548)).toEqual([['before-after', V548]]);
    expect(versionsOf(fake, 'bug', 571)).toEqual([['bug-record', BUG]]);
    expect(fake.tables.dossier_versions!.find((v) => v.content === BUG)).toMatchObject({ source: 'github', commit_sha: C1, git_blob: gitBlobSha(BUG) });
    expect(report!.created).toEqual([3, 216]);
    expect(report!.fixes).toEqual({
      folders: 3,
      created: [{ kind: 'visual', prd: 548 }, { kind: 'visual', prd: 561 }, { kind: 'bug', prd: 571 }],
      added: [{ fix: 'visual', prd: 548, kind: 'before-after', version: 1 }, { fix: 'visual', prd: 561, kind: 'before-after', version: 1 }, { fix: 'bug', prd: 571, kind: 'bug-record', version: 1 }],
    });
    expect(lines.at(-1)).toBe('vertuoza/vertuo-omni-loop @ c1000000 (main): 2 PRD folders · 3 fix folders · 5 dossiers created · 7 files fetched · added: #3 spec v1, #216 spec v1, #216 plan v1, #216 before-after v1, visual #548 before-after v1, visual #561 before-after v1, bug #571 bug-record v1');
  });

  it('adds no version and fetches nothing on a second run, and reads an issue\'s title only when it opens its dossier', async () => {
    const { fake, run, github, blobReads } = setup({ 'vertuoza/vertuo-omni-loop': withFixes() });
    await run();
    const before = { versions: fake.tables.dossier_versions!.length, blobs: blobReads().length, issues: github.calls.filter((c) => c.includes('/issues/')).length };
    const [report] = await run();
    expect(report).toMatchObject({ created: [], added: [], fetched: 0, fixes: { folders: 3, created: [], added: [] } });
    expect(fake.tables.dossier_versions).toHaveLength(before.versions);
    expect(blobReads()).toHaveLength(before.blobs);
    expect(github.calls.filter((c) => c.includes('/issues/'))).toHaveLength(before.issues);
    expect(fake.tables.dossiers).toHaveLength(5);
  });

  it('adds each variations round in order, then only a new round, fetching only it', async () => {
    const { fake, run, world, blobReads } = setup({ 'vertuoza/vertuo-omni-loop': withFixes() });
    const files = world['vertuoza/vertuo-omni-loop']!.files;
    files[`${D}/visual/0548-omni-links-new-tab/variations-r1.html`] = R1;
    await run();
    files[`${D}/visual/0548-omni-links-new-tab/variations-r2.html`] = R2;
    const fetchedBefore = blobReads().length;
    const [report] = await run();
    expect(blobReads().slice(fetchedBefore)).toEqual([expect.stringContaining(`/git/blobs/${gitBlobSha(R2)} `)]);
    expect(report!.fixes!.added).toEqual([{ fix: 'visual', prd: 548, kind: 'variations', version: 2 }]);
    expect(versionsOf(fake, 'visual', 548)).toEqual([['before-after', V548], ['variations', R1], ['variations', R2]]);
  });

  it('finds the fix the kit pushed, fetching a round only when no round the kit stored hashes the same', async () => {
    const kitFix = { id: 'd-kit', workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-loop', kind: 'visual', prd: 548, title: 'From the kit', opened_by: 'u1', claude_session_id: null, created_at: '2026-09-27T08:00:00Z', numbered_at: '2026-09-27T08:00:00Z' };
    const kit = (id: string, kind: string, content: string, at: string) => ({ id, dossier_id: 'd-kit', kind, content, sha256: 'x'.repeat(64), bytes: Buffer.byteLength(content), source: 'kit', uploaded_by: 'u1', commit_sha: null, git_blob: null, created_at: at });
    const repo = withFixes();
    repo.files[`${D}/visual/0548-omni-links-new-tab/variations-r1.html`] = R1;
    repo.files[`${D}/visual/0548-omni-links-new-tab/variations-r2.html`] = R2;
    const { run, fake, blobReads } = setup({ 'vertuoza/vertuo-omni-loop': repo }, {
      dossiers: [kitFix],
      dossier_versions: [kit('k1', 'before-after', V548, '2026-09-27T08:00:01Z'), kit('k2', 'variations', R1, '2026-09-27T08:00:02Z')],
    });
    const [report] = await run();
    const fetched = blobReads().map((c) => c.split(' ')[1]!.split('/').pop());
    expect(fetched).toContain(gitBlobSha(R2));
    expect(fetched).not.toContain(gitBlobSha(R1));
    expect(fetched).not.toContain(gitBlobSha(V548));
    expect(report!.fixes!.created).toEqual([{ kind: 'visual', prd: 561 }, { kind: 'bug', prd: 571 }]);
    expect(fake.tables.dossiers!.filter((d) => d.kind === 'visual' && d.prd === 548).map((d) => [d.id, d.title])).toEqual([['d-kit', 'From the kit']]);
  });

  it('titles a fix after its folder\'s topic when its issue cannot be read, and logs it', async () => {
    const { run, fake, github, lines } = setup({ 'vertuoza/vertuo-omni-loop': withFixes() });
    const exec = github.exec;
    github.exec = async (args) => {
      if (args[1]!.endsWith('/issues/548')) throw Object.assign(new Error('Command failed'), { stderr: 'gh: Server Error (HTTP 502)\n' });
      return exec(args);
    };
    await run();
    expect(fixes(fake, 'visual').map(([prd, title]) => [prd, title])).toEqual([[548, 'omni-links-new-tab'], [561, 'omni-links-footer']]);
    expect(lines).toContain('  ! vertuoza/vertuo-omni-loop: the title of issue 548 cannot be read (gh: Server Error (HTTP 502)): titled omni-links-new-tab');
  });

  it('reads the fixes of a repository with no PRD folder, and skips a fix folder whose name does not parse', async () => {
    const { run, fake, lines } = setup({ 'vertuoza/vertuo-core': { commit: C1, files: { '.omni-loop/config.yml': ON, [`${D}/bugs/0012-crash/bug.md`]: BUG, [`${D}/visual/draft/before-after.html`]: V548 } } });
    const [report] = await run(['vertuo-core']);
    expect(report!.folders).toBe(0);
    expect(fixes(fake, 'bug').map(([prd, title]) => [prd, title])).toEqual([[12, 'crash']]);
    expect(lines).toContain(`  ! skipped ${D}/visual/draft in vertuoza/vertuo-core: the folder name does not read as <nnnn>-<topic>`);
  });
});

describe('syncDossiers: whose dossiers', () => {
  it('writes the workspace it runs for, reads each repository once, and leaves another workspace\'s dossier of the same key alone', async () => {
    const acmeDossier = { id: 'd-acme', workspace_id: ACME, home_repo: 'vertuoza/vertuo-omni-loop', prd: 216, title: 'Theirs', opened_by: null, claude_session_id: null, created_at: '2026-09-27T08:00:00Z', numbered_at: '2026-09-27T08:00:00Z' };
    const { run, github, fake } = setup({ 'vertuoza/vertuo-omni-loop': omniLoop() }, { dossiers: [acmeDossier] as unknown as DossierRow[] });
    const reports = await run(['vertuo-omni-loop', 'vertuo-omni-loop']);
    expect(reports).toHaveLength(1);
    expect(github.calls.filter((c) => c.includes('/git/trees/'))).toHaveLength(1);
    expect(fake.tables.dossiers!.filter((d) => d.workspace_id === VERTUOZA).map((d) => d.prd)).toEqual([3, 216]);
    expect(fake.tables.dossiers!.find((d) => d.id === 'd-acme')!.title).toBe('Theirs');
  });
});
