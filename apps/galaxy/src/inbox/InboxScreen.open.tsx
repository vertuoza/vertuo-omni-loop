'use client';
import type { IconName } from '@omni/design';
import { Badge, Button, EmptyState, Icon, Kbd, SegmentedControl } from '@omni/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import type { QuestionSource } from '../ask/page/AskQuestion';
import { markSeen } from '../waiting/documents';
import { useWaiting, type Waiting } from '../waiting/WaitingProvider';
import { inboxOf, type Inbox, type InboxFilter, type InboxRow, type InboxSectionId } from './inbox';
import { drawnSections, hrefOf, inputOf, nextOpen, problemsOf, rowWords, unreadCounted, type InboxParts } from './InboxScreen.model';
import { ItemPanel, QuestionPanel } from './InboxScreen.panel';
import './inbox-open.css';
import { actionOf, isTyping, listKey, ownsArrows, type KeyAction } from './keys';

// The Inbox's Open tab (PRD omni-loop-22, s5): the kind chips, then one list in sections, each shown
// only when it has an item or a part it reads failed, oldest first inside each (src/inbox/inbox.ts),
// drawn from the app shell's waiting list (no read of its own). From 1280 px the list sits beside the
// panel; below, the list is full width and the open item opens in place under its row. On landing the
// first question is open, else the first decision; the open item is kept by its key across reads, and
// when it leaves (answered here or elsewhere, closed) the next one opens. Each row is a link to the
// item's own page: a plain click opens it in the panel, a click with a modifier opens the page. The
// list's keys (src/inbox/keys.ts) are off in a text field. With nothing counted waiting and every part
// read: "Nothing waits on you.", and the uncounted sections below.

const WIDE = '(min-width: 1280px)';

const subscribeWide = (change: () => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', change);
  return () => { query.removeEventListener('change', change); };
};

/** Whether the list sits beside the panel: from 1280 px; the server draws it so. */
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true);

type Counts = Pick<Waiting['counts'], 'questions' | 'approvals' | 'outbox' | 'reviews' | 'shared' | 'total'>;

const CHIP = (filter: InboxFilter) => (filter.shared ? 'shared' : filter.kind);

function chipsOf(counts: Counts) {
  const option = (id: string, label: string, n: number, href: string) => ({ id, label, count: String(n), href });
  return [
    option('all', 'All', counts.total, '/app/inbox'),
    option('question', 'Questions', counts.questions, '/app/inbox?kind=question'),
    option('approval', 'Approvals', counts.approvals, '/app/inbox?kind=approval'),
    option('outbox', 'Outbox', counts.outbox, '/app/inbox?kind=outbox'),
    option('review', 'Reviews', counts.reviews, '/app/inbox?kind=review'),
    option('shared', 'Shared with me', counts.shared, '/app/inbox?from=shared'),
  ];
}

/** The pixel icon that anchors a row: what kind of wait it is (a face needs a person, which the waiting list does not name). */
function anchorOf(row: InboxRow): IconName {
  switch (row.kind) {
    case 'question': return 'tone-info';
    case 'approval': return 'check';
    case 'outbox': return 'outbox';
    case 'review': return row.item.kind === 'merge' ? 'roadmap' : row.item.kind === 'law' ? 'settings' : 'prds';
    case 'runner': return 'runners';
    case 'update': return 'home';
  }
}

/** The row's quiet line: "Blocking" in the info role, then the kind as a word, then where it is from. */
function QuietLine({ row, words }: { row: InboxRow; words: ReturnType<typeof rowWords> }) {
  const kinds = words.badges.filter((b) => b !== 'Blocking' && b !== 'Shared').map((b) => (row.kind === 'outbox' ? `Outbox · ${b}` : b));
  const where = row.kind === 'outbox' ? words.context.replace(/ · outbox item$/, '') : words.context;
  const parts = [
    ...(words.badges.includes('Blocking') ? [<span key="blocking" className="inbox-r-flag">Blocking</span>] : []),
    ...kinds.map((k) => <span key={k} className="inbox-r-kind">{k}</span>),
    <span key="where">{where}</span>,
  ];
  return (
    <span className="inbox-r-quiet">
      {parts.map((part, i) => (
        <span key={i} className="inbox-r-part">{i > 0 && <span className="inbox-r-sep" aria-hidden="true">·</span>}{part}</span>
      ))}
    </span>
  );
}

