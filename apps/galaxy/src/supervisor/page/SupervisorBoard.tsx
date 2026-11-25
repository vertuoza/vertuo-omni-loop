'use client';
import { spritePixels } from '@omni/design';
import { Badge, Button, EmptyState, SegmentedControl, Tabs } from '@omni/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Finding } from '../api/supervisor.contract';
import { poll } from '../../ask/page/poll';
import { pixelSvg } from '../../design/pixel-svg';
import {
  KIND_LABEL, RUNNERS_PATH, SUPERVISOR_REFRESH_MS, chatOf, checkOf, chipsOf, evidenceOf, headerOf, hrefOf, lastSaid, openFinding, phoneSide,
  sectionsOf, spanWords, suggestionsOf, threadOf, type Header, type Query, type Row, type Said, type SupervisorData,
} from './model';
import { SeatControls } from './SeatControls';
import { ChatBox } from '../chat/ChatBox';

// The Supervisor's board (PRD omni-loop-34 s5), as the before/after page draws it (2.A to 2.G): the header (the owl, the
// state, the seat's meta line, an owner's seat controls), the offline notice, the Open and Done tabs, then the list (the
// kind chips, the Chat row, Needs you now and When you have a minute) beside the pane (the open finding, or the general
// thread). Every row and chip is a link: the address holds the tab, the chip, the finding and the phone's side, so the
// page is drawn whole on the server and reads itself again every 10 s. Below 900 px one side shows, behind the
// `Actions · <n>` and `Chat` switch.
//
// Who acts: a member reads the same page with no suggestion, chat box, Memory, Pause or Move (AC-11). An owner writes
// in the open thread through the chat box (in Foot, s6) and opens the Memory drawer (in SeatControls, s6); the
// suggestions' buttons and Not a problem (in the Suggested box) come with s7.

/** A sprite of @omni/design at `scale`: decoration, the words beside it say the same. */
function Sprite({ name, scale, className = 'sv-sprite' }: { name: string; scale: number; className?: string }) {
  return <span className={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: pixelSvg(spritePixels(name), { scale, title: '' }) }} />;
}

function Refresh() {
  const router = useRouter();
  useEffect(() => poll(() => { router.refresh(); return Promise.resolve(true); }, document, SUPERVISOR_REFRESH_MS), [router]);
  return null;
}

function Head({ header, data }: { header: Header; data: SupervisorData }) {
  return (
    <header className="sv-head">
      <span className="sv-face" data-state={header.state}>
        <Sprite name="menu-supervisor" scale={2} />
        <span className="sv-live" />
      </span>
      <div className="sv-who">
        <h1 className="sv-name">Supervisor <span className="sv-state" data-state={header.state}><i aria-hidden="true" />{header.label}</span></h1>
        <p className="sv-meta">
          {header.meta.map((meta, n) => (
            <span key={n}>{meta.before ? `${meta.before} ` : ''}{meta.value !== undefined && <b>{meta.value}</b>}{meta.after ? `${meta.value === undefined ? '' : ' '}${meta.after}` : ''}</span>
          ))}
        </p>
        <p className="sv-short">{header.short}</p>
      </div>
      {data.owner
        ? data.seat && <SeatControls workspace={data.workspace} paused={data.seat.paused} dailyTokens={data.seat.dailyTokens} notes={data.notes} />
        : <p className="sv-readonly">Read only · owners act</p>}
    </header>
  );
}

function SeatNotice({ header, owner }: { header: Header; owner: boolean }) {
  if (header.state === 'none') {
    return (
      <div className="sv-notice" role="status">
        <b>No Supervisor seat yet.</b>
        <span>{owner ? 'Place it on one of your runners, on the Runners page.' : 'A workspace owner places it on a runner.'}</span>
        {owner && <span className="sv-notice-end"><Button size="sm" href={RUNNERS_PATH}>Open Runners</Button></span>}
      </div>
    );
  }
  if (header.offline === null) return null;
  return (
    <div className="sv-notice" data-tone="danger" role="status">
      <b>{header.offline}</b>
      <span>Checks still run.</span>
      {owner && <span className="sv-notice-end"><Button size="sm" href={RUNNERS_PATH}>Move the seat</Button></span>}
    </div>
  );
}

