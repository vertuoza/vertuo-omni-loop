import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { flatCtx } from '../../test/flat-layout.mjs';
import { makeMarkers } from '../markers.mjs';
import {
  announcedKeys,
  answeredOutcome,
  answeredQuestionText,
  assignNumbers,
  countsByRank,
  findMarkerComment,
  findPrMarkerComment,
  formatNumbersMarker,
  formatOutboxComment,
  formatOutboxPrComment,
  maybeWriteSlackNote,
  openItemsForPrd,
  parseAnnouncedMarker,
  parseNameStatus,
  parseNumbersMarker,
  parseRoundMarkers,
  readPrCommentResult,
  slackLine,
  slackOwner,
  sortItems,
  unaccountedChanges,
  upsertOutboxComment,
  upsertOutboxPrComment,
} from './comment.mjs';
import { adoptItem, parseSettledEntries, renderSettledEntry, settleItem } from './settle.mjs';

/** The markers every ported test below renders and parses through — `vertuo-outbox`, matching
 * `flatCtx`'s own configured prefix (`kit/test/flat-layout.mjs`). */
const markers = makeMarkers('vertuo-outbox');

/** A ctx with no real files behind it, for every test that only renders text or parses a marker —
 * none of them read `ctx.root`, only `ctx.markers`/`ctx.config`/`ctx.layout`'s pure `outboxDir`. A
 * test that touches disk builds its own `flatCtx(root)` off a real fixture root instead. */
const ctx = flatCtx('/outbox-comment-fixture');

/** Same, but with Slack notifications opted in — `ctx.config.notify.slack` non-null — for the
 * `maybeWriteSlackNote` cases ported from upstream, which all assume Slack is configured. */
const slackCtx = flatCtx('/outbox-comment-fixture', { notify: { slack: {} } });

