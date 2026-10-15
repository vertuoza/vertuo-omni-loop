import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { present } from '../../ask/test/test-item';
import { DEMO_ROADMAP } from '../../roadmap/page/demo';
import { detailOf, type RoadmapDetail, type RoadmapPageView, type RoadmapRead } from '../../roadmap/page/model';
import { RoadmapsScreen } from '../../roadmap/page/RoadmapsScreen';
import type { RoadmapRow } from '../../roadmap/store';
import type { ApprovalRow } from './approval';
import type { RoadmapRecordRead } from './RoadmapRecord';
import { versionPickOf } from './RoadmapRecord';

// A product roadmap's page as the server renders it (PRD 2011, s3), to static markup: its id and status,
// Approve while it waits, the seal once approved, drifted · approve again, and the Versions tab with every
// version of each part and the text of the one shown.

vi.mock('next/navigation', async (original) => ({ ...(await original<typeof import('next/navigation')>()), useRouter: () => ({ refresh: () => {} }) }));

const NOW = new Date('2026-10-20T12:00:00Z');
const DOSSIER = '00000000-0000-4000-8000-0000000000e1';
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

const ROW: RoadmapRow = {
  id: DEMO_ROADMAP, workspace_id: 'w1', repo: null, number: null, title: 'Mobile 2027', milestone: 'The app ships offline.', product_id: 'p-1',
  target_date: null, source: null, questions: [], document: '', pushed_by: null, created_at: NOW.toISOString(), pushed_at: NOW.toISOString(), dossier_id: DOSSIER,
};
const READ: RoadmapRead = { row: ROW, seq: 3, prds: [], humanWork: [] };
const APPROVED: ApprovalRow = {
  id: 'a-1', approver_login: 'ada', approved_at: '2026-10-15T09:12:00Z', files: [{ kind: 'roadmap', path: 'roadmap.md', version_id: 'd1', sha256: '9c41aa00e07b' }],
};
const record = (over: Partial<RoadmapRecordRead> = {}): RoadmapRecordRead => ({
  dossier: DOSSIER, approval: null, voids: [], asked: [], text: '# Mobile 2027\n\nOffline first.',
  versions: [
    { id: 'd1', kind: 'roadmap', bytes: 8, source: 'kit', created_at: '2026-10-15T08:00:00Z' },
    { id: 'd2', kind: 'roadmap', bytes: 9, source: 'kit', created_at: '2026-10-16T08:00:00Z' },
  ], ...over,
});

function page(read: RoadmapRecordRead | null, tab: RoadmapDetail['tab'] = 'overview', pick = versionPickOf(null, null)): string {
  const roadmap = detailOf(READ, [{ id: 'p-1', name: 'Mobile', key: 'mobile' }], NOW.getTime(), { prerequisites: [], tab, record: { read, pick, me: 'u-ada' } });
  const view: RoadmapPageView = { kind: 'roadmap', name: 'Acme', demo: null, roadmap };
  return renderToStaticMarkup(createElement(RoadmapsScreen, { view, supabase: null, signinError: null }));
}

describe('a product roadmap\'s page', () => {
  it('is headed by its id, held and waiting for approval, with Approve and no issue link', () => {
    const html = page(record());
    const t = text(html);
    expect(t).toContain('mobile-R3 Mobile 2027');
    expect(t).toContain('held waiting for approval');
    expect(html).toContain('>Approve</button>');
    expect(t).toContain('mobile-R3 · born on the server, no issue');
    expect(html).not.toContain('github.com');
  });

  it('shows the seal, with who approved it and the pinned file, instead of Approve once approved', () => {
    const html = page(record({ approval: APPROVED, versions: record().versions.slice(0, 1) }));
    expect(html).toContain('class="dossier-seal-card"');
    expect(text(html)).toContain('Approved by ada');
    expect(text(html)).toContain('roadmap.md 9c41aa0');
    expect(html).not.toContain('>Approve</button>');
    expect(text(html)).toContain('approved approved');
  });

  it('reads drifted · approve again, offering Approve, once a newer document was pushed', () => {
    const html = page(record({ approval: APPROVED }));
    expect(text(html)).toContain('drifted drifted · approve again');
    expect(text(html)).toContain('roadmap.md changed since ada approved it');
    expect(html).toContain('>Approve</button>');
  });

  it('says the approval could not be read, with no button', () => {
    const html = page(record({ approval: 'unread' }));
    expect(text(html)).toContain('The approval could not be read');
    expect(html).not.toContain('>Approve</button>');
  });

  it('lists every version of each part under Versions, the newest first, and shows the text of the latest document', () => {
    const html = page(record(), 'versions');
    const documents = present(/<section class="board-card roadmap-versions" aria-label="Document">[\s\S]*?<\/section>/.exec(html)?.[0], 'the document part');
    expect(text(documents)).toBe('Document roadmap.md · 2 versions v2 · 16 Oct 2026, 08:00 UTC · kit v1 · 15 Oct 2026, 08:00 UTC · kit');
    expect(documents.indexOf('v2 ·')).toBeLessThan(documents.indexOf('v1 ·'));
    expect(html).toContain('href="/roadmaps/' + DEMO_ROADMAP + '?tab=versions&amp;v=1"');
    expect(text(html)).toContain('PRD rows prds.json · 0 versions No push sent it yet.');
    expect(text(html)).toContain('Document · v2 # Mobile 2027 Offline first.');
  });

  it('shows the version asked for under Versions', () => {
    const html = page(record({ text: 'old' }), 'versions', versionPickOf('roadmap', '1'));
    expect(text(html)).toContain('Document · v1 old');
    expect(html).toContain('aria-current="true"');
  });

  it('says the versions could not be read, rather than showing none', () => {
    expect(text(page(null, 'versions'))).toContain('The roadmap\'s versions could not be read');
  });
});
