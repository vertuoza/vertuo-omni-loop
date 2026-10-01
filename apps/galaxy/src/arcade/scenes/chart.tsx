'use client';
// The star chart's text layer (PRD 149): on `chart`, the title, each sun's name and count, each
// lane's count and the dialog of the sun under the cursor; on `system`, the HUD, the panel of the
// world under the cursor and the reading card A opens over it. Laid out for the grid the screen is
// drawn on (chart.css places each for `.grid-wide` and `.grid-tall`). Without a graph, both say why.
import type { KnowledgeEntry, KnowledgeGraph } from '../../data/knowledge';
import { cited, servedBy, serving } from '../../data/knowledge';
import { Hint } from '../hint';
import { useScreen } from '../Screen';
import type { ChartLayout, ChartSource, SystemLayout } from './chart-layout.ts';
import { KIND_LOOK, kindCss } from './chart.ts';
import type { GridName } from './common.ts';
import './common.css';
import './chart.css';

const plural = (n: number, one: string, many = `${one}S`) => `${n} ${n === 1 ? one : many}`;

/** The star chart in a line: its systems and its worlds (the menu's hint, the chart's HUD). */
export function chartTally(graph: KnowledgeGraph): string {
  return `${plural(graph.domains.length, 'SYSTEM')} · ${plural(graph.entries.length, 'WORLD')}`;
}

/** Why there is no star chart: out of reach, or a build that carries none. */
export function chartRefusal(source: 'none' | null): string {
  return source === 'none' ? 'NO STAR CHART IN THIS BUILD' : 'THE STAR CHART IS OUT OF REACH';
}

/** The chart without a graph: the reason, and the way back. */
function NoChart({ source }: { source: 'none' | null }) {
  return (
    <div className="chart chart-none">
      <h2>STAR CHART</h2>
      <p className="chart-why">{chartRefusal(source)}</p>
      <p className="chart-more">
        {source === 'none'
          ? 'THIS SHARED PAGE CARRIES NO KNOWLEDGE BASE. THE CREW READS IT IN THE ARCADE AND AT /KNOWLEDGE.'
          : 'ONLY THE CREW READS THE KNOWLEDGE BASE, AND IT COULD NOT BE READ HERE.'}
      </p>
      <p className="hint chart-foot"><Hint k="B"> MENU</Hint></p>
    </div>
  );
}

// ── chart ────────────────────────────────────────────────────────────────────

export function ChartOverlay({ source, layout, sun, onEnter }: { source: ChartSource; layout: ChartLayout; sun: number; onEnter: () => void }) {
  if (!source || source === 'none') return <NoChart source={source} />;
  const cur = layout.suns[sun];
  const s = cur?.system;
  return (
    <div className="chart">
      <header className="hud chart-hud">
        <span className="chart-title">STAR CHART · {(source.repo ?? 'THIS REPOSITORY').toUpperCase()}</span>
        <span className="chart-tally">{chartTally(source)}</span>
      </header>
      {layout.suns.map((slot) => (
        <span key={slot.name} className={`sun-label${slot.index === sun ? ' active' : ''}`} style={{ left: slot.x, top: Math.round(slot.y + slot.r * 1.4 + 3), width: slot.label }}>
          <b>{slot.name.toUpperCase()}</b>
          <small>{plural(slot.system.size, 'WORLD')}</small>
        </span>
      ))}
      {layout.lanes.map((lane) => {
        const a = layout.suns[lane.from]!, b = layout.suns[lane.to]!;
        return (
          <span key={`${a.name}--${b.name}`} className="lane-label" style={{ left: Math.round((a.x + b.x) / 2), top: Math.round((a.y + b.y) / 2) }}>
            {lane.count}
          </span>
        );
      })}
      <section className="dialog chart-dialog" aria-live="polite">
        {s ? (
          <>
            <div className="dialog-row">
              <span className="chart-name">{s.name.toUpperCase()}</span>
              <span className="chip" style={{ ['--chip' as string]: s.scope === 'product' ? '#ffd84a' : '#a88cff' }}>{s.scope === 'product' ? 'PRODUCT' : 'DOMAIN'}</span>
            </div>
            <div className="dialog-row small">
              {(['principle', 'rule', 'invariant'] as const).map((kind) => (
                <span key={kind} style={{ color: kindCss(kind) }}>{plural(s.counts[`${kind}s`], KIND_LOOK[kind].label)}</span>
              ))}
            </div>
            <div className="dialog-row small">
              <span className="good">{plural(s.counts.laws, 'LAW')} · TERRAFORMED</span>
              <span>{s.counts.proposed} PROPOSED · BARREN</span>
            </div>
            <button type="button" className="dialog-go" onClick={onEnter}>A · ENTER</button>
          </>
        ) : (
          <p className="empty">NO SYSTEMS CHARTED YET: THE KNOWLEDGE BASE IS EMPTY.</p>
        )}
      </section>
      <footer className="chart-foot">
        <span className="chart-read">READ IT AT /KNOWLEDGE</span>
        <span className="hint">✥ MOVE · <Hint k="B"> MENU</Hint></span>
      </footer>
    </div>
  );
}