function withFixtureRoot(run) {
  const root = mkdtempSync(join(tmpdir(), 'outbox-comment-'));
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** A minimal knowledge folder — one invariants file, empty of entries (`riskyChanges` reads the
    folder for every change, regardless of which rule is under test, and finds no proof path here). */
function seedInvariants(root) {
  mkdirSync(join(root, 'docs/knowledge/product'), { recursive: true });
  writeFileSync(join(root, 'docs/knowledge/product/invariants.md'), '');
}

function writeAccount(root, prd, slice, { graded = '2026-09-22', entries = [] } = {}) {
  const dir = join(root, 'docs/outbox', String(prd), 'accounts');
  mkdirSync(dir, { recursive: true });
  const lines = [
    '---',
    `prd: ${prd}`,
    `slice: ${slice}`,
    `graded: ${graded}`,
    '---',
    '',
    '## Risky changes',
    '',
  ];
  for (const entry of entries) {
    lines.push(`- \`${entry.path}\``, entry.rule, entry.account, '');
  }
  writeFileSync(join(dir, `${slice}.md`), lines.join('\n'));
}

function writeItem(
  root,
  prd,
  file,
  {
    id,
    rank = 'medium',
    bearsOn = 'none',
    wave = 1,
    questionPlain = 'Should this ship as it is?',
    decisionPlain = 'Yes, this is the fixture answer.',
    whatIHadToDecide = 'x',
  } = {},
) {
  const dir = join(root, 'docs/outbox', String(prd));
  mkdirSync(dir, { recursive: true });
  const text = [
    '---',
    `id: ${id}`,
    `prd: ${prd}`,
    `slice: ${id.split('-')[0]}`,
    `rank: ${rank}`,
    `bears-on: ${bearsOn}`,
    'raised: 2026-09-22',
    `wave: ${wave}`,
    '---',
    '',
    '## The question, in plain words',
    '',
    questionPlain,
    '',
    '## The decision, in plain words',
    '',
    decisionPlain,
    '',
    '## What I had to decide',
    '',
    whatIHadToDecide,
    '',
    '## What I did meanwhile',
    '',
    'y',
    '',
    '## What it costs to change later',
    '',
    'z',
    '',
    '## What I could not know',
    '',
    '(author) w',
    '',
  ].join('\n');
  writeFileSync(join(dir, file), text);
}

function item({ id, rank = 'medium', prd = 985, file }) {
  return { id, rank, prd, file: file ?? `docs/outbox/${prd}/${id}.md` };
}

describe('sortItems', () => {
  it('orders human-action, then high, then medium', () => {
    const items = [
      item({ id: 's2-01-a', rank: 'medium' }),
      item({ id: 's3-01-b', rank: 'high' }),
      item({ id: 's7-01-c', rank: 'human-action' }),
    ];
    expect(sortItems(items).map((i) => i.id)).toEqual(['s7-01-c', 's3-01-b', 's2-01-a']);
  });

  it('breaks ties on id, ascending', () => {
    const items = [item({ id: 's3-02-b', rank: 'high' }), item({ id: 's3-01-a', rank: 'high' })];
    expect(sortItems(items).map((i) => i.id)).toEqual(['s3-01-a', 's3-02-b']);
  });

  it('does not mutate its input', () => {
    const items = [item({ id: 'b', rank: 'medium' }), item({ id: 'a', rank: 'high' })];
    const copy = [...items];
    sortItems(items);
    expect(items).toEqual(copy);
  });
});

describe('formatOutboxComment', () => {
  const base = {
    prd: 985,
    owner: 'vertuoza',
    repo: 'vertuo-ai-domain',
    branch: 'feat/agent-outbox',
    ctx,
  };

  it('starts with the marker, exactly once', () => {
    const body = formatOutboxComment({ ...base, items: [] });
    expect(body.startsWith(markers.comment)).toBe(true);
    expect(body.split(markers.comment)).toHaveLength(2);
  });

  it('says there are no open items when the list is empty', () => {
    const body = formatOutboxComment({ ...base, items: [] });
    expect(body).toContain('No open items');
  });

  it('names unreworked drift and the fix command instead of "Nothing open" when nothing is open', () => {
    const body = formatOutboxComment({ ...base, items: [], unreworked: [{ id: 's1-01-x' }, { id: 's2-01-y' }] });
    expect(body).not.toContain('Nothing open');
    expect(body).toMatch(/s1-01-x, s2-01-y/);
    expect(body).toContain('/omni:yolo-fix');
  });

  it('lists every item with its rank and a link to the file on the branch', () => {
    const items = [
      item({ id: 's7-01-default-country', rank: 'high' }),
      item({ id: 's2-01-something', rank: 'medium' }),
    ];
    const body = formatOutboxComment({ ...base, items });
    expect(body).toContain('`high`');
    expect(body).toContain('`medium`');
    expect(body).toContain(
      'https://github.com/vertuoza/vertuo-ai-domain/blob/feat/agent-outbox/docs/outbox/985/s7-01-default-country.md',
    );
    expect(body).toContain(
      'https://github.com/vertuoza/vertuo-ai-domain/blob/feat/agent-outbox/docs/outbox/985/s2-01-something.md',
    );
  });

  it('lists the higher rank first', () => {
    const items = [
      item({ id: 's2-01-a', rank: 'medium' }),
      item({ id: 's7-01-b', rank: 'human-action' }),
    ];
    const body = formatOutboxComment({ ...base, items });
    expect(body.indexOf('s7-01-b')).toBeLessThan(body.indexOf('s2-01-a'));
  });

  it('produces exactly the same body as omitting `unaccounted` when there is none (PRD #1044 s5)', () => {
    const withDefault = formatOutboxComment({ ...base, items: [] });
    const withEmpty = formatOutboxComment({ ...base, items: [], unaccounted: [] });
    expect(withEmpty).toBe(withDefault);
  });

  it('lists an unaccounted change under the open items, with its path and the rule that flagged it (PRD #1044 s5)', () => {
    const items = [item({ id: 's7-01-default-country', rank: 'high' })];
    const unaccounted = [{ path: 'docs/adr/0099-example.md', status: 'M', rule: 'law-text' }];
    const body = formatOutboxComment({ ...base, items, unaccounted });

    // Still one comment.
    expect(body.split(markers.comment)).toHaveLength(2);
    // The open item is still there, in its usual shape.
    expect(body).toContain('`high`');
    expect(body).toContain('s7-01-default-country');
    // The unaccounted change is listed under it, naming its path and its rule.
    const itemAt = body.indexOf('s7-01-default-country');
    const unaccountedAt = body.indexOf('docs/adr/0099-example.md');
    expect(unaccountedAt).toBeGreaterThan(itemAt);
    expect(body).toContain('`law-text`');
    expect(body).toContain('`docs/adr/0099-example.md`');
  });

  it('names unaccounted changes even with no open item (PRD #1044 s5)', () => {
    const unaccounted = [{ path: 'docs/adr/0099-example.md', status: 'M', rule: 'law-text' }];
    const body = formatOutboxComment({ ...base, items: [], unaccounted });

    expect(body.split(markers.comment)).toHaveLength(2);
    expect(body).toContain('No open items');
    expect(body).toContain('`law-text`');
    expect(body).toContain('`docs/adr/0099-example.md`');
  });

  it('links each item to the given ref rather than the branch when one is given (PRD #1057 s1)', () => {
    const items = [item({ id: 's7-01-default-country', rank: 'high' })];
    const body = formatOutboxComment({ ...base, ref: 'abc1234', items });
    expect(body).toContain(
      'https://github.com/vertuoza/vertuo-ai-domain/blob/abc1234/docs/outbox/985/s7-01-default-country.md',
    );
    expect(body).not.toContain(`/blob/${base.branch}/`);
  });

  it('falls back to the branch for links when no ref is given (PRD #1057 s1)', () => {
    const items = [item({ id: 's7-01-default-country', rank: 'high' })];
    const body = formatOutboxComment({ ...base, items });
    expect(body).toContain(
      `https://github.com/vertuoza/vertuo-ai-domain/blob/${base.branch}/docs/outbox/985/s7-01-default-country.md`,
    );
  });

  it('says items were waved through with omni:outbox-go when the label is present and an item is open (PRD #1057 s1)', () => {
    const items = [item({ id: 's7-01-default-country', rank: 'high' })];
    const body = formatOutboxComment({ ...base, items, labels: ['omni:outbox-go', 'omni:sub'] });
    expect(body).toMatch(/waved through/i);
    expect(body).toContain('omni:outbox-go');
  });

  it('says nothing about waving through without the omni:outbox-go label', () => {
    const items = [item({ id: 's7-01-default-country', rank: 'high' })];
    const body = formatOutboxComment({ ...base, items, labels: ['omni:sub'] });
    expect(body).not.toMatch(/waved through/i);
  });

  it('says nothing about waving through when omni:outbox-go is present but nothing is open', () => {
    const body = formatOutboxComment({ ...base, items: [], labels: ['omni:outbox-go'] });
    expect(body).not.toMatch(/waved through/i);
  });

  it('carries the announced-keys marker naming every item id, sorted (PRD #1057 s1)', () => {
    const items = [item({ id: 's7-01-b', rank: 'high' }), item({ id: 's2-01-a', rank: 'medium' })];
    const body = formatOutboxComment({ ...base, items });
    expect(body).toContain(`${markers.announcedPrefix}s2-01-a,s7-01-b -->`);
  });

  it('carries the announced-keys marker naming unaccounted changes as rule:path, sorted with item ids', () => {
    const items = [item({ id: 's7-01-b', rank: 'high' })];
    const unaccounted = [{ path: 'docs/adr/0099-example.md', status: 'M', rule: 'law-text' }];
    const body = formatOutboxComment({ ...base, items, unaccounted });
    const keys = parseAnnouncedMarker(body, markers);
    expect(keys.sort()).toEqual(['law-text:docs/adr/0099-example.md', 's7-01-b'].sort());
  });

  it('the announced-keys marker round-trips through parseAnnouncedMarker', () => {
    const items = [item({ id: 's7-01-b', rank: 'high' }), item({ id: 's2-01-a', rank: 'medium' })];
    const unaccounted = [{ path: 'docs/adr/0099-example.md', status: 'M', rule: 'law-text' }];
    const body = formatOutboxComment({ ...base, items, unaccounted });
    expect(parseAnnouncedMarker(body, markers)).toEqual(
      announcedKeys({ items: sortItems(items), unaccounted }),
    );
  });

  it('the announced-keys marker is empty (but present) when nothing is listed', () => {
    const body = formatOutboxComment({ ...base, items: [] });
    expect(parseAnnouncedMarker(body, markers)).toEqual([]);
    expect(body).toContain(`${markers.announcedPrefix} -->`);
  });
});

describe('parseNameStatus (PRD #1044 s5)', () => {
  it('parses `git diff --name-status` output into { status, path } entries', () => {
    const text = ['M\tdocs/adr/0099-example.md', 'D\tscripts/old.test.mjs', ''].join('\n');
    expect(parseNameStatus(text)).toEqual([
      { status: 'M', path: 'docs/adr/0099-example.md' },
      { status: 'D', path: 'scripts/old.test.mjs' },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseNameStatus('')).toEqual([]);
    expect(parseNameStatus('\n')).toEqual([]);
  });
});

describe('unaccountedChanges (PRD #1044 s5)', () => {
  it('is empty when nothing in the range is risky', () => {
    withFixtureRoot((root) => {
      seedInvariants(root);
      const changes = [{ path: 'scripts/ordinary.mjs', status: 'M' }];
      expect(unaccountedChanges(985, changes, { ctx: flatCtx(root) })).toEqual([]);
    });
  });

  it('lists a risky change no account names', () => {
    withFixtureRoot((root) => {
      seedInvariants(root);
      const changes = [{ path: 'docs/adr/0099-example.md', status: 'M' }];
      const result = unaccountedChanges(985, changes, { ctx: flatCtx(root) });
      expect(result).toEqual([{ path: 'docs/adr/0099-example.md', status: 'M', rule: 'law-text' }]);
    });
  });

  it('excludes a risky change an account names', () => {
    withFixtureRoot((root) => {
      seedInvariants(root);
      writeAccount(root, 985, 's5', {
        entries: [
          {
            path: 'docs/adr/0099-example.md',
            rule: 'law-text',
            account: 'spec docs/inbox/1044-decision-coverage.md#example',
          },
        ],
      });
      const changes = [{ path: 'docs/adr/0099-example.md', status: 'M' }];
      expect(unaccountedChanges(985, changes, { ctx: flatCtx(root) })).toEqual([]);
    });
  });
});

describe('findMarkerComment', () => {
  it('finds the comment carrying the marker among others', () => {
    const comments = [
      { id: 1, body: 'unrelated comment' },
      { id: 2, body: `${markers.comment}\nold outbox body` },
      { id: 3, body: 'another comment' },
    ];
    expect(findMarkerComment(comments, markers)?.id).toBe(2);
  });

  it('returns null when no comment carries the marker', () => {
    const comments = [{ id: 1, body: 'unrelated' }];
    expect(findMarkerComment(comments, markers)).toBeNull();
  });

  it('returns null for an empty or missing comment list', () => {
    expect(findMarkerComment([], markers)).toBeNull();
    expect(findMarkerComment(undefined, markers)).toBeNull();
  });
});

describe('openItemsForPrd', () => {
  it('reads only items under the given PRD, skipping settled.md and other PRDs', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      writeItem(root, 111, 's1-01-other-prd.md', { id: 's1-01-other-prd' });
      mkdirSync(join(root, 'docs/outbox/985'), { recursive: true });
      writeFileSync(join(root, 'docs/outbox/985/settled.md'), '# settled\n');

      const items = openItemsForPrd(985, { ctx: flatCtx(root) });
      expect(items.map((i) => i.id).sort()).toEqual(['s2-01-a', 's3-01-b']);
    });
  });

  it('returns an empty list when the PRD has no open items', () => {
    withFixtureRoot((root) => {
      expect(openItemsForPrd(985, { ctx: flatCtx(root) })).toEqual([]);
    });
  });
});

function fakeClient(initialComments = []) {
  const comments = [...initialComments];
  let nextId = comments.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  return {
    comments,
    listComments: vi.fn(() => [...comments]),
    createComment: vi.fn((body) => {
      const created = {
        id: nextId++,
        body,
        html_url: `https://github.com/o/r/issues/985#issuecomment-${nextId}`,
      };
      comments.push(created);
      return created;
    }),
    updateComment: vi.fn((id, body) => {
      const found = comments.find((c) => c.id === id);
      if (found) {
        found.body = body;
        found.html_url ??= `https://github.com/o/r/issues/985#issuecomment-${id}`;
      }
      return found;
    }),
  };
}

