import type { ReactNode, SubmitEvent } from 'react';
import {
  BLANK, chipLabel, citationLine, confirmed, displayId, hasProducts, isPicked, KIND_LABEL, KIND_ORDER, maxValue, OFFERINGS, othersOf, REGIONS,
  sentence, SIZE_STOPS, sizeLabel, sizeOf, sizeValue, sourceLabel, TRADES, valueLabel, viewClaims,
  type Claim, type ClaimKind, type SentencePart,
} from './model';
import type { BusinessState } from './state';
import {
  foundRows, isFound, MAX_PAGES, pagesLeft, receiptLabel, revealOf, scanLine, sourcesUsed, thinkSentence,
  type Mark, type Reveal, type WebPage,
} from './reveal';
import { additionText, checkIds, checkRows, seenSince, type CheckRow } from './check';
import { cssVars } from '../arcade/css-vars';

// Settings → Business drawn from its state (PRD 748 s2). The title is the sentence the confirmed
// claims write, with a blank for each kind still empty. Below it, Skip (which stores nothing and folds
// the picks away) and the picks: offering and trade chips, a two-handle size slider, region toggles,
// and the rivals, each list ending in Other; Other and "+ add a rival" are the only fields a person
// types in. Then one row per claim, with its id, its source, how often agents cited it and ✓ / ✗; the
// claims marked wrong, folded; and the payoff card, what the next think-big will cite. Drawn on the
// server first; BusinessPage.tsx wires the handlers.
//
// Products (PRD 748 s4): while the business has one, the page never mentions products but for the
// one "+ Add a product" button at its foot. From the second on, the region is drawn once above one tab
// per product, and everything else (the sentence, the picks, the rows, the payoff card) is the
// selected tab's.
//
// The draft (PRD 774 s3): Draft from my repos and "+ add a web page" (three at most, the only thing
// typed) sit under the title on the empty and the filled page. While a draft runs, the scan lists each
// source as read or skipped. What it found waits as proposed rows: the title types itself as "We think
// you sell …" with them in it, over a Sources used line and a Nothing saved yet pill; What we found
// shows one row each, with a receipt chip per quote (tap or hover shows it) and ✓ Right / ✗ Wrong,
// kept in the page; the dock's That's us saves them all, confirming every row not marked ✗. Then the
// page reads as the filled page with the saved line. One row found is thin evidence ("We found only 1
// thing"), none is "Nothing we could quote — pick instead"; the picks follow either way.
//
// What the weekly recheck found (PRD 774 s4) sits on top of the page, above the sentence, until someone
// answers it (./check.ts): a replacement ("~~ERP~~ → CRM") and an addition ("Region: Belgium → Belgium
// + France"), each with its receipts and ✓ Right / ✗ Wrong, saved at once; then each faded claim,
// dimmed, "not seen since 12 Aug", with ✓ Still true and ✗ Wrong. Those rows leave the list below.
// PRD 822: a claim a person answered in a skill run and left proposed (an overrule saved as a claim) waits
// there too, between the additions and the faded claims, "answered in a run", with ✓ Right and ✗ Wrong.
//
// The Constituents panel (PRD 871 s2, ./ConstituentsPanel.tsx) sits above the claims, the tab's
// product's own: its Statement and its Never list, which only an owner changes. A Never line is no
// claim any more: the claim editor offers no Never kind, and a claim of kind `never` (one the move left
// rejected, or one a draft once proposed) is not drawn at all.
//
// The Personas section (PRD 799 s3, ./PersonasSection.tsx) follows the claims, the tab's own.

