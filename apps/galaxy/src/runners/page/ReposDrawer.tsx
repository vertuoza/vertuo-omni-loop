'use client';
import { Button, IconButton, Input } from '@omni/ui';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { filterRows, withRepos, type RepoRow, type RunnerRepos } from './repositories';
import { useDrawerKeys } from './useDrawerKeys';
import './need-human.css';

// The repositories drawer (PRD 3232 s4): a runner's card shows `<n> repositories · <k> with jobs` as a button, which opens this
// panel over the right of the page, as the Need human drawer opens (its parts, ./need-human.css). `?repos=<runner name>` opens it
// too, and an unknown name opens nothing. It holds the runner's name, how many repositories it holds, a search that filters as one
// types and the rows, busy first then A to Z, made on the server (./repositories.ts). Escape, the close button or the dimmed page
// close it and clear `?repos=`; the focus moves inside on open, Tab stays inside, and it returns to the button on close.

const Opener = createContext<(runner: string) => void>(() => undefined);

/** The card's button: opens the drawer on `runner`. */
export function ReposButton({ runner, words }: { runner: string; words: string }) {
  const open = useContext(Opener);
  return <span className="runners-repos-button" data-repos={runner} data-content><Button size="sm" expanded={false} onClick={() => { open(runner); }}>{words}</Button></span>;
}

const buttonOf = (runner: string): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('[data-repos]')].find((holder) => holder.dataset.repos === runner)?.querySelector<HTMLElement>('button') ?? undefined;

/** Holds which runner's drawer is open, from `?repos=` on the first draw, mirrors it in the URL (history.replaceState, which Next
 * follows, so the page's refresh draws the same URL), gives the focus back to the button on close, and draws the drawer. */
export function RepositoriesProvider({ initial, runners, children }: { initial: string | null; runners: readonly RunnerRepos[]; children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(initial);
  const back = useRef<string | null>(null);
  const show = useCallback((runner: string) => { setOpen(runner); }, []);
  const close = useCallback(() => {
    back.current = open;
    setOpen(null);
  }, [open]);
  useEffect(() => {
    window.history.replaceState(null, '', withRepos(window.location.href, open));
  }, [open]);
  useEffect(() => {
    if (open === null && back.current !== null) buttonOf(back.current)?.focus();
    back.current = null;
  }, [open]);
  const listed = open === null ? null : runners.find((runner) => runner.name === open) ?? null;
  return (
    <Opener value={show}>
      {children}
      {listed === null ? null : <RepositoriesDrawer key={listed.name} name={listed.name} rows={listed.rows} onClose={close} />}
    </Opener>
  );
}

/** The drawer on one runner, live: its search, its keys and its focus. */
function RepositoriesDrawer({ name, rows, onClose }: { name: string; rows: readonly RepoRow[]; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const panel = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLDivElement | null>(null);
  useEffect(() => { field.current?.querySelector('input')?.focus(); }, []);
  useDrawerKeys(panel, onClose);
  return <RepositoriesView name={name} rows={rows} shown={filterRows(rows, search)} search={search} panel={panel} field={field} onSearch={setSearch} onClose={onClose} />;
}

/** One repository: its owner dimmed and its name, its counts, its last ended job and where else it is held. */
function RepoItem({ row }: { row: RepoRow }) {
  return (
    <li className="repos-row" data-repo={row.repo}>
      <span className="repos-name" data-content><span className="runners-muted">{row.owner}/</span>{row.name}</span>
      <span className={`repos-counts${row.cannot > 0 ? ' has-cannot' : ''}`} data-content>{row.cannot > 0 && <i className="runners-icon" aria-hidden="true">▲ </i>}{row.counts}</span>
      <span className="runners-muted" data-content>Last job: {row.last}</span>
      <span className="runners-muted" data-content>{row.alsoOn}</span>
    </li>
  );
}

interface ViewProps {
  name: string;
  rows: readonly RepoRow[];
  shown: readonly RepoRow[];
  search: string;
  panel?: RefObject<HTMLElement | null>;
  field?: RefObject<HTMLDivElement | null>;
  onSearch?: (search: string) => void;
  onClose: () => void;
}

/** The drawer as drawn: header, search, rows, and the foot that says how far `Last job` reads. */
function RepositoriesView({ name, rows, shown, search, panel, field, onSearch, onClose }: ViewProps) {
  const id = useId();
  return (
    <div className="need-over">
      <div className="need-scrim" aria-hidden="true" onClick={onClose} />
      <section className="need" data-screen="runner-repositories" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} tabIndex={-1} ref={panel}>
        <header className="need-head">
          <span className="need-title" id={`${id}-title`} data-content>{name}</span>
          <IconButton icon="close" label="Close" variant="quiet" onClick={onClose} />
        </header>
        <div className="need-body">
          <p className="need-note" data-content>{rows.length} {rows.length === 1 ? 'repository' : 'repositories'} this runner holds</p>
          <div className="repos-search" ref={field}><Input type="search" label="Search repositories" placeholder="Search repositories" value={search} onChange={(event) => { onSearch?.(event.target.value); }} /></div>
          {shown.length === 0 ? <p className="need-note" role="status">No repository matches.</p> : <ul className="repos-list">{shown.map((row) => <RepoItem key={row.repo} row={row} />)}</ul>}
        </div>
        <footer className="need-foot"><span className="runners-muted">Last job: among the last 50 only.</span></footer>
      </section>
    </div>
  );
}