describe('upsertOutboxComment', () => {
  const args = {
    prd: 985,
    owner: 'vertuoza',
    repo: 'vertuo-ai-domain',
    branch: 'feat/agent-outbox',
  };

  it('creates the comment when none carries the marker yet', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();

      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(client.createComment).toHaveBeenCalledTimes(1);
      expect(client.updateComment).not.toHaveBeenCalled();
      expect(result.action).toBe('created');
      expect(client.comments).toHaveLength(1);
      expect(client.comments[0].body).toContain(markers.comment);
    });
  });

  it('rewrites the existing outbox comment in place instead of appending', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient([
        { id: 42, body: `${markers.comment}\nstale body` },
        { id: 43, body: 'a human reply, unrelated' },
      ]);

      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(client.updateComment).toHaveBeenCalledTimes(1);
      expect(client.updateComment).toHaveBeenCalledWith(
        42,
        expect.stringContaining(markers.comment),
      );
      expect(client.createComment).not.toHaveBeenCalled();
      expect(result.action).toBe('updated');
      expect(result.id).toBe(42);
      // The unrelated human comment is left alone.
      expect(client.comments).toHaveLength(2);
      expect(client.comments.find((c) => c.id === 43).body).toBe('a human reply, unrelated');
    });
  });

  it('running the writer twice leaves exactly one outbox comment, listing every item raised across both waves', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();

      const first = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(client.comments).toHaveLength(1);

      // Second wave raises a new item.
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      const second = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(client.comments).toHaveLength(1);
      expect(second.action).toBe('updated');
      expect(second.id).toBe(first.id);
      const body = client.comments[0].body;
      expect(body).toContain('s2-01-a');
      expect(body).toContain('s3-01-b');
      expect(body.split(markers.comment)).toHaveLength(2);
    });
  });

  it('an item settled between two runs disappears from the comment', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      const client = fakeClient();

      upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(client.comments[0].body).toContain('s2-01-a');
      expect(client.comments[0].body).toContain('s3-01-b');

      // s2-01-a settles: its open file is removed (moved into settled.md, s5's job).
      rmSync(join(root, 'docs/outbox/985/s2-01-a.md'));

      upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(client.comments).toHaveLength(1);
      expect(client.comments[0].body).not.toContain('s2-01-a');
      expect(client.comments[0].body).toContain('s3-01-b');
    });
  });

  it('skips — no create call — when no marker comment exists and nothing is listed', () => {
    withFixtureRoot((root) => {
      const client = fakeClient();
      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(client.createComment).not.toHaveBeenCalled();
      expect(client.updateComment).not.toHaveBeenCalled();
      expect(client.comments).toHaveLength(0);
      expect(result.action).toBe('skipped');
      expect(result.id).toBeNull();
      expect(result.itemCount).toBe(0);
      expect(result.newCount).toBe(0);
    });
  });

  it('still updates an existing marker comment down to "nothing open" when a run clears the last item', () => {
    withFixtureRoot((root) => {
      const client = fakeClient([{ id: 42, body: `${markers.comment}\nstale body` }]);
      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(client.updateComment).toHaveBeenCalledTimes(1);
      expect(client.createComment).not.toHaveBeenCalled();
      expect(result.action).toBe('updated');
      expect(client.comments[0].body).toContain('No open items');
    });
  });

  it('one open item and one unaccounted change produce one comment carrying both, the change under the item (PRD #1044 s5)', () => {
    withFixtureRoot((root) => {
      seedInvariants(root);
      writeItem(root, 985, 's7-01-default-country.md', {
        id: 's7-01-default-country',
        rank: 'high',
      });
      const client = fakeClient();
      const changes = [{ path: 'docs/adr/0099-example.md', status: 'M' }];

      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root), changes }, client);

      expect(client.comments).toHaveLength(1);
      expect(client.comments[0].body.split(markers.comment)).toHaveLength(2);
      const body = client.comments[0].body;
      expect(body).toContain('s7-01-default-country');
      expect(body).toContain('`docs/adr/0099-example.md`');
      expect(body).toContain('`law-text`');
      expect(body.indexOf('s7-01-default-country')).toBeLessThan(
        body.indexOf('docs/adr/0099-example.md'),
      );
      expect(result.unaccountedCount).toBe(1);
    });
  });

  it('a PRD with neither an open item nor an unaccounted change is skipped, not created (PRD #1044 s5, PRD #1057 s1)', () => {
    withFixtureRoot((root) => {
      seedInvariants(root);
      const client = fakeClient();

      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(client.createComment).not.toHaveBeenCalled();
      expect(result.action).toBe('skipped');
      expect(result.itemCount).toBe(0);
      expect(result.unaccountedCount).toBe(0);
    });
  });

  it('unaccounted changes with no open item still produce one comment naming them (PRD #1044 s5)', () => {
    withFixtureRoot((root) => {
      seedInvariants(root);
      const client = fakeClient();
      const changes = [{ path: 'docs/adr/0099-example.md', status: 'M' }];

      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root), changes }, client);

      expect(client.comments).toHaveLength(1);
      const body = client.comments[0].body;
      expect(body).toContain('No open items');
      expect(body).toContain('`docs/adr/0099-example.md`');
      expect(body).toContain('`law-text`');
      expect(result.itemCount).toBe(0);
      expect(result.unaccountedCount).toBe(1);
    });
  });

  it('news is every key when the comment is created (PRD #1057 s1)', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      const client = fakeClient();

      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(result.action).toBe('created');
      expect(result.newCount).toBe(2);
    });
  });

  it('news is silent on an unchanged set (PRD #1057 s1)', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();

      upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      const second = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(second.action).toBe('updated');
      expect(second.newCount).toBe(0);
    });
  });

  it('news counts only the newly-appeared key when a second wave raises one more item (PRD #1057 s1)', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();

      upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      const second = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(second.action).toBe('updated');
      expect(second.newCount).toBe(1);
    });
  });

  it('an item settling between runs is not counted as news', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      const client = fakeClient();

      upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      rmSync(join(root, 'docs/outbox/985/s2-01-a.md'));
      const second = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);

      expect(second.newCount).toBe(0);
    });
  });

  it('reports the comment html_url from the create response', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();
      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(result.htmlUrl).toBe(client.comments[0].html_url);
      expect(result.htmlUrl).toContain('issuecomment');
    });
  });

  it('reports the comment html_url from the update response', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient([
        { id: 42, body: `${markers.comment}\nstale`, html_url: 'https://x/42' },
      ]);
      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(result.htmlUrl).toBe('https://x/42');
    });
  });

  it('reports counts by rank for the Slack line to consume', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      writeItem(root, 985, 's4-01-c.md', { id: 's4-01-c', rank: 'medium' });
      const client = fakeClient();
      const result = upsertOutboxComment({ ...args, ctx: flatCtx(root) }, client);
      expect(result.counts).toEqual({ high: 1, medium: 2 });
    });
  });
});

describe('countsByRank', () => {
  it('tallies items by rank', () => {
    const items = [
      item({ id: 'a', rank: 'high' }),
      item({ id: 'b', rank: 'medium' }),
      item({ id: 'c', rank: 'high' }),
    ];
    expect(countsByRank(items)).toEqual({ high: 2, medium: 1 });
  });

  it('is empty for no items', () => {
    expect(countsByRank([])).toEqual({});
  });
});

const PR_COMMENT_URL = 'https://github.com/o/r/pull/1120#issuecomment-7';
const ISSUE_COMMENT_URL = 'https://github.com/o/r/issues/778#issuecomment-3';