export interface BusinessHandlers {
  /** A chip: on when off, off when on. */
  tap: (kind: ClaimKind, value: string) => void;
  /** A typed value, from Other or "+ add a rival". */
  pick: (kind: ClaimKind, value: string) => void;
  type: (kind: ClaimKind) => void;
  untype: () => void;
  sizeDraft: (stops: [number, number]) => void;
  sizeCommit: () => void;
  confirm: (claim: Claim) => void;
  reject: (claim: Claim) => void;
  skip: () => void;
  unskip: () => void;
  /** "+ Add a product": opens its name field (PRD 748 s4). */
  openProduct: () => void;
  closeProduct: () => void;
  addProduct: (name: string) => void;
  /** A product's tab. */
  showProduct: (id: string) => void;
  /** Draft from my repos (PRD 774 s3). */
  draft: () => void;
  /** ✓ Right or ✗ Wrong on a found row, kept in the page until That's us. */
  mark: (claim: Claim, mark: Mark) => void;
  thatsUs: () => void;
  /** "+ add a web page": opens its address field. */
  openPage: () => void;
  closePage: () => void;
  addPage: (url: string) => void;
  removePage: (page: WebPage) => void;
  /** ✓ Right (`right`) or ✗ Wrong on a replacement or an addition the recheck left (PRD 774 s4). */
  settle: (claim: Claim, right: boolean) => void;
  /** ✓ Still true on a faded claim. */
  stillTrue: (claim: Claim) => void;
}

const IDLE: BusinessHandlers = {
  tap() {}, pick() {}, type() {}, untype() {}, sizeDraft() {}, sizeCommit() {}, confirm() {}, reject() {}, skip() {}, unskip() {},
  openProduct() {}, closeProduct() {}, addProduct() {}, showProduct() {},
  draft() {}, mark() {}, thatsUs() {}, openPage() {}, closePage() {}, addPage() {}, removePage() {},
  settle() {}, stillTrue() {},
};

export const SKIP = 'Skip — agents work without it';
export const SKIPPED = 'Skipped. Nothing was stored: agents carry on without it.';
export const ADD_RIVAL = '+ add a rival';
export const TRY_LINE = 'omni business show';
/** The one text that names products while there is one: the button that adds the second. */
export const ADD_PRODUCT = '+ Add a product';
export const PRODUCT_NAME = 'The product’s name';
// The draft (PRD 774 s3).
export const DRAFT = 'Draft from my repos';
export const DRAFTING = 'Drafting…';
export const ADD_PAGE = '+ add a web page';
const PAGE_ADDRESS = 'A web page’s address: pricing, home or about';
export const PAGES_FULL = 'Three web pages at most: remove one to add another.';
export const NOTHING_SAVED = 'Nothing saved yet';
export const DOCK = 'Rows you leave alone are confirmed with “That’s us”.';
export const THATS_US = '✓ That’s us';
export const SAVED_LINE = '✓ Saved. Every agent reads these from the next run.';
export const THIN_HINT = 'Your READMEs say what the code does, not who buys it. A pricing or home page usually says more.';
export const NOTHING_FOUND = 'Nothing we could quote — pick instead';
export const NOTHING_NEW = 'Nothing new: everything we could quote is already on this page.';
// What the recheck found (PRD 774 s4).
export const CHECK_TITLE = 'To check · what changed since you last looked';
export const STILL_TRUE = '✓ Still true';
/** What an answer to check says after its value (PRD 822): someone gave it in a skill run. */
export const ANSWERED = 'answered in a run';

export interface BusinessViewProps {
  state: BusinessState;
  /** The demo: sample claims, changed only in the page. */
  demo?: boolean;
  on?: BusinessHandlers;
  /** What "eight weeks ago" is counted from (PRD 774 s4); now, left out. */
  now?: number;
  /** The Personas section (PRD 799 s3), drawn below the claims of the tab shown. */
  personas?: ReactNode;
  /** The Constituents panel (PRD 871 s2), drawn above the claims of the tab shown. */
  constituents?: ReactNode;
}