function RowLink({ row, query, current }: { row: Row; query: Query; current: boolean }) {
  return (
    <Link className="sv-row" href={hrefOf(query, { finding: row.id, view: 'list' })} aria-current={current ? 'true' : undefined} scroll={false}>
      <span className="sv-sev" data-severity={row.severity} aria-hidden="true" />
      <Sprite name={row.sprite} scale={1} />
      <span className="sv-row-main">
        <span className="sv-ctx">{row.context}</span>
        <span className="sv-title">{row.title}</span>
        <span className="sv-line">{row.line}</span>
      </span>
      <span className="sv-end">
        <span className="sv-age" data-late={row.late || undefined}>{row.age}</span>
        {row.ended !== null ? <Badge>{row.ended}</Badge> : row.severity === 'high' && <Badge tone="danger">High</Badge>}
      </span>
    </Link>
  );
}

function ChatRow({ data, query, current }: { data: SupervisorData; query: Query; current: boolean }) {
  const last = lastSaid(data.chat);
  return (
    <Link className="sv-row" href={hrefOf(query, { finding: null, view: 'chat' })} aria-current={current ? 'true' : undefined} scroll={false}>
      <span className="sv-sev" aria-hidden="true" />
      <Sprite name="menu-supervisor" scale={1} />
      <span className="sv-row-main">
        <span className="sv-ctx">Chat</span>
        <span className="sv-title">Ask the Supervisor anything</span>
        <span className="sv-line">{last.line}</span>
      </span>
      <span className="sv-end">{last.at !== null && <span className="sv-age">{last.at}</span>}</span>
    </Link>
  );
}

function List({ data, query, opened }: { data: SupervisorData; query: Query; opened: Finding | null }) {
  const findings = query.tab === 'open' ? data.open : data.done;
  const sections = sectionsOf(query.tab, findings, query.kind, data.now);
  const chips = chipsOf(findings).map((chip) => ({ id: chip.id, label: chip.label, count: String(chip.count), href: hrefOf(query, { kind: chip.id, finding: null }) }));
  return (
    <div className="sv-list">
      <div className="sv-chips"><SegmentedControl label="Kind" variant="pills" size="sm" value={query.kind} options={chips} link={Link} /></div>
      <ChatRow data={data} query={query} current={opened === null} />
      {sections.map((section) => (
        <section key={section.id} className="sv-section" aria-labelledby={`sv-${section.id}`}>
          <h2 className="sv-section-title" id={`sv-${section.id}`}>{section.title} <span className="sv-count">{section.rows.length}</span></h2>
          {section.rows.map((row) => <RowLink key={row.id} row={row} query={query} current={opened?.id === row.id} />)}
        </section>
      ))}
      {sections.length === 0 && (query.tab === 'open'
        ? <EmptyState size="inline" title="All quiet.">Nothing needs you. The Supervisor keeps watching.</EmptyState>
        : <EmptyState size="inline" title="Nothing done yet.">A finding comes here once an owner acts on it, dismisses it, or its cause is gone.</EmptyState>)}
    </div>
  );
}