describe('slackLine (PRD #1166 s7)', () => {
  const base = {
    prd: 778,
    title: 'PRD: Quote line components',
    owner: { slackId: 'U123' },
    counts: {},
    adoptedCount: 0,
    unaccountedCount: 0,
    newCount: 1,
    url: PR_COMMENT_URL,
  };

  it('Scenario: The note names the PRD title and mentions its owner', () => {
    const line = slackLine({ ...base, counts: { high: 2 } });
    const [head, , link] = line.split('\n');
    expect(head).toBe('*PRD #778 · Quote line components* — owner <@U123>');
    expect(link).toBe(`<${PR_COMMENT_URL}|Answer on pull request #1120 →>`);
  });

  it('Scenario: An owner Slack does not know is named by their GitHub handle', () => {
    const line = slackLine({ ...base, owner: { login: 'pierrederval' }, counts: { high: 1 } });
    expect(line.split('\n')[0]).toBe('*PRD #778 · Quote line components* — owner @pierrederval');
    expect(line).not.toContain('<@');
  });

  it('Scenario: Adopted items are not counted as waiting', () => {
    const line = slackLine({ ...base, counts: { high: 2 }, adoptedCount: 4 });
    expect(line.split('\n')[1]).toBe(
      '2 questions need a decision · 4 adopted unless someone objects',
    );
  });

  it('reads the example off the spec, line for line', () => {
    const line = slackLine({
      ...base,
      counts: { 'human-action': 1, high: 1 },
      adoptedCount: 4,
      unaccountedCount: 1,
    });
    expect(line).toBe(
      [
        '*PRD #778 · Quote line components* — owner <@U123>',
        '2 questions need a decision · 4 adopted unless someone objects · 1 unaccounted change',
        `<${PR_COMMENT_URL}|Answer on pull request #1120 →>`,
      ].join('\n'),
    );
  });

  it('speaks in the singular for one of each', () => {
    const line = slackLine({ ...base, counts: { high: 1 }, adoptedCount: 1, unaccountedCount: 1 });
    expect(line.split('\n')[1]).toBe(
      '1 question needs a decision · 1 adopted unless someone objects · 1 unaccounted change',
    );
  });

  it('pluralises the unaccounted changes', () => {
    const line = slackLine({ ...base, unaccountedCount: 2 });
    expect(line.split('\n')[1]).toBe('2 unaccounted changes');
  });

  it('leaves every zero count out', () => {
    const line = slackLine({ ...base, adoptedCount: 3 });
    expect(line.split('\n')[1]).toBe('3 adopted unless someone objects');
    expect(line.split('\n')[1]).not.toMatch(/\b0 /);
  });

  it('says nothing needs a decision when every count is zero', () => {
    expect(slackLine(base).split('\n')[1]).toBe('Nothing needs a decision');
  });

  it('never counts an adopted item as waiting, nor a still-open medium one as adopted', () => {
    // A medium item raised before PRD #1166 s5 may still sit as an open file: it is open, so it
    // needs a decision like any other open item; only the settled ledger's adopted entries are
    // "adopted".
    const line = slackLine({ ...base, counts: { medium: 1 }, adoptedCount: 2 });
    expect(line.split('\n')[1]).toBe(
      '1 question needs a decision · 2 adopted unless someone objects',
    );
  });

  it('strips only a leading "PRD:" from the title', () => {
    const line = slackLine({ ...base, title: 'prd:  Why a PRD: matters' });
    expect(line.split('\n')[0]).toContain('*PRD #778 · Why a PRD: matters*');
  });

  it('escapes the characters Slack reads as markup in the title and the handle', () => {
    const line = slackLine({ ...base, title: 'Costs <b> & margins', owner: { login: 'a<b>' } });
    expect(line.split('\n')[0]).toBe(
      '*PRD #778 · Costs &lt;b&gt; &amp; margins* — owner @a&lt;b&gt;',
    );
  });

  it('names the PRD alone when there is no title, and leaves the owner off when there is none', () => {
    const line = slackLine({ ...base, title: '', owner: null });
    expect(line.split('\n')[0]).toBe('*PRD #778*');
  });

  it('falls back to the handle when the Slack id is empty', () => {
    const line = slackLine({ ...base, owner: { slackId: '', login: 'pierrederval' } });
    expect(line.split('\n')[0]).toContain('— owner @pierrederval');
  });

  it('links to the PRD issue comment when the pull request comment does not exist yet', () => {
    const line = slackLine({ ...base, url: ISSUE_COMMENT_URL });
    expect(line.split('\n')[2]).toBe(`<${ISSUE_COMMENT_URL}|Answer on the PRD issue →>`);
  });

  it('has no link line when there is no url at all', () => {
    const line = slackLine({ ...base, url: null });
    expect(line.split('\n')).toHaveLength(2);
    expect(line).not.toContain('null');
  });

  it('is a pure function — same input, same output', () => {
    const args = { ...base, counts: { high: 1 } };
    expect(slackLine(args)).toBe(slackLine({ ...args }));
  });
});

describe('slackOwner (PRD #1166 s7)', () => {
  it('is a Slack mention when the lookup found a user id', () => {
    expect(slackOwner({ slackId: 'U0ABC123', login: 'pierrederval' })).toEqual({
      slackId: 'U0ABC123',
    });
  });

  it('falls back to the GitHub handle when the lookup found nothing', () => {
    expect(slackOwner({ slackId: '', login: 'pierrederval' })).toEqual({ login: 'pierrederval' });
    expect(slackOwner({ slackId: null, login: 'pierrederval' })).toEqual({
      login: 'pierrederval',
    });
  });

  it('never trusts a value that is not the shape of a Slack user id', () => {
    expect(slackOwner({ slackId: 'null', login: 'pierrederval' })).toEqual({
      login: 'pierrederval',
    });
    expect(slackOwner({ slackId: '<!channel>', login: 'pierrederval' })).toEqual({
      login: 'pierrederval',
    });
  });

  it('is nobody when neither is known', () => {
    expect(slackOwner({ slackId: '', login: '' })).toBeNull();
    expect(slackOwner({})).toBeNull();
  });
});

describe('maybeWriteSlackNote', () => {
  const result = (overrides = {}) => ({
    counts: { high: 1 },
    adoptedCount: 0,
    unaccountedCount: 0,
    newCount: 1,
    htmlUrl: ISSUE_COMMENT_URL,
    ...overrides,
  });

  it('writes the slack line to the given path when there is news', () => {
    const write = vi.fn();
    maybeWriteSlackNote({
      ctx: slackCtx,
      prd: 778,
      title: 'Quote line components',
      owner: { slackId: 'U123' },
      result: result(),
      path: '/tmp/note.txt',
      write,
    });
    expect(write).toHaveBeenCalledTimes(1);
    const [path, contents] = write.mock.calls[0];
    expect(path).toBe('/tmp/note.txt');
    expect(contents).toContain('*PRD #778 · Quote line components* — owner <@U123>');
    expect(contents.endsWith('\n')).toBe(true);
  });

  it('links to the pull request comment when the pull request step left one', () => {
    const write = vi.fn();
    maybeWriteSlackNote({
      ctx: slackCtx,
      prd: 778,
      result: result(),
      prComment: { htmlUrl: PR_COMMENT_URL, newAdoptedCount: 0 },
      path: '/tmp/note.txt',
      write,
    });
    expect(write.mock.calls[0][1]).toContain(`<${PR_COMMENT_URL}|Answer on pull request #1120 →>`);
  });

  it('falls back to the PRD issue comment when the pull request comment has no url', () => {
    const write = vi.fn();
    maybeWriteSlackNote({
      ctx: slackCtx,
      prd: 778,
      result: result(),
      prComment: { htmlUrl: null, newAdoptedCount: 0 },
      path: '/tmp/note.txt',
      write,
    });
    expect(write.mock.calls[0][1]).toContain(`<${ISSUE_COMMENT_URL}|Answer on the PRD issue →>`);
  });

  it('counts the adopted items the PRD issue reader found', () => {
    const write = vi.fn();
    maybeWriteSlackNote({
      ctx: slackCtx,
      prd: 778,
      result: result({ counts: { high: 2 }, adoptedCount: 4 }),
      path: '/tmp/note.txt',
      write,
    });
    expect(write.mock.calls[0][1]).toContain(
      '2 questions need a decision · 4 adopted unless someone objects',
    );
  });

  it('treats a newly adopted item as news, even when nothing else changed', () => {
    const write = vi.fn();
    maybeWriteSlackNote({
      ctx: slackCtx,
      prd: 778,
      result: result({ counts: {}, adoptedCount: 1, newCount: 0, htmlUrl: null }),
      prComment: { htmlUrl: PR_COMMENT_URL, newAdoptedCount: 1 },
      path: '/tmp/note.txt',
      write,
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][1]).toContain('1 adopted unless someone objects');
  });

  it('writes nothing when there is no news', () => {
    const write = vi.fn();
    maybeWriteSlackNote({
      ctx: slackCtx,
      prd: 778,
      result: result({ newCount: 0, adoptedCount: 3 }),
      prComment: { htmlUrl: PR_COMMENT_URL, newAdoptedCount: 0 },
      path: '/tmp/note.txt',
      write,
    });
    expect(write).not.toHaveBeenCalled();
  });

  it('writes nothing when no path is given', () => {
    const write = vi.fn();
    maybeWriteSlackNote({ ctx: slackCtx, prd: 778, result: result(), path: null, write });
    expect(write).not.toHaveBeenCalled();
  });

  it('writes nothing when the repository has not opted in to Slack notifications (notify.slack is null)', () => {
    withFixtureRoot((root) => {
      const path = join(root, 'note.txt');
      maybeWriteSlackNote({
        ctx: flatCtx(root),
        prd: 778,
        title: 'Quote line components',
        owner: { slackId: 'U123' },
        result: result(),
        path,
      });
      expect(existsSync(path)).toBe(false);
    });
  });
});