/** One row, on the shared anatomy: an icon, the title, one quiet line and the age; "✓ Answered" once sent here. */
function Row({ row, now, open, sent, onChoose, onFocus }: { row: InboxRow; now: number; open: boolean; sent: boolean; onChoose: (key: string) => void; onFocus: (key: string) => void }) {
  const words = rowWords(row, now);
  const choose = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onChoose(row.key);
  };
  return (
    <a className="inbox-r" href={hrefOf(row)} data-key={row.key} aria-current={open ? 'true' : undefined} onClick={choose} onFocus={() => { onFocus(row.key); }}>
      <span className="inbox-r-anchor"><span className="inbox-open-icon"><Icon name={anchorOf(row)} /></span></span>
      <span className="inbox-r-main">
        <span className="inbox-r-title">{words.text}</span>
        <QuietLine row={row} words={words} />
      </span>
      <span className="inbox-r-end">
        {sent ? <Badge tone="success">✓ Answered</Badge> : words.age && <span suppressHydrationWarning>{words.age}</span>}
      </span>
    </a>
  );
}

export type InboxOpenViewProps = {
  inbox: Inbox;
  problems: Partial<Record<InboxSectionId, string>>;
  counts: Counts;
  filter: InboxFilter;
  now: number;
  open: string | null;
  sent: ReadonlySet<string>;
  wide: boolean;
  notice: string | null;
  panelOf: (row: InboxRow) => ReactNode;
  onChoose?: (key: string) => void;
  onFocus?: (key: string) => void;
};

/** The Open tab as it draws a given Inbox: what the render tests pin. */
export function InboxOpenView({ inbox, problems, counts, filter, now, open, sent, wide, notice, panelOf, onChoose = () => {}, onFocus = () => {} }: InboxOpenViewProps) {
  const sections = drawnSections(inbox, problems);
  const openRow = inbox.rows.find((r) => r.key === open) ?? null;
  const zero = inbox.count === 0 && !unreadCounted(problems) && filter.kind === 'all' && !filter.shared;
  return (
    <div className="inbox-open">
      <div className="inbox-toolbar">
        <SegmentedControl label="Show" size="sm" variant="pills" options={chipsOf(counts)} value={CHIP(filter)} link={Link} />
        {inbox.rows.length > 0 && (
          <span className="inbox-toolbar-end"><Kbd size="small">j</Kbd> <Kbd size="small">k</Kbd> move · <Kbd size="small">↵</Kbd> open · <Kbd size="small">o</Kbd> its page · <Kbd size="small">e</Kbd> clears an update</span>
        )}
      </div>
      {zero && (
        <EmptyState title="Nothing waits on you." action={<Button variant="quiet" href="/app/inbox/workspace">See what waits on others →</Button>}>
          New questions land here the moment an agent asks.
        </EmptyState>
      )}
      <div className={wide ? 'inbox-split' : 'inbox-stack'}>
        <div className="inbox-list">
          {sections.map((section) => (
            <section key={section.id} className="inbox-group" aria-label={section.title} data-section={section.id}>
              <h2 className="inbox-group-head">
                {section.title} <span className="inbox-section-count">{section.counted ? section.rows.length : `${section.rows.length} · not counted`}</span>
              </h2>
              {section.problem && <p className="inbox-problem" role="status">{section.problem}</p>}
              {section.rows.map((row) => (
                <div key={row.key} className="inbox-item">
                  <Row row={row} now={now} open={row.key === open} sent={sent.has(row.key)} onChoose={onChoose} onFocus={onFocus} />
                  {!wide && row.key === open && <div className="inbox-inplace">{panelOf(row)}</div>}
                </div>
              ))}
            </section>
          ))}
          {notice && <p className="inbox-notice" role="status">{notice}</p>}
        </div>
        {wide && openRow && <div className="inbox-side">{panelOf(openRow)}</div>}
      </div>
    </div>
  );
}

