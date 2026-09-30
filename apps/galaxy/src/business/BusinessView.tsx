import type { FormEvent, ReactNode } from 'react';
import {
  BLANK, chipLabel, citationLine, confirmed, displayId, hasProducts, isPicked, KIND_LABEL, KIND_ORDER, OFFERINGS, othersOf, REGIONS,
  sentence, SIZE_STOPS, sizeLabel, sizeOf, sizeValue, SOURCE_LABEL, TRADES, valueLabel, viewClaims,
  type BusinessState, type Claim, type ClaimKind,
} from './model';

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

export interface BusinessHandlers {
  /** A chip: on when off, off when on. */
  tap(kind: ClaimKind, value: string): void;
  /** A typed value, from Other or "+ add a rival". */
  pick(kind: ClaimKind, value: string): void;
  type(kind: ClaimKind): void;
  untype(): void;
  sizeDraft(stops: [number, number]): void;
  sizeCommit(): void;
  confirm(claim: Claim): void;
  reject(claim: Claim): void;
  skip(): void;
  unskip(): void;
  /** "+ Add a product": opens its name field (PRD 748 s4). */
  openProduct(): void;
  closeProduct(): void;
  addProduct(name: string): void;
  /** A product's tab. */
  showProduct(id: string): void;
}

const IDLE: BusinessHandlers = {
  tap() {}, pick() {}, type() {}, untype() {}, sizeDraft() {}, sizeCommit() {}, confirm() {}, reject() {}, skip() {}, unskip() {},
  openProduct() {}, closeProduct() {}, addProduct() {}, showProduct() {},
};

export const SKIP = 'Skip — agents work without it';
export const SKIPPED = 'Skipped. Nothing was stored: agents carry on without it.';
export const ADD_RIVAL = '+ add a rival';
export const TRY_LINE = 'omni business show';
/** The one text that names products while there is one: the button that adds the second. */
export const ADD_PRODUCT = '+ Add a product';
export const PRODUCT_NAME = 'The product’s name';

export interface BusinessViewProps {
  state: BusinessState;
  /** The demo: sample claims, changed only in the page. */
  demo?: boolean;
  on?: BusinessHandlers;
}

function Sentence({ claims }: { claims: readonly Claim[] }) {
  return (
    <h1 id="business-title" className="business-sentence">
      {sentence(claims).map((part, i) =>
        'text' in part
          ? <span key={i}>{part.text}</span>
          : part.filled === null
            ? <span key={i} className="business-blank" data-blank={part.blank}>{BLANK}</span>
            : <span key={i} className="business-filled" data-blank={part.blank}>{part.filled}</span>)}
    </h1>
  );
}

function TypeField({ kind, label, busy, on }: { kind: ClaimKind; label: string; busy: boolean; on: BusinessHandlers }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('value') ?? '').trim();
    if (value) on.pick(kind, value);
  };
  return (
    <form className="business-type" onSubmit={submit}>
      <label>
        <span className="business-type-label">{label}</span>
        <input name="value" type="text" maxLength={80} required autoFocus autoComplete="off" disabled={busy} />
      </label>
      <button type="submit" className="ask-button" disabled={busy}>Add</button>
      <button type="button" className="ask-button quiet" onClick={on.untype} disabled={busy}>Cancel</button>
    </form>
  );
}

function Chip({ pressed, busy, onClick, children }: { pressed: boolean; busy: boolean; onClick(): void; children: ReactNode }) {
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
          <Chip key={value} pressed={isPicked(state.claims, kind, value)} busy={state.busy} onClick={() => on.tap(kind, value)}>{chipLabel(value)}</Chip>
        ))}
        {extra.map((c) => (
          <Chip key={c.id} pressed busy={state.busy} onClick={() => on.tap(kind, c.value)}>{chipLabel(c.value)}</Chip>
        ))}
        {state.typing !== kind && <Chip pressed={false} busy={state.busy} onClick={() => on.type(kind)}>Other</Chip>}
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
      <div className="business-slider" style={{ ['--lo' as string]: lo / last, ['--hi' as string]: hi / last }}>
        {handle('lo', lo, 'Smallest customer')}
        {handle('hi', hi, 'Largest customer')}
      </div>
      <ol className="business-stops" aria-hidden="true">{SIZE_STOPS.map((s) => <li key={s}>{s}</li>)}</ol>
    </div>
  );
}