describe('readPrCommentResult (PRD #1166 s7)', () => {
  it('reads what the pull request step left behind', () => {
    withFixtureRoot((root) => {
      const file = join(root, 'pr.json');
      writeFileSync(file, JSON.stringify({ htmlUrl: PR_COMMENT_URL, newAdoptedCount: 2 }));
      expect(readPrCommentResult(file)).toEqual({ htmlUrl: PR_COMMENT_URL, newAdoptedCount: 2 });
    });
  });

  it('is null when the step left nothing, or something unreadable — the note still goes out', () => {
    withFixtureRoot((root) => {
      expect(readPrCommentResult(join(root, 'absent.json'))).toBeNull();
      const file = join(root, 'broken.json');
      writeFileSync(file, 'not json');
      expect(readPrCommentResult(file)).toBeNull();
      expect(readPrCommentResult(null)).toBeNull();
    });
  });
});

// ---- The pull request comment (PRD #1071, slice s2) ----

/** A pre-s1 item, with neither plain section — the shape a settled entry written before PRD #1071
 * still embeds, forever, because `settled.md` is append-only. */
function writeLegacyItem(root, prd, file, { id, rank = 'medium', whatIHadToDecide = 'x' } = {}) {
  const dir = join(root, 'docs/outbox', String(prd));
  mkdirSync(dir, { recursive: true });
  const text = [
    '---',
    `id: ${id}`,
    `prd: ${prd}`,
    `slice: ${id.split('-')[0]}`,
    `rank: ${rank}`,
    'bears-on: none',
    'raised: 2026-09-22',
    'wave: 1',
    '---',
    '',
    '## What I had to decide',
    '',
    whatIHadToDecide,
    '',
    '## What I did meanwhile',
    '',
    'y',
    '',
    '## What it costs to change later',
    '',
    'z',
    '',
    '## What I could not know',
    '',
    '(author) w',
    '',
  ].join('\n');
  writeFileSync(join(dir, file), text);
}

/** Settles `file` (relative to `root`) through the real `settleItem` — a realistic `settled.md`
 * fixture, produced the same way `/omni:yolo-fix` produces one, rather than hand-typed markdown
 * this test would have to keep in sync with the ledger's own format by hand. */
function settle(
  root,
  file,
  { text = 'ok', by = 'pierrederval', at = '2026-09-23T13:00:00Z' } = {},
) {
  const result = settleItem({
    ctx: flatCtx(root),
    file,
    answer: {
      text,
      approvedBy: by,
      approvedAt: at,
      channel: { kind: 'feature-pull-request', number: 986 },
      statedVerdict: /no\b/i.test(text) ? 'drifted' : 'agreed',
    },
  });
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
}

/** `settled.md` for `prd`, read back through the ledger's own reader — never hand-parsed. */
function parseSettledOf(root, prd) {
  const path = join(root, 'docs/outbox', String(prd), 'settled.md');
  return parseSettledEntries(readFileSync(path, 'utf8'), markers);
}

describe('findPrMarkerComment', () => {
  it('finds the comment carrying PR_MARKER among others, including the PRD-issue one', () => {
    const comments = [
      { id: 1, body: `${markers.comment}\nPRD issue comment` },
      { id: 2, body: `${markers.prComment}\npull request comment` },
      { id: 3, body: 'a human reply' },
    ];
    expect(findPrMarkerComment(comments, markers)?.id).toBe(2);
  });

  it('returns null when no comment carries PR_MARKER', () => {
    expect(findPrMarkerComment([{ id: 1, body: `${markers.comment}\nold` }], markers)).toBeNull();
  });

  it('never confuses PR_MARKER with MARKER — neither is a substring of the other', () => {
    expect(markers.prComment.includes(markers.comment)).toBe(false);
    expect(markers.comment.includes(markers.prComment)).toBe(false);
  });
});

describe('formatNumbersMarker / parseNumbersMarker', () => {
  it('round-trips a numbering', () => {
    const numbering = [
      { number: 1, id: 's2-01-a', since: '2026-09-23T10:00:00.000Z' },
      { number: 2, id: 's3-01-b', since: '2026-09-23T10:00:01.000Z' },
    ];
    const marker = formatNumbersMarker(numbering, markers);
    expect(marker).toBe(
      `${markers.numbersPrefix}1=s2-01-a@2026-09-23T10:00:00.000Z,2=s3-01-b@2026-09-23T10:00:01.000Z -->`,
    );
    expect(parseNumbersMarker(marker, markers)).toEqual(numbering);
  });

  it('parses an empty marker as no numbering', () => {
    expect(parseNumbersMarker(formatNumbersMarker([], markers), markers)).toEqual([]);
  });

  it('returns [] for a body carrying no marker at all', () => {
    expect(parseNumbersMarker('nothing here', markers)).toEqual([]);
    expect(parseNumbersMarker(undefined, markers)).toEqual([]);
  });

  it('formats sorted by number regardless of input order', () => {
    const numbering = [
      { number: 2, id: 'b', since: '2026-09-23T10:00:01.000Z' },
      { number: 1, id: 'a', since: '2026-09-23T10:00:00.000Z' },
    ];
    expect(formatNumbersMarker(numbering, markers)).toBe(
      `${markers.numbersPrefix}1=a@2026-09-23T10:00:00.000Z,2=b@2026-09-23T10:00:01.000Z -->`,
    );
  });
});

describe('assignNumbers', () => {
  it('numbers a fresh set worst-first, starting at 1', () => {
    const items = [
      item({ id: 's2-01-a', rank: 'medium' }),
      item({ id: 's3-01-b', rank: 'high' }),
      item({ id: 's7-01-c', rank: 'human-action' }),
    ];
    const numbering = assignNumbers({ items, now: () => '2026-09-23T00:00:00.000Z' });
    expect(numbering.map((e) => [e.number, e.id])).toEqual([
      [1, 's7-01-c'],
      [2, 's3-01-b'],
      [3, 's2-01-a'],
    ]);
  });

  it('keeps an already-numbered item at its number, in place', () => {
    const previous = [{ number: 1, id: 's2-01-a', since: '2026-09-22T00:00:00.000Z' }];
    const items = [item({ id: 's2-01-a', rank: 'medium' })];
    const numbering = assignNumbers({ items, previous });
    expect(numbering).toEqual(previous);
  });

  it('gives a new item the next number after the previous max — never a freed one', () => {
    const previous = [
      { number: 1, id: 's2-01-a', since: '2026-09-22T00:00:00.000Z' },
      { number: 2, id: 's3-01-b', since: '2026-09-22T00:00:01.000Z' },
    ];
    // s2-01-a has since settled and is no longer open — its number still is not reused.
    const items = [item({ id: 's3-01-b' }), item({ id: 's9-01-c' })];
    const numbering = assignNumbers({ items, previous, now: () => '2026-09-23T00:00:00.000Z' });
    expect(numbering).toEqual([
      ...previous,
      { number: 3, id: 's9-01-c', since: '2026-09-23T00:00:00.000Z' },
    ]);
  });

  it('does not mutate previous', () => {
    const previous = [{ number: 1, id: 'a', since: 't' }];
    const copy = [...previous];
    assignNumbers({ items: [item({ id: 'a' }), item({ id: 'b' })], previous });
    expect(previous).toEqual(copy);
  });
});

describe('parseRoundMarkers', () => {
  it('reads the round number and the question numbers it re-asks', () => {
    const comments = [
      { id: 1, body: `${markers.prComment}\nmain comment` },
      { id: 2, body: `${markers.round(2, [1, 3])}\nOutbox round 2` },
    ];
    const rounds = parseRoundMarkers(comments, markers);
    expect(rounds.get(1)).toBe(2);
    expect(rounds.get(3)).toBe(2);
    expect(rounds.has(2)).toBe(false);
  });

  it('keeps the higher round when a number is re-asked more than once', () => {
    const comments = [
      { id: 1, body: `${markers.round(2, [1])}\nround 2` },
      { id: 2, body: `${markers.round(3, [1])}\nround 3` },
    ];
    expect(parseRoundMarkers(comments, markers).get(1)).toBe(3);
  });

  it('ignores comments with no round marker', () => {
    expect(parseRoundMarkers([{ id: 1, body: 'just a reply' }], markers)).toEqual(new Map());
    expect(parseRoundMarkers([], markers)).toEqual(new Map());
    expect(parseRoundMarkers(undefined, markers)).toEqual(new Map());
  });
});

