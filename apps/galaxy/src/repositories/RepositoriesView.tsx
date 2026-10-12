import { boardPath } from '../ideas/model';
import { productHomeHref } from '../products/model';
import { addable, collectionLabel, hasNoAccess, phase0Of, type Phase0, type RepositoriesState, type RepositoryRow } from './model';

// Settings → Repositories drawn from its state (PRD 612 s1). One row per repository of the
// workspace: `owner/name`, when it was last collected, and its Tracked switch. The owner reads Add
// repository, which opens the repositories the workspace's Omni App installation can see that are not
// listed yet, one click each; a member reads the same list, read only. A repository the App cannot
// read says so, with a link to the installation's settings on GitHub, and stays tracked. A workspace
// with no installation reads a link to installing the App instead. Drawn on the server first;
// RepositoriesPage.tsx wires the handlers. Each row shows the products that link it as chips, each
// linking to that product's home, where its links are changed (PRD 1364 s11); a repository in no product
// shows none, and nothing says "Product". PRD 1246 s4: each row also links to the repository's ideas board and has its Public ideas switch,
// any member's to change: off, only the workspace's members read the board. PRD 1299 s1: each row has
// its Phase 0 on the server switch, the owner's only: on, a PRD born in it is approved on its PRD page
// rather than by a phase-0 pull request.

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
  /** A row's Public ideas switch (PRD 1246 s4). */
  setPublicIdeas(fullName: string, on: boolean): void;
  /** A row's Phase 0 on the server switch (PRD 1299 s1). */
  setPhase0(fullName: string, phase0: Phase0): void;
}

const IDLE: RepositoriesHandlers = { pick() {}, close() {}, add() {}, setTracked() {}, setPublicIdeas() {}, setPhase0() {} };

export interface RepositoriesViewProps {
  state: RepositoriesState;
  owner: boolean;
  access: Access;
  /** The time the collection lines are read at (the server's, so both renders agree). */
  now: number;
  on?: RepositoriesHandlers;
}

/** The products that link the repository, each a chip to its home; nothing for a repository in none. */
function ProductChips({ row }: { row: RepositoryRow }) {
  if (row.products.length === 0) return null;
  return (
    <span className="repositories-products" aria-label={`Products of ${row.fullName}`}>
      {row.products.map((p) => <a key={p.id} className="repositories-product-chip" href={productHomeHref(p.id)}>{p.name}</a>)}
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
              <button type="button" className="ask-button quiet" onClick={() => { on.add(name); }} disabled={state.busy}>{name}</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="ask-button quiet" onClick={() => { on.close(); }} disabled={state.busy}>Close</button>
    </section>
  );
}

/** A switch of a row: its name beside it, and who may press it. */
function Switch({ name, label, on, disabled, press }: { name: string; label: string; on: boolean; disabled: boolean; press: () => void }) {
  return (
    <div className="repositories-switch">
      <span>{name}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="repositories-toggle" onClick={press} disabled={disabled} />
    </div>
  );
}

function Row({ row, owner, access, now, busy, on }: { row: RepositoryRow; owner: boolean; access: Access; now: number; busy: boolean; on: RepositoriesHandlers }) {
  const noAccess = access.kind === 'installed' && hasNoAccess(row, access.reachable);
  return (
    <li className="repositories-row" data-repository={row.fullName}>
      <div className="repositories-name">
        <strong>{row.fullName}</strong>
        <span className="ask-muted repositories-collection">{collectionLabel(row, now)}</span>
        {noAccess && (
          <span className="repositories-no-access">
            {NO_ACCESS}
            {access.settingsUrl && <> · <a href={access.settingsUrl}>Give access on GitHub →</a></>}
          </span>
        )}
        <a className="repositories-ideas" href={boardPath(row.fullName)}>Ideas board →</a>
      </div>
      <ProductChips row={row} />
      <Switch name="Public ideas" label={`Public ideas board of ${row.fullName}`} on={row.publicIdeas} disabled={busy} press={() => { on.setPublicIdeas(row.fullName, !row.publicIdeas); }} />
      <Switch name="Phase 0 on the server" label={`Phase 0 on the server for ${row.fullName}`} on={phase0Of(row) === 'server'} disabled={!owner || busy} press={() => { on.setPhase0(row.fullName, phase0Of(row) === 'server' ? 'pr' : 'server'); }} />
      <Switch name="Tracked" label={`Track ${row.fullName}`} on={row.tracked} disabled={!owner || busy} press={() => { on.setTracked(row.fullName, !row.tracked); }} />
    </li>
  );
}

export function RepositoriesView({ state, owner, access, now, on = IDLE }: RepositoriesViewProps) {
  const rows = state.repositories;
  const canAdd = owner && access.kind === 'installed';
  return (
    <div className="ask-col repositories">
      <section className="ask-card repositories-head" aria-labelledby="repositories-title">
        <h1 id="repositories-title">Repositories</h1>
        {owner
          ? <p className="ask-muted">Your workspace’s repositories. The Engineering board counts the tracked ones; switching one off hides it and keeps its history.</p>
          : <p className="ask-muted">{ONLY_OWNER}</p>}
        {state.refusal && <p className="repositories-refusal" role="alert">{state.refusal}</p>}
        {canAdd && !state.picking && <button type="button" className="ask-button" onClick={() => { on.pick(); }} disabled={state.busy}>Add repository</button>}
      </section>

      {access.kind === 'none' && (
        <section className="ask-card repositories-install" aria-label="Install the Omni App">
          <h2>The Omni App is not installed</h2>
          <p className="ask-muted">Repositories are read through the workspace’s Omni App installation on GitHub.</p>
          {access.installUrl && <a className="ask-button" href={access.installUrl}>Install the Omni App on GitHub →</a>}
        </section>
      )}

      {canAdd && state.picking && <Picker state={state} access={access} on={on} />}

      <section className="repositories-list" aria-label="The workspace’s repositories">
        {rows.length === 0
          ? <p className="repositories-empty">No repositories yet. {owner ? 'Add one from the repositories the Omni App can see.' : 'The workspace’s owner adds them.'}</p>
          : <ul>{rows.map((r) => <Row key={r.fullName} row={r} owner={owner} access={access} now={now} busy={state.busy} on={on} />)}</ul>}
        {access.kind === 'installed' && access.settingsUrl && <p className="repositories-missing"><a href={access.settingsUrl}>{MISSING_ONE}</a></p>}
      </section>
    </div>
  );
}