/** A rival the small model guessed (PRD 748 s3): dashed, marked "guess", out of the sentence until ✓. */
function Guess({ claim, busy, on }: { claim: Claim; busy: boolean; on: BusinessHandlers }) {
  return (
    <span className="business-guess" data-claim={displayId(claim)}>
      <span className="business-guess-name">{claim.value}</span>
      <span className="business-guess-tag">guess</span>
      <button type="button" className="business-right" aria-label={`Right: ${claim.value}`} onClick={() => on.confirm(claim)} disabled={busy}>✓ Right</button>
      <button type="button" className="business-wrong" aria-label={`Wrong: ${claim.value}`} onClick={() => on.reject(claim)} disabled={busy}>✗ Wrong</button>
    </span>
  );
}

function Rivals({ state, on }: { state: BusinessState; on: BusinessHandlers }) {
  const rivals = confirmed(state.claims).filter((c) => c.kind === 'rival');
  const guesses = state.claims.filter((c) => c.kind === 'rival' && c.state === 'proposed').sort((a, b) => a.seq - b.seq);
  return (
    <div className="business-group" role="group" aria-labelledby="business-rival-title" data-kind="rival">
      <h2 id="business-rival-title">Up against</h2>
      <div className="business-chips">
        {rivals.map((c) => <Chip key={c.id} pressed busy={state.busy} onClick={() => on.tap('rival', c.value)}>{c.value}</Chip>)}
        {guesses.map((c) => <Guess key={c.id} claim={c} busy={state.busy} on={on} />)}
        {state.typing !== 'rival' && <Chip pressed={false} busy={state.busy} onClick={() => on.type('rival')}>{ADD_RIVAL}</Chip>}
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
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('name') ?? '').trim();
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
            onClick={() => on.showProduct(p.id)}
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
        <span className="business-source">{SOURCE_LABEL[claim.source]}</span>
        <span className="business-cited">{citationLine(claim)}</span>
      </div>
      <div className="business-verdict">
        <button type="button" className="business-right" aria-pressed={claim.state === 'confirmed'} aria-label={`Right: ${value}`} onClick={() => on.confirm(claim)} disabled={busy || claim.state === 'confirmed'}>✓</button>
        <button type="button" className="business-wrong" aria-pressed={claim.state === 'rejected'} aria-label={`Wrong: ${value}`} onClick={() => on.reject(claim)} disabled={busy || claim.state === 'rejected'}>✗</button>
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

export function BusinessView({ state: whole, demo = false, on = IDLE }: BusinessViewProps) {
  // Everything below reads the tab's claims: every claim while there is one product.
  const multi = hasProducts(whole.products);
  const state = { ...whole, claims: viewClaims(whole.claims, whole.products, whole.current) };
  const sure = confirmed(state.claims);
  const listedRows = state.claims.filter((c) => c.state !== 'rejected').sort(byOrder);
  const wrong = state.claims.filter((c) => c.state === 'rejected').sort(byOrder);
  return (
    <div className="ask-col business">
      {multi && !state.skipped && (
        <section className="ask-card business-region" aria-label="Shared by every product">
          <ChipGroup kind="region" title="Region · shared by every product" list={REGIONS} state={state} on={on} />
        </section>
      )}
      {multi && <ProductTabs state={state} on={on} />}
      <section className="ask-card business-head" aria-labelledby="business-title">
        <p className="business-kicker">
          <span className="ask-chip">Business</span>
          <span className="ask-chip">{sure.length === 0 ? 'Empty' : `${sure.length} confirmed`}</span>
          {demo && <span className="ask-chip">Demo</span>}
        </p>
        <Sentence claims={state.claims} />
        {state.refusal && <p className="business-refusal" role="alert">{state.refusal}</p>}
        {state.skipped
          ? (
            <div className="business-skip">
              <p className="ask-muted">{SKIPPED}</p>
              <button type="button" className="ask-button quiet" onClick={on.unskip}>Pick now</button>
            </div>
          )
          : (
            <div className="business-skip">
              <button type="button" className="ask-button quiet" onClick={on.skip} disabled={state.busy}>{SKIP}</button>
              <span className="ask-muted">Skip stores nothing.</span>
            </div>
          )}
      </section>

      {!state.skipped && <Picks state={state} region={!multi} on={on} />}

      {listedRows.length > 0 && (
        <section className="business-claims" aria-label="The claims agents read">
          <ul>{listedRows.map((c) => <Row key={c.id} claim={c} busy={state.busy} on={on} />)}</ul>
        </section>
      )}

      {wrong.length > 0 && (
        <details className="business-wrong-list">
          <summary>Marked wrong · {wrong.length}</summary>
          <ul>{wrong.map((c) => <Row key={c.id} claim={c} busy={state.busy} on={on} />)}</ul>
        </details>
      )}

      {sure.length > 0 && <Payoff claims={sure} />}

      {!multi && (
        <section className="business-more" aria-label="Sell something else">
          <AddProduct state={state} on={on} />
        </section>
      )}
    </div>
  );
}