describe('answeredOutcome', () => {
  it('reads "kept as built" for an agreed verdict', () => {
    expect(answeredOutcome({ verdict: 'agreed', closed: true, fields: {} })).toBe('kept as built');
  });

  it('reads "to be reworked" for a drifted, still-open verdict', () => {
    expect(
      answeredOutcome({ verdict: 'drifted', closed: false, fields: { Closed: 'no — …' } }),
    ).toBe('to be reworked');
  });

  it('reads "reworked in #N" for a drifted verdict a rework sub-pull request already closed', () => {
    expect(
      answeredOutcome({
        verdict: 'drifted',
        closed: true,
        fields: { Closed: 'yes — reworked by #1090, the sub-pull request that brought it back' },
      }),
    ).toBe('reworked in #1090');
  });
});

describe('answeredQuestionText', () => {
  it('uses the embedded item’s plain question when it has one', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', {
        id: 's2-01-a',
        questionPlain: 'Should we ship the new page as it is?',
      });
      settle(root, 'docs/outbox/985/s2-01-a.md');
      const [entry] = parseSettledOf(root, 985);
      expect(answeredQuestionText(entry)).toBe('Should we ship the new page as it is?');
    });
  });

  it('falls back to the first sentence of "What I had to decide" for a pre-s1 item', () => {
    withFixtureRoot((root) => {
      writeLegacyItem(root, 985, 's2-01-a.md', {
        id: 's2-01-a',
        whatIHadToDecide: 'The picker only sees the newest few. It could not reach the older ones.',
      });
      settle(root, 'docs/outbox/985/s2-01-a.md');
      const [entry] = parseSettledOf(root, 985);
      expect(answeredQuestionText(entry)).toBe('The picker only sees the newest few.');
    });
  });
});

describe('formatOutboxPrComment', () => {
  const numbering = [
    { number: 1, id: 's7-01-c', since: '2026-09-23T00:00:00.000Z' },
    { number: 2, id: 's3-01-b', since: '2026-09-23T00:00:00.000Z' },
    { number: 3, id: 's2-01-a', since: '2026-09-23T00:00:00.000Z' },
  ];

  it('starts with PR_MARKER, exactly once', () => {
    const body = formatOutboxPrComment({ items: [], numbering: [], ctx });
    expect(body.startsWith(markers.prComment)).toBe(true);
    expect(body.split(markers.prComment)).toHaveLength(2);
  });

  it('asks every open question in plain words, most urgent first (Scenario: worst-first)', () => {
    const items = [
      item({ id: 's2-01-a', rank: 'medium', prd: 985 }),
      item({ id: 's3-01-b', rank: 'high', prd: 985 }),
      item({ id: 's7-01-c', rank: 'human-action', prd: 985 }),
    ].map((base) => ({
      ...base,
      sections: {
        questionPlain: `Question text for ${base.id}`,
        decisionPlain: `Decision text for ${base.id}`,
      },
    }));

    const body = formatOutboxPrComment({ items, numbering, ctx });

    expect(body).toContain('**3 questions need your decision**');
    expect(body).toContain('go with recommendation');
    expect(body).toContain('/omni:yolo-fix');

    // Needs-a-person first, medium last.
    const at = (needle) => body.indexOf(needle);
    expect(at('Question 1')).toBeGreaterThan(-1);
    expect(at('Question 1')).toBeLessThan(at('Question 2'));
    expect(at('Question 2')).toBeLessThan(at('Question 3'));
    expect(body).toContain('### Question 1 · human-action — needs a person');
    expect(body).toContain('### Question 2 · high — needs your decision');
    expect(body).toContain('### Question 3 · medium — needs your decision');

    // Each shows its decision and how to answer it, under its own number.
    expect(body).toContain('Question text for s7-01-c');
    expect(body).toContain('**Decision taken:** Decision text for s7-01-c');
    expect(body).toContain('Reply `1: ok` to keep it, or `1: no, because …`');
    expect(body).toContain('Reply `3: ok` to keep it, or `3: no, because …`');
  });

  it('says "1 question needs your decision" for exactly one', () => {
    const items = [
      {
        ...item({ id: 's2-01-a', rank: 'medium' }),
        sections: { questionPlain: 'q', decisionPlain: 'd' },
      },
    ];
    const body = formatOutboxPrComment({
      items,
      numbering: [{ number: 1, id: 's2-01-a', since: 't' }],
      ctx,
    });
    expect(body).toContain('**1 question needs your decision**');
  });

  it('says "No open items." when nothing is open and nothing is answered', () => {
    const body = formatOutboxPrComment({ items: [], numbering: [], ctx });
    expect(body).toContain('No open items.');
  });

  it('says "Every question is answered" once every question is settled (Scenario: the comment stays as the record)', () => {
    const answered = [
      {
        id: 's2-01-a',
        verdict: 'agreed',
        closed: true,
        fields: {
          'Approved by': 'pierrederval',
          'Approved at': '2026-09-23T13:55:56Z',
          Closed: 'yes',
        },
        answerText: 'approve all',
        itemText: [
          '---',
          'id: s2-01-a',
          'prd: 985',
          'slice: s2',
          'rank: medium',
          'bears-on: none',
          'raised: 2026-09-22',
          'wave: 1',
          '---',
          '',
          '## The question, in plain words',
          '',
          'Should we keep the new wording?',
          '',
          '## The decision, in plain words',
          '',
          'Yes, we kept it.',
          '',
          '## What I had to decide',
          '',
          'x',
          '',
          '## What I did meanwhile',
          '',
          'y',
          '',
          '## What it costs to change later',
          '',
          'z',
          '',
          '## What I could not know',
          '',
          '(author) w',
          '',
        ].join('\n'),
      },
    ];
    const body = formatOutboxPrComment({
      items: [],
      answered,
      numbering: [{ number: 1, id: 's2-01-a', since: '2026-09-23T00:00:00.000Z' }],
      ctx,
    });

    expect(body).toContain('**Every question is answered**');
    expect(body).not.toMatch(/needs? your decision/);
    expect(body).toContain('**Answered**');
    expect(body).toContain('**Question 1**');
    expect(body).toContain('Should we keep the new wording?');
    expect(body).toContain('"approve all"');
    expect(body).toContain('@pierrederval');
    expect(body).toContain('23 Sep');
    expect(body).toContain('kept as built');
  });

  it('marks a question re-asked by a round comment', () => {
    const items = [
      {
        ...item({ id: 's2-01-a', rank: 'medium' }),
        sections: { questionPlain: 'q', decisionPlain: 'd' },
      },
      {
        ...item({ id: 's3-01-b', rank: 'high' }),
        sections: { questionPlain: 'q2', decisionPlain: 'd2' },
      },
    ];
    const roundMarkers = new Map([[2, 3]]);
    const body = formatOutboxPrComment({
      items,
      numbering: [
        { number: 1, id: 's3-01-b', since: 't' },
        { number: 2, id: 's2-01-a', since: 't' },
      ],
      roundMarkers,
      ctx,
    });
    // Worst-first: Question 1 (s3-01-b, high) comes before Question 2 (s2-01-a, medium).
    const questionOneBlock = body.slice(
      body.indexOf('### Question 1 '),
      body.indexOf('### Question 2 '),
    );
    const questionTwoBlock = body.slice(body.indexOf('### Question 2 '));
    expect(questionOneBlock).not.toContain('Asked again');
    expect(questionTwoBlock).toContain('_Asked again in round 3._');
  });

  it('ends with the numbers marker', () => {
    const body = formatOutboxPrComment({ items: [], numbering: [], ctx });
    expect(body.trimEnd().endsWith(formatNumbersMarker([], markers))).toBe(true);
  });
});