const storage = () => window.localStorage;

/** A PRD's new documents, cleared: marked seen in this browser, as opening its page marks them. */
function clearUpdate(row: Extract<InboxRow, { kind: 'update' }>) {
  if (row.item.id.startsWith('docs-')) markSeen(storage, row.item.id.slice('docs-'.length), Date.now());
}

/** What the Open tab reads of the waiting provider. */
const partsOf = (waiting: Waiting): InboxParts => ({
  list: waiting.list, approvals: waiting.approvals, reviews: waiting.reviews, documents: waiting.documents,
  business: waiting.business, runners: waiting.counts.runners, unread: waiting.unread, unreadPrds: waiting.unreadPrds,
});

/** The Open tab, live: the waiting list, the open item, the list's keys and the panel. */
export function InboxOpen({ source, me, filter }: { source: QuestionSource; me: string | null; filter: InboxFilter }) {
  const waiting = useWaiting();
  const wide = useWide();
  const [now, setNow] = useState(() => Date.now());
  const [cleared, setCleared] = useState<ReadonlySet<string>>(() => new Set());
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set());
  const [chosen, setChosen] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const before = useRef<readonly string[]>([]);

  const inbox = useMemo(() => inboxOf(inputOf(partsOf(waiting), now, cleared), filter), [waiting, now, cleared, filter]);
  const open = nextOpen(before.current, inbox, chosen, sent);

  useEffect(() => {
    before.current = inbox.rows.map((r) => r.key);
    if (open !== chosen) setChosen(open);
  }, [inbox, open, chosen]);

  useEffect(() => {
    const tick = setInterval(() => { setNow(Date.now()); }, 30_000);
    return () => { clearInterval(tick); };
  }, []);

  const onSent = useCallback((roundId: string) => {
    setSent((s) => new Set([...s, `question:${roundId}`]));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const action = actionOf(listKey(event, isTyping(target), ownsArrows(target)), inbox.rows, focus, open);
      if (!action) return;
      event.preventDefault();
      act(action);
    };
    const act = (action: NonNullable<KeyAction>) => {
      switch (action.kind) {
        case 'focus':
          setFocus(action.key);
          if (action.key !== null) document.querySelector<HTMLElement>(`[data-key="${CSS.escape(action.key)}"]`)?.focus();
          return;
        case 'page':
          if (action.external) window.open(action.href, '_blank', 'noopener,noreferrer');
          else window.location.assign(action.href);
          return;
        case 'refuse':
          setNotice(action.words);
          return;
        case 'clear':
          clearUpdate(action.row);
          setCleared((c) => new Set([...c, action.row.key]));
          setNotice('Cleared to Done.');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, [inbox, focus, open]);

  const questions = inbox.rows.filter((r) => r.kind === 'question');
  const panelOf = (row: InboxRow): ReactNode => {
    if (row.kind !== 'question') return <ItemPanel key={row.key} row={row} now={now} />;
    if (sent.has(row.key)) return null;
    return <QuestionPanel key={row.key} roundId={row.item.id} context={rowWords(row, now).context} place={{ n: questions.findIndex((q) => q.key === row.key) + 1, of: questions.length }} source={source} me={me} onSent={onSent} />;
  };

  return (
    <InboxOpenView
      inbox={inbox}
      problems={problemsOf(waiting.unread, waiting.unreadPrds)}
      counts={waiting.counts}
      filter={filter}
      now={now}
      open={open}
      sent={sent}
      wide={wide}
      notice={notice}
      panelOf={panelOf}
      onChoose={(key) => { setChosen(key); setFocus(key); setNotice(null); }}
      onFocus={setFocus}
    />
  );
}