function Thread({ said }: { said: readonly Said[] }) {
  return (
    <ol className="sv-thread">
      {said.map((one) => (
        <li key={one.id} className="sv-msg">
          <span className="sv-msg-face" aria-hidden="true">{one.agent ? <Sprite name="menu-supervisor" scale={1} /> : one.who.charAt(0).toUpperCase()}</span>
          <div className="sv-msg-body">
            <p className="sv-msg-who"><b>{one.who}</b>{one.agent && ' · agent'} <span className="sv-msg-at">{one.at}</span></p>
            {one.paragraphs.map((paragraph, n) => <p key={n} className="sv-msg-text">{paragraph}</p>)}
            {one.remembered !== null && <p className="sv-memref">Remembered: “{one.remembered}”</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** What closes the pane: the owner's box (s6, ../chat/), writing in this thread; a member is told who writes. */
function Foot({ data, finding }: { data: SupervisorData; finding: string | null }) {
  return data.owner
    ? <ChatBox workspace={data.workspace} finding={finding} state={headerOf(data.seat, data.runner, data.now).state} />
    : <p className="sv-fine">Only workspace owners write to the Supervisor.</p>;
}

function FindingPane({ finding, data }: { finding: Finding; data: SupervisorData }) {
  const check = checkOf(finding.checkLine);
  const evidence = evidenceOf(finding.evidence);
  const suggestions = suggestionsOf(finding);
  const thread = threadOf(finding, data.thread);
  const open = finding.state === 'open';
  return (
    <>
      <div className="sv-pane-head">
        <div>
          <span className="sv-ctx">{KIND_LABEL[finding.kind]}</span>
          <h2 className="sv-pane-title">{finding.title}</h2>
        </div>
        <div className="sv-pills">
          <Badge tone={finding.severity === 'high' ? 'danger' : 'neutral'}>{finding.severity === 'high' ? 'High' : 'Medium'}</Badge>
          <Badge>{spanWords(Date.parse(data.now) - Date.parse(finding.createdAt))}</Badge>
        </div>
      </div>
      {data.owner && open && suggestions.length > 0 && (
        <section className="sv-suggested" aria-label="Suggested">
          <b>Suggested</b>
          <ul className="sv-suggestions">{suggestions.map((label) => <li key={label}>{label}</li>)}</ul>
        </section>
      )}
      <section className="sv-box" data-check={check.fired || undefined} aria-label="The check that fired">
        <p className="sv-box-label">The check that fired</p>
        <p className="sv-check"><b>{check.name}</b>{check.figures.map((figure) => <span key={figure} className="sv-figure">{figure}</span>)}</p>
      </section>
      {evidence.length > 0 && (
        <section className="sv-box" aria-label="Evidence">
          <p className="sv-box-label">Evidence</p>
          <ul className="sv-evidence">{evidence.map((line, n) => <li key={n}>{line}</li>)}</ul>
        </section>
      )}
      {finding.lookedAt === null
        ? <p className="sv-quiet-notice">No Supervisor look yet.</p>
        : <Thread said={thread} />}
      <Foot data={data} finding={finding.id} />
    </>
  );
}

function ChatPane({ data }: { data: SupervisorData }) {
  const said = chatOf(data.chat);
  return (
    <>
      <div className="sv-pane-head">
        <div>
          <span className="sv-ctx">General thread · read by every member</span>
          <h2 className="sv-pane-title">Chat with the Supervisor</h2>
        </div>
      </div>
      {said.length > 0
        ? <Thread said={said} />
        : <EmptyState size="inline" title="No message yet.">The Supervisor&rsquo;s answers to the owners&rsquo; questions come here.</EmptyState>}
      <Foot data={data} finding={null} />
    </>
  );
}

export function SupervisorBoard({ data, query }: { data: SupervisorData; query: Query }): ReactNode {
  const header = headerOf(data.seat, data.runner, data.now);
  const opened = openFinding(data, query.finding);
  const side = phoneSide(query, opened !== null);
  return (
    <div className="sv">
      <Refresh />
      <Head header={header} data={data} />
      <SeatNotice header={header} owner={data.owner} />
      <Tabs label="Findings" current={query.tab} link={Link} filledCount items={[
        { id: 'open', label: 'Open', href: hrefOf(query, { tab: 'open', kind: 'all', finding: null }), count: String(data.open.length) },
        { id: 'done', label: 'Done', href: hrefOf(query, { tab: 'done', kind: 'all', finding: null }), count: String(data.done.length) },
      ]} />
      <div className="sv-phone">
        <SegmentedControl label="Show" value={side === 'list' ? 'list' : 'chat'} link={Link} options={[
          { id: 'list', label: `Actions · ${String(data.open.length)}`, href: hrefOf(query, { finding: null, view: 'list' }) },
          { id: 'chat', label: 'Chat', href: hrefOf(query, { finding: null, view: 'chat' }) },
        ]} />
      </div>
      <div className="sv-split" data-side={side}>
        <List data={data} query={query} opened={opened} />
        <div className="sv-pane">{opened ? <FindingPane finding={opened} data={data} /> : <ChatPane data={data} />}</div>
      </div>
    </div>
  );
}