describe('upsertOutboxPrComment', () => {
  it('Scenario: every open question is asked in plain words, most urgent first', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'medium' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'high' });
      writeItem(root, 985, 's7-01-c.md', { id: 's7-01-c', rank: 'human-action' });
      const client = fakeClient();

      const result = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);

      expect(result.action).toBe('created');
      expect(client.comments).toHaveLength(1);
      const body = client.comments[0].body;
      expect(body).toContain(markers.prComment);
      expect(body).toContain('**3 questions need your decision**');
      expect(body.indexOf('needs a person')).toBeLessThan(body.indexOf('· high'));
      expect(body.indexOf('· high')).toBeLessThan(body.indexOf('· medium'));
    });
  });

  it('Scenario: a pull request with no open question gets no comment', () => {
    withFixtureRoot((root) => {
      const client = fakeClient();
      const result = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);
      expect(result.action).toBe('skipped');
      expect(client.createComment).not.toHaveBeenCalled();
      expect(client.comments).toHaveLength(0);
    });
  });

  it('Scenario: the comment stays as the record', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();

      const first = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);
      expect(client.comments[0].body).toMatch(/needs? your decision/);

      settle(root, 'docs/outbox/985/s2-01-a.md', { text: 'ok' });

      const second = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);
      expect(second.action).toBe('updated');
      expect(second.id).toBe(first.id);
      const body = client.comments[0].body;
      expect(body).toContain('**Every question is answered**');
      expect(body).toContain('**Answered**');
      expect(body).toContain('kept as built');
      expect(body).not.toMatch(/needs? your decision/);
    });
  });

  it('Scenario: numbers never move', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      writeItem(root, 985, 's3-01-b.md', { id: 's3-01-b', rank: 'medium' });
      const client = fakeClient();

      upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);
      const firstBody = client.comments[0].body;
      expect(firstBody).toContain('### Question 1 · high — needs your decision');
      expect(firstBody).toContain('### Question 2 · medium — needs your decision');

      // s2-01-a (question 1) settles.
      settle(root, 'docs/outbox/985/s2-01-a.md', { text: 'ok' });
      // A new item is raised.
      writeItem(root, 985, 's9-01-d.md', { id: 's9-01-d', rank: 'high' });

      upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);
      const secondBody = client.comments[0].body;

      // Question 2 (s3-01-b) is still question 2.
      expect(secondBody).toContain('### Question 2 · medium — needs your decision');
      // The new question is question 3, not question 1 (never reused) and not question 2.
      expect(secondBody).toContain('### Question 3 · high — needs your decision');
      expect(secondBody).not.toContain('### Question 1 · high — needs your decision');
      // Question 1 is still named, now in the Answered record.
      expect(secondBody).toMatch(/\*\*Question 1\*\*[\s\S]*kept as built/);
    });
  });

  it('finds an existing PR comment without confusing it for the PRD-issue one', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient([
        { id: 1, body: `${markers.comment}\nPRD issue comment, unrelated` },
        { id: 2, body: `${markers.prComment}\nstale pull request comment` },
      ]);

      const result = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);

      expect(result.action).toBe('updated');
      expect(result.id).toBe(2);
      expect(client.comments).toHaveLength(2);
      expect(client.comments.find((c) => c.id === 1).body).toBe(
        `${markers.comment}\nPRD issue comment, unrelated`,
      );
    });
  });

  it('a question re-asked in a round comment is marked so, read off the pull request’s own comments', () => {
    withFixtureRoot((root) => {
      writeItem(root, 985, 's2-01-a.md', { id: 's2-01-a', rank: 'high' });
      const client = fakeClient();
      const first = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);

      // A round comment re-asks question 1.
      client.comments.push({ id: 999, body: `${markers.round(2, [1])}\nOutbox round 2` });

      const second = upsertOutboxPrComment({ prd: 985, ctx: flatCtx(root) }, client);
      expect(second.id).toBe(first.id);
      expect(client.comments.find((c) => c.id === first.id).body).toContain(
        '_Asked again in round 2._',
      );
    });
  });
});

// ---- Each question set apart, with its options (PRD #1166, slice s6) ----

/** An item's full text, with its options (A is the one built) or, for `human-action`, the steps a
 * person must take — the shape PRD #1166 slice s4 gave every item. */
function optionedItemText({
  id,
  prd = 1166,
  rank = 'high',
  raised = '2026-09-24',
  questionPlain = `Is ${id} the right call?`,
  decisionPlain = 'We kept what was there.',
  options = ['Keep what was built', 'Change it'],
  personSteps = null,
}) {
  const choices = personSteps
    ? ['## What a person must do', '', ...personSteps, '']
    : [
        '## The options, in plain words',
        '',
        ...options.map((text, index) => `${'ABCD'[index]}. ${text}`),
        '',
      ];
  return [
    '---',
    `id: ${id}`,
    `prd: ${prd}`,
    `slice: ${id.split('-')[0]}`,
    `rank: ${rank}`,
    'bears-on: none',
    `raised: ${raised}`,
    'wave: 1',
    '---',
    '',
    '## The question, in plain words',
    '',
    questionPlain,
    '',
    '## The decision, in plain words',
    '',
    decisionPlain,
    '',
    ...choices,
    '## What I had to decide',
    '',
    'x',
    '',
    '## What I did meanwhile',
    '',
    'y',
    '',
    '## What it costs to change later',
    '',
    'z',
    '',
    '## What I could not know',
    '',
    '(author) w',
    '',
  ].join('\n');
}

function writeOptionedItem(root, spec) {
  const dir = join(root, 'docs/outbox', String(spec.prd ?? 1166));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${spec.id}.md`), optionedItemText(spec));
}

function adoptOptioned(root, spec) {
  const result = adoptItem({
    ctx: flatCtx(root),
    itemText: optionedItemText({ rank: 'medium', ...spec }),
  });
  if (!result.ok) throw new Error(result.errors.join('; '));
}

/** Appends a `drifted` entry for an already-adopted id — an objection, the way the reply reader
 * records one: the ledger only grows, and the latest entry for an id wins. */
function objectTo(root, spec, { text = 'B. Change it — because we need all of them' } = {}) {
  const itemText = optionedItemText({ rank: 'medium', ...spec });
  const file = join(root, 'docs/outbox', String(spec.prd ?? 1166), 'settled.md');
  const entry = renderSettledEntry({
    item: {
      id: spec.id,
      rank: 'medium',
      bearsOn: 'none',
      raised: '2026-09-24',
      slice: spec.id.split('-')[0],
      wave: 1,
    },
    itemText,
    answer: {
      text,
      approvedBy: 'pierrederval',
      approvedAt: '2026-09-24T12:00:00Z',
      channel: { kind: 'feature-pull-request', number: 1174 },
    },
    judgement: { verdict: 'drifted', basis: 'stated', reason: 'a human said so' },
    markers,
  });
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n${entry}`);
}

const PINNED = () => '2026-09-24T09:00:00.000Z';