// ── system ───────────────────────────────────────────────────────────────────

/** What the panel says an entry serves, or what serves it. */
export function servesLine(graph: KnowledgeGraph, entry: KnowledgeEntry): string {
  if (entry.kind === 'principle') {
    const n = servedBy(graph, entry.id).length;
    return n ? `SERVED BY ${n}` : 'SERVED BY NONE';
  }
  const up = serving(graph, entry.id);
  return up ? `SERVES ${up.id}` : 'SERVES NO PRINCIPLE';
}

/** One line of the reading card: a label in the pixel face, or a line of text. */
export interface CardLine { tone: 'label' | 'text'; text: string }

/**
 * How much of the card one page holds on each grid: the characters a line of the text face takes,
 * and the lines a page takes (a label counts as one). chart.css sizes the card to hold them.
 */
export const CARD_FIT: Record<GridName, { chars: number; lines: number }> = {
  wide: { chars: 60, lines: 13 },
  tall: { chars: 34, lines: 11 },
};

/** `text` in lines of at most `chars` characters, broken between words (a word longer than a line is cut). */
export function wrap(text: string, chars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (let word of text.split(/\s+/).filter(Boolean)) {
    while (word.length > chars) {
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, chars));
      word = word.slice(chars);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= chars) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

/** The whole entry, block by block: its statement, `Why:`, what it serves, what serves it, what it cites, where it came from. */
export function cardBlocks(graph: KnowledgeGraph, entry: KnowledgeEntry): { label?: string; text: string }[] {
  const up = serving(graph, entry.id);
  const down = servedBy(graph, entry.id);
  const cites = cited(graph, entry.id);
  return [
    { text: entry.statement },
    ...(entry.why ? [{ label: 'WHY', text: entry.why }] : []),
    ...(entry.kind !== 'principle'
      ? [{ label: 'SERVES', text: up ? `${up.id}: ${up.statement}` : entry.serves ? `${entry.serves}, which names no entry here.` : 'No principle: its Serves: line names none.' }]
      : []),
    ...(entry.kind === 'principle' || down.length
      ? [{ label: `SERVED BY ${down.length}`, text: down.length ? down.map((e) => e.id).join(', ') : 'Nothing serves it yet.' }]
      : []),
    ...(cites.length ? [{ label: 'CITES', text: cites.map((e) => e.id).join(', ') }] : []),
    ...(entry.enforced && entry.enforcedBy ? [{ label: 'ENFORCED BY', text: entry.enforcedBy }] : []),
    { label: 'FROM', text: entry.prd ? `PRD #${entry.prd}` : 'No PRD named.' },
  ];
}

/** The reading card, page by page, on `grid`: never a label alone at the foot of a page. */
export function cardPages(graph: KnowledgeGraph, entry: KnowledgeEntry, grid: GridName): CardLine[][] {
  const { chars, lines: per } = CARD_FIT[grid];
  const lines = cardBlocks(graph, entry).flatMap(({ label, text }) => [
    ...(label ? [{ tone: 'label' as const, text: label }] : []),
    ...wrap(text, chars).map((t) => ({ tone: 'text' as const, text: t })),
  ]);
  const pages: CardLine[][] = [];
  let page: CardLine[] = [];
  for (const [i, line] of lines.entries()) {
    const last = page.length === per - 1;
    if (page.length === per || (last && line.tone === 'label' && i < lines.length - 1)) { pages.push(page); page = []; }
    page.push(line);
  }
  if (page.length) pages.push(page);
  return pages;
}