function Sentence({ parts, typing = false }: { parts: readonly SentencePart[]; typing?: boolean }) {
  return (
    <h1 id="business-title" className={typing ? 'business-sentence business-typing' : 'business-sentence'}>
      {parts.map((part, i) =>
        'text' in part
          ? <span key={i}>{part.text}</span>
          : part.filled === null
            ? <span key={i} className="business-blank" data-blank={part.blank}>{BLANK}</span>
            : <span key={i} className="business-filled" data-blank={part.blank}>{part.filled}</span>)}
    </h1>
  );
}

/** A text field of a submitted form, trimmed; '' when it is missing (no form here holds a file). */
function fieldText(form: HTMLFormElement, name: string): string {
  const value = new FormData(form).get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function TypeField({ kind, label, busy, on }: { kind: ClaimKind; label: string; busy: boolean; on: BusinessHandlers }) {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = fieldText(event.currentTarget, 'value');
    if (value) on.pick(kind, value);
  };
  return (
    <form className="business-type" onSubmit={submit}>
      <label>
        <span className="business-type-label">{label}</span>
        <input name="value" type="text" maxLength={maxValue(kind)} required autoFocus autoComplete="off" disabled={busy} />
      </label>
      <button type="submit" className="ask-button" disabled={busy}>Add</button>
      <button type="button" className="ask-button quiet" onClick={on.untype} disabled={busy}>Cancel</button>
    </form>
  );
}