describe('the pull request comment sets each question apart (PRD #1166 s6)', () => {
  it('Scenario: A high question shows its options with the built one recommended', () => {
    withFixtureRoot((root) => {
      writeOptionedItem(root, {
        id: 's2-01-cost',
        questionPlain: 'Should every read return the component cost?',
        options: [
          'Hide the cost unless the user may see prices',
          'Always return it',
          'Never return it',
        ],
      });
      const client = fakeClient();

      upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      const body = client.comments[0].body;

      // Set apart under its own heading, after a horizontal rule.
      expect(body).toContain('---\n\n### Question 1 · high — needs your decision');
      expect(body).toContain('> Should every read return the component cost?');
      // Option A is marked recommended and built; the others are not.
      expect(body).toContain(
        '| A | Hide the cost unless the user may see prices | ✅ recommended · built |',
      );
      expect(body).toContain('| B | Always return it |  |');
      expect(body).toContain('| C | Never return it |  |');
      expect(body).toContain('Reply `1: A`, `1: B because …`, or `go with recommendation`');
      // The header says how to go with every recommendation at once.
      expect(body).toContain(
        'To keep every recommendation at once, reply `go with recommendation`',
      );
    });
  });

  it('a human-action question lists the steps a person must take instead of options', () => {
    withFixtureRoot((root) => {
      writeOptionedItem(root, {
        id: 's7-01-scopes',
        rank: 'human-action',
        questionPlain: 'Can someone add the two Slack scopes?',
        personSteps: ['1. Open the Slack app settings.', '2. Add both scopes and reinstall.'],
      });
      const client = fakeClient();

      upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      const body = client.comments[0].body;

      expect(body).toContain('### Question 1 · human-action — needs a person');
      expect(body).toContain('**What a person must do:**');
      expect(body).toContain('1. Open the Slack app settings.\n2. Add both scopes and reinstall.');
      expect(body).not.toContain('| A |');
    });
  });

  it('Scenario: An adopted item is still shown on the pull request', () => {
    withFixtureRoot((root) => {
      adoptOptioned(root, {
        id: 's3-01-components',
        questionPlain: 'Which components does a quote show when none are granted?',
        options: ['None, and it says so', 'All of them, costs hidden'],
      });
      const client = fakeClient();

      const result = upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      const body = client.comments[0].body;

      expect(result.action).toBe('created');
      expect(body).toContain('<details><summary>Adopted unless you object · 1 medium</summary>');
      expect(body).toContain('### Question 1 · medium — adopted');
      expect(body).toContain('> Which components does a quote show when none are granted?');
      expect(body).toContain('| A | None, and it says so | ✅ adopted · built |');
      expect(body).toContain('To object, reply `1: B because …`');
      expect(body).toContain('</details>');
      // Numbered like any question, so a reply can name it.
      expect(parseNumbersMarker(body, markers).map((entry) => entry.id)).toEqual([
        's3-01-components',
      ]);
      // Nothing needs a decision, and it is not listed as answered.
      expect(body).toContain('**Nothing needs your decision**');
      expect(body).not.toContain('**Answered**');
    });
  });

  it('an adopted item later objected to leaves the adopted section and shows as answered', () => {
    withFixtureRoot((root) => {
      const spec = { id: 's3-01-components', options: ['None', 'All of them'] };
      adoptOptioned(root, spec);
      const client = fakeClient();
      upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);

      objectTo(root, spec);
      upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      const body = client.comments[0].body;

      expect(body).not.toContain('Adopted unless you object');
      expect(body).toContain('**Answered**');
      expect(body).toMatch(/\*\*Question 1\*\*[\s\S]*B\. Change it[\s\S]*to be reworked/);
    });
  });

  it('renders a PRD with one high, one human-action and two adopted items as the before/after page lays it out', () => {
    withFixtureRoot((root) => {
      writeOptionedItem(root, {
        id: 's2-01-cost',
        questionPlain:
          'Should every read return the component cost, even to a user who is not allowed to see prices?',
        options: [
          'Hide the cost unless the user may see prices',
          'Always return it',
          'Never return it',
        ],
      });
      writeOptionedItem(root, {
        id: 's7-01-scopes',
        rank: 'human-action',
        questionPlain: 'Can someone add the two Slack scopes?',
        personSteps: ['1. Open the Slack app settings.', '2. Add both scopes and reinstall.'],
      });
      adoptOptioned(root, {
        id: 's3-01-components',
        questionPlain: 'Which components does a quote show when none are granted?',
        options: ['None, and it says so', 'All of them, costs hidden'],
      });
      adoptOptioned(root, {
        id: 's4-01-order',
        questionPlain: 'In which order are the components listed?',
        options: ['In the order they were added', 'By name', 'By cost'],
      });
      const client = fakeClient();

      upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);

      const since = '2026-09-24T09:00:00.000Z';
      expect(client.comments[0].body).toBe(
        [
          markers.prComment,
          '',
          '**2 questions need your decision**',
          '',
          'Reply to this comment, one line per question: `2: A` keeps what was built, ' +
            '`2: B because …` chooses another option. Several answers can go in one reply. ' +
            'To keep every recommendation at once, reply `go with recommendation`.',
          '',
          '_A reply settles nothing on its own — `/omni:yolo-fix` reads the replies and settles ' +
            'them._',
          '',
          '---',
          '',
          '### Question 1 · human-action — needs a person',
          '',
          '> Can someone add the two Slack scopes?',
          '',
          '**What a person must do:**',
          '',
          '1. Open the Slack app settings.',
          '2. Add both scopes and reinstall.',
          '',
          'Reply `1: ok` once it is done, or `1: no, because …`',
          '',
          '---',
          '',
          '### Question 2 · high — needs your decision',
          '',
          '> Should every read return the component cost, even to a user who is not allowed to see prices?',
          '',
          '|   | Option | |',
          '| --- | --- | --- |',
          '| A | Hide the cost unless the user may see prices | ✅ recommended · built |',
          '| B | Always return it |  |',
          '| C | Never return it |  |',
          '',
          'Reply `2: A`, `2: B because …`, or `go with recommendation`',
          '',
          '---',
          '',
          '<details><summary>Adopted unless you object · 2 medium</summary>',
          '',
          '### Question 3 · medium — adopted',
          '',
          '> Which components does a quote show when none are granted?',
          '',
          '|   | Option | |',
          '| --- | --- | --- |',
          '| A | None, and it says so | ✅ adopted · built |',
          '| B | All of them, costs hidden |  |',
          '',
          'To object, reply `3: B because …`',
          '',
          '### Question 4 · medium — adopted',
          '',
          '> In which order are the components listed?',
          '',
          '|   | Option | |',
          '| --- | --- | --- |',
          '| A | In the order they were added | ✅ adopted · built |',
          '| B | By name |  |',
          '| C | By cost |  |',
          '',
          'To object, reply `4: B because …`',
          '',
          '</details>',
          '',
          formatNumbersMarker(
            [
              { number: 1, id: 's7-01-scopes', since },
              { number: 2, id: 's2-01-cost', since },
              { number: 3, id: 's3-01-components', since },
              { number: 4, id: 's4-01-order', since },
            ],
            markers,
          ),
        ].join('\n'),
      );
    });
  });

  it('escapes a pipe inside an option so the table keeps its columns', () => {
    const body = formatOutboxPrComment({
      items: [
        {
          id: 's2-01-a',
          rank: 'high',
          sections: {
            questionPlain: 'q',
            decisionPlain: 'd',
            options: [
              { letter: 'A', text: 'This | that' },
              { letter: 'B', text: 'Other' },
            ],
          },
        },
      ],
      numbering: [{ number: 1, id: 's2-01-a', since: 't' }],
      ctx,
    });
    expect(body).toContain('| A | This \\| that | ✅ recommended · built |');
  });
});

describe('the Slack note learns what the pull request comment holds (PRD #1166 s7)', () => {
  it('the PRD issue writer counts the adopted items, and a later objection takes one away', () => {
    withFixtureRoot((root) => {
      writeOptionedItem(root, { id: 's2-01-cost' });
      adoptOptioned(root, { id: 's3-01-components' });
      adoptOptioned(root, { id: 's4-01-order' });

      const first = upsertOutboxComment(
        { prd: 1166, owner: 'o', repo: 'r', branch: 'feat/x', ctx: flatCtx(root) },
        fakeClient(),
      );
      expect(first.adoptedCount).toBe(2);

      objectTo(root, { id: 's4-01-order' });
      const second = upsertOutboxComment(
        { prd: 1166, owner: 'o', repo: 'r', branch: 'feat/x', ctx: flatCtx(root) },
        fakeClient(),
      );
      expect(second.adoptedCount).toBe(1);
    });
  });

  it('the PRD issue writer counts adopted items even when it posts no comment of its own', () => {
    withFixtureRoot((root) => {
      adoptOptioned(root, { id: 's3-01-components' });
      const result = upsertOutboxComment(
        { prd: 1166, owner: 'o', repo: 'r', branch: 'feat/x', ctx: flatCtx(root) },
        fakeClient(),
      );
      expect(result.action).toBe('skipped');
      expect(result.adoptedCount).toBe(1);
    });
  });

  it('the pull request writer names how many adopted items it numbered for the first time', () => {
    withFixtureRoot((root) => {
      writeOptionedItem(root, { id: 's2-01-cost' });
      adoptOptioned(root, { id: 's3-01-components' });
      const client = fakeClient();

      const first = upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      expect(first.adoptedCount).toBe(1);
      expect(first.newAdoptedCount).toBe(1);

      const second = upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      expect(second.newAdoptedCount).toBe(0);

      adoptOptioned(root, { id: 's4-01-order' });
      const third = upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      expect(third.adoptedCount).toBe(2);
      expect(third.newAdoptedCount).toBe(1);
    });
  });

  it('a newly raised high question is not counted as newly adopted', () => {
    withFixtureRoot((root) => {
      adoptOptioned(root, { id: 's3-01-components' });
      const client = fakeClient();
      upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);

      writeOptionedItem(root, { id: 's5-01-late' });
      const next = upsertOutboxPrComment({ prd: 1166, ctx: flatCtx(root), now: PINNED }, client);
      expect(next.newAdoptedCount).toBe(0);
    });
  });

  it('a skipped pull request comment adopted nothing', () => {
    withFixtureRoot((root) => {
      const result = upsertOutboxPrComment(
        { prd: 1166, ctx: flatCtx(root), now: PINNED },
        fakeClient(),
      );
      expect(result.action).toBe('skipped');
      expect(result.adoptedCount).toBe(0);
      expect(result.newAdoptedCount).toBe(0);
    });
  });
});
