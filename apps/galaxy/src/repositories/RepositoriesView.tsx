import { hasProducts, type Product } from '../business/model';
import { addable, collectionLabel, hasNoAccess, type RepositoriesState, type RepositoryRow } from './model';

// Settings → Repositories drawn from its state (PRD 612 s1). One row per repository of the
// workspace: `owner/name`, when it was last collected, and its Tracked switch. The owner reads Add
// repository, which opens the repositories the workspace's Omni App installation can see that are not
// listed yet, one click each; a member reads the same list, read only. A repository the App cannot
// read says so, with a link to the installation's settings on GitHub, and stays tracked. A workspace
// with no installation reads a link to installing the App instead. Drawn on the server first;
// RepositoriesPage.tsx wires the handlers. Once the business has two products or more (PRD 748 s4),
// each row has a product select, any member's to change; while it has one, nothing says "Product".

/** What a member reads instead of the controls. */
export const ONLY_OWNER = 'Only @owner can change repositories.';
export const NO_ACCESS = 'Omni App has no access';
export const MISSING_ONE = 'Missing one? Give the Omni App access on GitHub →';

/** What the page knows of the workspace's Omni App installation. */
export type Access =
  | { kind: 'none'; installUrl: string | null }
  /** `reachable`: the repositories the installation can see, or null when they could not be read.
   * `settingsUrl`: where its access is changed on GitHub, or null when it is not known. */
  | { kind: 'installed'; settingsUrl: string | null; reachable: string[] | null };

export interface RepositoriesHandlers {
  pick(): void;
  close(): void;
  add(fullName: string): void;
  setTracked(fullName: string, tracked: boolean): void;
  /** A row's product select (PRD 748 s4). */
  setProduct(fullName: string, product: string): void;
}

const IDLE: RepositoriesHandlers = { pick() {}, close() {}, add() {}, setTracked() {}, setProduct() {} };

/** What the head says once each repository has a product select. */
const PRODUCTS_LINE = 'Each repository’s agents read its product’s business.';

export interface RepositoriesViewProps {
  state: RepositoriesState;
  owner: boolean;
  access: Access;
  /** The time the collection lines are read at (the server's, so both renders agree). */
  now: number;
  /** The business's products, first first (PRD 748 s4): each row has a select from the second on. */
  products?: Product[];
  on?: RepositoriesHandlers;
}

/** Which product the repository serves: any member's to change, from the business's products. */
function ProductSelect({ row, products, busy, on }: { row: RepositoryRow; products: Product[]; busy: boolean; on: RepositoriesHandlers }) {
  return (
    <span className="repositories-product-field">
      <select
        className="repositories-product"
        aria-label={`Product of ${row.fullName}`}
        value={row.product ?? ''}
        onChange={(e) => { if (e.currentTarget.value) on.setProduct(row.fullName, e.currentTarget.value); }}
        disabled={busy}
      >
        {row.product === null && <option value="" disabled>Choose…</option>}
        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </span>
  );
}

function Picker({ state, access, on }: { state: RepositoriesState; access: Extract<Access, { kind: 'installed' }>; on: RepositoriesHandlers }) {
  const offer = access.reachable ? addable(state.repositories, access.reachable) : null;
  return (
    <section className="ask-card repositories-picker" aria-labelledby="repositories-picker-title">
      <h2 id="repositories-picker-title">Add repository</h2>
      {offer === null && <p className="ask-muted">Couldn’t read the repositories the Omni App can see. Try again in a moment.</p>}
      {offer?.length === 0 && <p className="ask-muted">Every repository the Omni App can see is already listed.</p>}
      {offer && offer.length > 0 && (
        <ul className="repositories-offer">
          {offer.map((name) => (
            <li key={name}>
              <button type="button" className="ask-button quiet" onClick={() => on.add(name)} disabled={state.busy}>{name}</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ask-button quiet" onClick={on.close} disabled={state.busy}>Close</button>
    </section>
  );
}

function Row({ row, owner, access, now, busy, products, on }: { row: RepositoryRow; owner: boolean; access: Access; now: number; busy: boolean; products: Product[]; on: RepositoriesHandlers }) {
  const noAccess = access.kind === 'installed' && hasNoAccess(row, access.reachable);
  const label = `Track ${row.fullName}`;
  return (
    <li className="repositories-row" data-repository={row.fullName}>
      <div className="repositories-name">
        <strong>{row.fullName}</strong>
        <span className="ask-muted repositories-collection">{collectionLabel(row, now)}</span>
        {noAccess && (
          <span className="repositories-no-access">
            {NO_ACCESS}
            {access.kind === 'installed' && access.settingsUrl && <> · <a href={access.settingsUrl}>Give access on GitHub →</a></>}
          </span>
        )}
      </div>
      {hasProducts(products) && <ProductSelect row={row} products={products} busy={busy} on={on} />}
      <div className="repositories-switch">
        <span>Tracked</span>
        <button
          type="button"
          role="switch"
          aria-checked={row.tracked}
          aria-label={label}
          className="repositories-toggle"
          onClick={() => on.setTracked(row.fullName, !row.tracked)}
          disabled={!owner || busy}
        />
      </div>
    </li>
  );
}

export function RepositoriesView({ state, owner, access, now, products = [], on = IDLE }: RepositoriesViewProps) {
  const rows = state.repositories;
  const canAdd = owner && access.kind === 'installed';
  return (
    <div className="ask-col repositories">
      <section className="ask-card repositories-head" aria-labelledby="repositories-title">
        <h1 id="repositories-title">Repositories</h1>
        {owner
          ? <p className="ask-muted">Your workspace’s repositories. The Engineering board counts the tracked ones; switching one off hides it and keeps its history.</p>
          : <p className="ask-muted">{ONLY_OWNER}</p>}
        {hasProducts(products) && <p className="ask-muted">{PRODUCTS_LINE}</p>}
        {state.refusal && <p className="repositories-refusal" role="alert">{state.refusal}</p>}
        {canAdd && !state.picking && <button type="button" className="ask-button" onClick={on.pick} disabled={state.busy}>Add repository</button>}
      </section>

      {access.kind === 'none' && (
        <section className="ask-card repositories-install" aria-label="Install the Omni App">
          <h2>The Omni App is not installed</h2>
          <p className="ask-muted">Repositories are read through the workspace’s Omni App installation on GitHub.</p>
          {access.installUrl && <a className="ask-button" href={access.installUrl}>Install the Omni App on GitHub →</a>}
        </section>
      )}

      {canAdd && state.picking && access.kind === 'installed' && <Picker state={state} access={access} on={on} />}

      <section className="repositories-list" aria-label="The workspace’s repositories">
        {rows.length === 0
          ? <p className="repositories-empty">No repositories yet. {owner ? 'Add one from the repositories the Omni App can see.' : 'The workspace’s owner adds them.'}</p>
          : <ul>{rows.map((r) => <Row key={r.fullName} row={r} owner={owner} access={access} now={now} busy={state.busy} products={products} on={on} />)}</ul>}
        {access.kind === 'installed' && access.settingsUrl && <p className="repositories-missing"><a href={access.settingsUrl}>{MISSING_ONE}</a></p>}
      </section>
    </div>
  );
}