function Chip({ pressed, busy, onClick, children }: { pressed: boolean; busy: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" className="business-chip" aria-pressed={pressed} onClick={onClick} disabled={busy}>{children}</button>;
}

function ChipGroup({ kind, title, list, state, on }: { kind: ClaimKind; title: string; list: readonly string[]; state: BusinessState; on: BusinessHandlers }) {
  const id = `business-${kind}-title`;
  const extra = othersOf(state.claims, kind, list);
  return (
    <div className="business-group" role="group" aria-labelledby={id} data-kind={kind}>
      <h2 id={id}>{title}</h2>
      <div className="business-chips">
        {list.map((value) => (
          <Chip key={value} pressed={isPicked(state.claims, kind, value)} busy={state.busy} onClick={() => { on.tap(kind, value); }}>{chipLabel(value)}</Chip>
        ))}
        {extra.map((c) => (
          <Chip key={c.id} pressed busy={state.busy} onClick={() => { on.tap(kind, c.value); }}>{chipLabel(c.value)}</Chip>
        ))}
        {state.typing !== kind && <Chip pressed={false} busy={state.busy} onClick={() => { on.type(kind); }}>Other</Chip>}
      </div>
      {state.typing === kind && <TypeField kind={kind} label={`Your ${KIND_LABEL[kind].toLowerCase()}`} busy={state.busy} on={on} />}
    </div>
  );
}

function SizeSlider({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  const rest = sizeOf(state.claims);
  const [lo, hi] = state.sizeDraft ?? rest.stops;
  const said = state.sizeDraft || rest.picked ? `${sizeLabel(sizeValue([lo, hi]))} people` : 'not picked';
  const last = SIZE_STOPS.length - 1;
  const handle = (which: 'lo' | 'hi', value: number, label: string) => (
    <input
      type="range"
      className={`business-handle business-handle-${which}`}
      min={0}
      max={last}
      step={1}
      value={value}
      aria-label={label}
      aria-valuetext={`${SIZE_STOPS[value]} people`}
      disabled={state.busy}
      onChange={(e) => {
        const v = Number(e.currentTarget.value);
        on.sizeDraft(which === 'lo' ? [v, Math.max(v, hi)] : [Math.min(lo, v), v]);
      }}
      onPointerUp={on.sizeCommit}
      onKeyUp={on.sizeCommit}
    />
  );
  return (
    <div className="business-group" role="group" aria-labelledby="business-size-title" data-kind="size">
      <h2 id="business-size-title">Customer size · <span className="business-size-said">{said}</span></h2>
      <div className="business-slider" style={cssVars({ '--lo': lo / last, '--hi': hi / last })}>
        {handle('lo', lo, 'Smallest customer')}
        {handle('hi', hi, 'Largest customer')}
      </div>
      <ol className="business-stops" aria-hidden="true">
        {SIZE_STOPS.map((s, i) => (
          <li key={s} style={cssVars({ '--at': i / last })} data-end={i === lo || i === hi ? '' : undefined}>{s}</li>
        ))}
      </ol>
    </div>
  );
}

/** A rival the small model guessed (PRD 748 s3): dashed, marked "guess", out of the sentence until ✓. */
function Guess({ claim, busy, on }: { claim: Claim; busy: boolean; on: BusinessHandlers }) {
  return (
    <span className="business-guess" data-claim={displayId(claim)}>
      <span className="business-guess-name">{claim.value}</span>
      <span className="business-guess-tag">guess</span>
      <button type="button" className="business-right" aria-label={`Right: ${claim.value}`} onClick={() => { on.confirm(claim); }} disabled={busy}>✓ Right</button>
      <button type="button" className="business-wrong" aria-label={`Wrong: ${claim.value}`} onClick={() => { on.reject(claim); }} disabled={busy}>✗ Wrong</button>
    </span>
  );
}

function Rivals({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  const rivals = confirmed(state.claims).filter((c) => c.kind === 'rival');
  // An answered rival waits on top with the rows to check (./check.ts), never as a guess.
  const guesses = state.claims.filter((c) => c.kind === 'rival' && c.state === 'proposed' && c.source !== 'evidence' && c.source !== 'answer').sort((a, b) => a.seq - b.seq);
  return (
    <div className="business-group" role="group" aria-labelledby="business-rival-title" data-kind="rival">
      <h2 id="business-rival-title">Up against</h2>
      <div className="business-chips">
        {rivals.map((c) => <Chip key={c.id} pressed busy={state.busy} onClick={() => { on.tap('rival', c.value); }}>{c.value}</Chip>)}
        {guesses.map((c) => <Guess key={c.id} claim={c} busy={state.busy} on={on} />)}
        {state.typing !== 'rival' && <Chip pressed={false} busy={state.busy} onClick={() => { on.type('rival'); }}>{ADD_RIVAL}</Chip>}
      </div>
      {state.typing === 'rival' && <TypeField kind="rival" label="A rival’s name" busy={state.busy} on={on} />}
    </div>
  );
}

/** The picks; with products, the region is drawn once above the tabs instead. */
function Picks({ state, region, on }: { state: BusinessState; region: boolean; on: BusinessHandlers }) {
  return (
    <section className="ask-card business-picks" aria-label="Pick">
      <ChipGroup kind="offering" title="What you sell" list={OFFERINGS} state={state} on={on} />
      <SizeSlider state={state} on={on} />
      <ChipGroup kind="trade" title="Trade" list={TRADES} state={state} on={on} />
      {region && <ChipGroup kind="region" title="Region" list={REGIONS} state={state} on={on} />}
      <Rivals state={state} on={on} />
    </section>
  );
}

function ProductField({ busy, on }: { busy: boolean; on: BusinessHandlers }) {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = fieldText(event.currentTarget, 'name');
    if (value) on.addProduct(value);
  };
  return (
    <form className="business-type" onSubmit={submit}>
      <label>
        <span className="business-type-label">{PRODUCT_NAME}</span>
        <input name="name" type="text" maxLength={80} required autoFocus autoComplete="off" disabled={busy} />
      </label>
      <button type="submit" className="ask-button" disabled={busy}>Add</button>
      <button type="button" className="ask-button quiet" onClick={on.closeProduct} disabled={busy}>Cancel</button>
    </form>
  );
}

function AddProduct({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  return state.adding
    ? <ProductField busy={state.busy} on={on} />
    : <button type="button" className="ask-button quiet business-add-product" onClick={on.openProduct} disabled={state.busy}>{ADD_PRODUCT}</button>;
}

/** One tab per product, then "+ Add a product" (PRD 748 s4). */
function ProductTabs({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  return (
    <div className="business-products-bar">
      <div className="business-products" role="tablist" aria-label="Products">
        {state.products.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            className="business-product-tab"
            aria-selected={p.id === state.current}
            onClick={() => { on.showProduct(p.id); }}
            disabled={state.busy}
          >
            {p.name}
          </button>
        ))}
        {!state.adding && <AddProduct state={state} on={on} />}
      </div>
      {state.adding && <ProductField busy={state.busy} on={on} />}
    </div>
  );
}

function Row({ claim, busy, on }: { claim: Claim; busy: boolean; on: BusinessHandlers }) {
  const value = valueLabel(claim);
  return (
    <li className="business-row" data-claim={displayId(claim)} data-state={claim.state}>
      <div className="business-row-main">
        <span className="business-kind">{KIND_LABEL[claim.kind]}</span>
        <strong>{value}</strong>
      </div>
      <div className="business-row-meta">
        <code>{displayId(claim)}</code>
        <span className="business-source">{sourceLabel(claim)}</span>
        <span className="business-cited">{citationLine(claim)}</span>
      </div>
      <div className="business-verdict">
        <button type="button" className="business-right" aria-pressed={claim.state === 'confirmed'} aria-label={`Right: ${value}`} onClick={() => { on.confirm(claim); }} disabled={busy || claim.state === 'confirmed'}>✓</button>
        <button type="button" className="business-wrong" aria-pressed={claim.state === 'rejected'} aria-label={`Wrong: ${value}`} onClick={() => { on.reject(claim); }} disabled={busy || claim.state === 'rejected'}>✗</button>
      </div>
    </li>
  );
}

const byOrder = (a: Claim, b: Claim) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.seq - b.seq;

function Payoff({ claims }: { claims: readonly Claim[] }) {
  return (
    <section className="ask-card business-payoff" aria-labelledby="business-payoff-title">
      <h2 id="business-payoff-title">Saved · read by every agent from the next run</h2>
      <p>Next think-big will cite:</p>
      <ul className="business-cites">
        {claims.map((c) => <li key={c.id}><code>{displayId(c)}</code> {valueLabel(c)}</li>)}
      </ul>
      <pre className="business-try"><code>$ {TRY_LINE}</code></pre>
      <p className="ask-muted">Try it in any tracked repository.</p>
    </section>
  );
}

// ── The draft (PRD 774 s3) ───────────────────────────────────────────────────────

function Scan({ draft }: { draft: NonNullable<BusinessState['draft']> }) {
  return (
    <section className="business-scan" aria-label="Sources read" aria-live="polite">
      {draft.state === 'running' && <p className="ask-muted">Reading your sources…</p>}
      <ul>{draft.scanned.map((s, i) => <li key={i} data-state={s.state}>{scanLine(s)}</li>)}</ul>
    </section>
  );
}

/** What the draft came to, in one line, above the picks. */
function RevealLine({ reveal }: { reveal: Reveal }) {
  switch (reveal.kind) {
    case 'thin':
      return (
        <div className="business-reveal-line">
          <p><strong>We found only {reveal.found} {reveal.found === 1 ? 'thing' : 'things'}.</strong></p>
          <p className="ask-muted">{THIN_HINT}</p>
        </div>
      );
    case 'nothing':
      return <p className="business-reveal-line"><strong>{NOTHING_FOUND}</strong></p>;
    case 'known':
      return <p className="business-reveal-line ask-muted">{NOTHING_NEW}</p>;
    case 'saved':
      return <p className="business-reveal-line business-saved">{SAVED_LINE}</p>;
    case 'failed':
      return <p className="business-refusal" role="alert">{reveal.reason}</p>;
    case 'none':
    case 'scan':
    case 'reveal':
      return null;
  }
}

const pageName = (url: string) => url.replace(/^https:\/\//i, '').replace(/\/$/, '');

function PageField({ busy, on }: { busy: boolean; on: BusinessHandlers }) {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = fieldText(event.currentTarget, 'url');
    if (value) on.addPage(value);
  };
  return (
    <form className="business-page-field" onSubmit={submit}>
      <label>
        <span className="business-type-label">{PAGE_ADDRESS}</span>
        <input name="url" type="url" inputMode="url" pattern="https://.*" placeholder="https://" maxLength={2000} required autoFocus autoComplete="off" disabled={busy} />
      </label>
      <button type="submit" className="ask-button" disabled={busy}>Add</button>
      <button type="button" className="ask-button quiet" onClick={on.closePage} disabled={busy}>Cancel</button>
    </form>
  );
}

/** Draft from my repos, "+ add a web page" (three at most) and the pages pasted. */
function DraftBar({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  const running = state.draft?.state === 'running';
  const left = pagesLeft(state.pages);
  return (
    <>
      <div className="business-draft-bar">
        <button type="button" className="ask-button" onClick={on.draft} disabled={state.busy || running}>{running ? DRAFTING : DRAFT}</button>
        {!state.addingPage && (
          <button type="button" className="ask-button quiet" onClick={on.openPage} disabled={state.busy || left === 0}>
            {ADD_PAGE} ({left} of {MAX_PAGES} left)
          </button>
        )}
      </div>
      {left === 0 && <p className="ask-muted">{PAGES_FULL}</p>}
      {state.addingPage && <PageField busy={state.busy} on={on} />}
      {state.pages.length > 0 && (
        <section className="business-pages" aria-label="Web pages the draft reads">
          <ul>
            {state.pages.map((p) => (
              <li key={p.id}>
                <span>{pageName(p.url)}</span>
                <button type="button" className="business-page-remove" aria-label={`Remove ${pageName(p.url)}`} onClick={() => { on.removePage(p); }} disabled={state.busy}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function FoundRow({ claim, mark, busy, on }: { claim: Claim; mark: Mark | undefined; busy: boolean; on: BusinessHandlers }) {
  const value = valueLabel(claim);
  return (
    <li className="business-found-row" data-found={displayId(claim)} data-mark={mark}>
      <div className="business-found-main">
        <span className="business-kind">{KIND_LABEL[claim.kind]}</span>
        <strong className="business-found-value">{value}</strong>
        <Receipts claim={claim} />
      </div>
      <div className="business-found-verdict">
        <button type="button" className="business-right" aria-pressed={mark === 'right'} aria-label={`Right: ${value}`} onClick={() => { on.mark(claim, 'right'); }} disabled={busy}>✓ Right</button>
        <button type="button" className="business-wrong" aria-pressed={mark === 'wrong'} aria-label={`Wrong: ${value}`} onClick={() => { on.mark(claim, 'wrong'); }} disabled={busy}>✗ Wrong</button>
      </div>
    </li>
  );
}

function Found({ rows, state, on }: { rows: readonly Claim[]; state: BusinessState; on: BusinessHandlers }) {
  return (
    <>
      <section className="business-found ask-card" aria-labelledby="business-found-title">
        <h2 id="business-found-title">What we found</h2>
        <ul>{rows.map((c) => <FoundRow key={c.id} claim={c} mark={state.marks[c.id]} busy={state.busy} on={on} />)}</ul>
      </section>
      <section className="business-dock" aria-label="Save what we found">
        <span>{DOCK}</span>
        <button type="button" className="ask-button" onClick={on.thatsUs} disabled={state.busy}>{THATS_US}</button>
      </section>
    </>
  );
}

// ── What the recheck found (PRD 774 s4) ──────────────────────────────────────────

function Receipts({ claim }: { claim: Claim }) {
  const receipts = claim.receipts ?? [];
  if (receipts.length === 0) return null;
  return (
    <div className="business-receipts">
      {receipts.map((r, i) => (
        <details key={i} className="business-receipt" title={r.quote}>
          <summary>{receiptLabel(r)}</summary>
          <span className="business-quote">“{r.quote}”</span>
        </details>
      ))}
    </div>
  );
}

function CheckItem({ row, busy, on }: { row: CheckRow; busy: boolean; on: BusinessHandlers }) {
  const { claim } = row;
  const value = valueLabel(claim);
  let diff: ReactNode;
  let right: { label: string; aria: string; press: () => void };
  let wrong: { aria: string; press: () => void };
  if (row.kind === 'replacement') {
    const was = valueLabel(row.old);
    diff = <><s>{was}</s> → <strong>{value}</strong></>;
    right = { label: '✓ Right', aria: `Right: ${value} replaces ${was}`, press: () => { on.settle(claim, true); } };
    wrong = { aria: `Wrong: ${value} replaces ${was}`, press: () => { on.settle(claim, false); } };
  } else if (row.kind === 'addition') {
    const { from, to } = additionText(row);
    diff = <>{from} → <strong>{to}</strong></>;
    right = { label: '✓ Right', aria: `Right: add ${value}`, press: () => { on.settle(claim, true); } };
    wrong = { aria: `Wrong: add ${value}`, press: () => { on.settle(claim, false); } };
  } else if (row.kind === 'answer') {
    diff = <><strong>{value}</strong> <span className="business-check-since">{ANSWERED}</span></>;
    right = { label: '✓ Right', aria: `Right: ${value}`, press: () => { on.confirm(claim); } };
    wrong = { aria: `Wrong: ${value}`, press: () => { on.reject(claim); } };
  } else {
    diff = <><strong>{value}</strong> <span className="business-check-since">{seenSince(row.since)}</span></>;
    right = { label: STILL_TRUE, aria: `Still true: ${value}`, press: () => { on.stillTrue(claim); } };
    wrong = { aria: `Wrong: ${value}`, press: () => { on.reject(claim); } };
  }
  return (
    <li className="business-check-row" data-check={displayId(claim)} data-kind={row.kind}>
      <div className="business-check-main">
        <span className="business-kind">{KIND_LABEL[claim.kind]}</span>
        <span className="business-check-diff">{diff}</span>
        <Receipts claim={claim} />
      </div>
      <div className="business-found-verdict">
        <button type="button" className="business-right" aria-label={right.aria} onClick={right.press} disabled={busy}>{right.label}</button>
        <button type="button" className="business-wrong" aria-label={wrong.aria} onClick={wrong.press} disabled={busy}>✗ Wrong</button>
      </div>
    </li>
  );
}

function Check({ rows, busy, on }: { rows: readonly CheckRow[]; busy: boolean; on: BusinessHandlers }) {
  return (
    <section className="ask-card business-check" aria-labelledby="business-check-title">
      <h2 id="business-check-title">{CHECK_TITLE}</h2>
      <ul>{rows.map((r) => <CheckItem key={r.claim.id} row={r} busy={busy} on={on} />)}</ul>
    </section>
  );
}

function SkipLine({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  if (state.skipped) {
    return (
      <div className="business-skip">
        <p className="ask-muted">{SKIPPED}</p>
        <button type="button" className="ask-button quiet" onClick={on.unskip}>Pick now</button>
      </div>
    );
  }
  return (
    <div className="business-skip">
      <button type="button" className="ask-button quiet" onClick={on.skip} disabled={state.busy}>{SKIP}</button>
      <span className="ask-muted">Skip stores nothing.</span>
    </div>
  );
}

function Kicker({ sure, demo, thinking }: { sure: number; demo: boolean; thinking: boolean }) {
  return (
    <p className="business-kicker">
      <span className="ask-chip">Business</span>
      <span className="ask-chip">{sure === 0 ? 'Empty' : `${sure} confirmed`}</span>
      {demo && <span className="ask-chip">Demo</span>}
      {thinking && <span className="ask-chip business-unsaved">{NOTHING_SAVED}</span>}
    </p>
  );
}

/** The title card: the sentence (read with the draft's finds while they wait), the scan, and the draft's controls. */
function Head({ state, sure, demo, thinking, on }: { state: BusinessState; sure: number; demo: boolean; thinking: boolean; on: BusinessHandlers }) {
  return (
    <section className="ask-card business-head" aria-labelledby="business-title">
      <Kicker sure={sure} demo={demo} thinking={thinking} />
      {state.watched && state.draft && <Scan draft={state.draft} />}
      <Sentence parts={thinking ? thinkSentence(state.claims, state.marks) : sentence(state.claims)} typing={thinking} />
      {thinking && state.draft && <p className="business-used">Sources used: {sourcesUsed(state.draft.counts)}</p>}
      <RevealLine reveal={revealOf(state)} />
      {state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
      <DraftBar state={state} on={on} />
      <SkipLine state={state} on={on} />
    </section>
  );
}

/** The claims agents read, then the ones marked wrong, folded. */
function ClaimLists({ listed, wrong, busy, on }: { listed: readonly Claim[]; wrong: readonly Claim[]; busy: boolean; on: BusinessHandlers }) {
  return (
    <>
      {listed.length > 0 && (
        <section className="business-claims" aria-label="The claims agents read">
          <ul>{listed.map((c) => <Row key={c.id} claim={c} busy={busy} on={on} />)}</ul>
        </section>
      )}

      {wrong.length > 0 && (
        <details className="business-wrong-list">
          <summary>Marked wrong · {wrong.length}</summary>
          <ul>{wrong.map((c) => <Row key={c.id} claim={c} busy={busy} on={on} />)}</ul>
        </details>
      )}
    </>
  );
}

export function BusinessView({ state: whole, demo = false, on = IDLE, now = Date.now(), personas = null, constituents = null }: BusinessViewProps) {
  // Everything below reads the tab's claims: every claim while there is one product. A claim of kind
  // `never` is drawn nowhere (PRD 871): Never lines are the product's constituents now.
  const multi = hasProducts(whole.products);
  const state = { ...whole, claims: viewClaims(whole.claims, whole.products, whole.current).filter((c) => c.kind !== 'never') };
  const sure = confirmed(state.claims);
  // What the recheck left (PRD 774 s4) sits on top, and leaves the list below.
  const toCheck = checkRows(state.claims, now);
  const onTop = checkIds(toCheck);
  const listedRows = state.claims.filter((c) => c.state !== 'rejected' && !isFound(c) && !onTop.has(c.id)).sort(byOrder);
  const wrong = state.claims.filter((c) => c.state === 'rejected').sort(byOrder);
  // The draft's finds (PRD 774 s3): until That's us, the title reads them in.
  const found = foundRows(state.claims);
  const thinking = found.length > 0;
  return (
    <div className="ask-col business">
      {multi && !state.skipped && (
        <section className="ask-card business-region" aria-label="Shared by every product">
          <ChipGroup kind="region" title="Region · shared by every product" list={REGIONS} state={state} on={on} />
        </section>
      )}
      {multi && <ProductTabs state={state} on={on} />}
      {constituents}
      {toCheck.length > 0 && <Check rows={toCheck} busy={state.busy} on={on} />}
      <Head state={state} sure={sure.length} demo={demo} thinking={thinking} on={on} />

      {thinking && <Found rows={found} state={state} on={on} />}

      {!state.skipped && <Picks state={state} region={!multi} on={on} />}

      <ClaimLists listed={listedRows} wrong={wrong} busy={state.busy} on={on} />

      {personas}

      {sure.length > 0 && <Payoff claims={sure} />}

      {!multi && (
        <section className="business-more" aria-label="Sell something else">
          <AddProduct state={state} on={on} />
        </section>
      )}
    </div>
  );
}