function StatusChip({ entry }: { entry: KnowledgeEntry }) {
  return entry.status === 'law'
    ? <span className="chip" style={{ ['--chip' as string]: '#4ee08a' }}>LAW</span>
    : <span className="chip" style={{ ['--chip' as string]: '#8a90d6' }}>PROPOSED</span>;
}

function KindTag({ entry }: { entry: KnowledgeEntry }) {
  return <span className="kind-tag" style={{ color: kindCss(entry.kind) }}>{KIND_LOOK[entry.kind].label}</span>;
}

/** The reading card over the system: the whole entry, a page at a time. */
export function ReadingCard({ graph, entry, page, onPage }: { graph: KnowledgeGraph; entry: KnowledgeEntry; page: number; onPage: (page: number) => void }) {
  const { grid } = useScreen();
  const pages = cardPages(graph, entry, grid.name);
  const at = Math.max(0, Math.min(page, pages.length - 1));
  return (
    <section className="read-card" role="dialog" aria-label={`${entry.id}, read whole`}>
      <header className="read-head">
        <span className="read-id">{entry.id}</span>
        <KindTag entry={entry} />
        <StatusChip entry={entry} />
      </header>
      <div className="read-body">
        {pages[at]!.map((line, i) => <p key={i} className={`read-${line.tone}`}>{line.text}</p>)}
      </div>
      <footer className="read-foot">
        {pages.length > 1 ? (
          <span className="read-pages">
            <button type="button" aria-label="Previous page" disabled={at === 0} onClick={() => onPage(at - 1)}>▲</button>
            {` PAGE ${at + 1}/${pages.length} `}
            <button type="button" aria-label="Next page" disabled={at === pages.length - 1} onClick={() => onPage(at + 1)}>▼</button>
          </span>
        ) : <span />}
        <span className="hint"><Hint k="B"> CLOSE</Hint></span>
      </footer>
    </section>
  );
}

export function SystemOverlay({ graph, layout, world, card, cardPage, onRead, onPage }: {
  graph: KnowledgeGraph; layout: SystemLayout; world: number; card: boolean; cardPage: number;
  onRead: () => void; onPage: (page: number) => void;
}) {
  const cur = layout.worlds[world];
  const domain = graph.domains.find((d) => d.name === layout.name);
  const e = cur?.entry;
  return (
    <div className="system">
      <header className="hud system-hud">
        <span className="system-name">{layout.name.toUpperCase()} SYSTEM</span>
        <span className="system-count">{domain ? `${plural(domain.counts.laws, 'LAW')} · ${domain.counts.proposed} PROPOSED` : ''}</span>
        <span className="system-legend">
          {(['principle', 'rule', 'invariant'] as const).map((kind) => (
            <span key={kind} style={{ color: kindCss(kind) }}>● {KIND_LOOK[kind].plural}</span>
          ))}
        </span>
      </header>
      <section className="dialog system-panel" aria-live="polite">
        {e ? (
          <>
            <div className="system-id">
              <span className="dialog-prd">{e.id}</span>
              <StatusChip entry={e} />
            </div>
            <KindTag entry={e} />
            <p className="system-statement">{e.statement}</p>
            <p className="system-serves">{servesLine(graph, e)}</p>
            <button type="button" className="dialog-go" onClick={onRead}>A · READ</button>
          </>
        ) : (
          <p className="empty">NO WORLDS IN THIS SYSTEM YET.</p>
        )}
      </section>
      <footer className="hint system-foot">◀ ▶ ORBIT · ▲ ▼ IN / OUT · <Hint k="B"> CHART</Hint></footer>
      {card && e && <ReadingCard graph={graph} entry={e} page={cardPage} onPage={onPage} />}
    </div>
  );
}
