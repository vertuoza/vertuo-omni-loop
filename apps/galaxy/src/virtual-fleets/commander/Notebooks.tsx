'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Drawer } from '@omni/ui';
import type { CommanderPort } from './commander.client';
import type { MissionNotebook, Note, Notebooks } from './commander.contract';
import { deletedWords, eventsWords, folded, linesWords, missionNotebookTitle, noteDay, notebooksWords, WORDS } from './commander';

// The Notebooks drawer (PRD 3107 s4, the `fleet-commander` screen's 2.B): opened from `Notebooks · <n>` at the end of the
// status line, it shows the fleet notebook, then one notebook per mission, the missions that ended folded (`4 lines · Show`).
// Each line shows its day, its words, a chip of the events it cites and Delete. A Delete holds the line for 5 seconds as
// `Deleted by <login> · <time>` with Undo; then the deletion is sent, as the member, and the line leaves the Commander's
// memory. Leaving the tab sends what waits. NotebooksBody draws one state; useNotebooks holds the moves and makes the call.

/** How long a deletion can be undone before it is sent. */
export const UNDO_MS = 5_000;

/** A deletion waiting to be sent: when the member pressed Delete. */
export type Pending = ReadonlyMap<string, string>;

export interface NotebooksProps {
  notebooks: Notebooks;
  /** The signed-in member's login, for `Deleted by`. */
  me: string | null;
  /** The lines deleted in the last 5 seconds, by id, with when. */
  pending: Pending;
  /** The missions whose folded notebook the member opened. */
  shown: ReadonlySet<string>;
  /** A deletion that was refused: its words. */
  problem: string | null;
  onDelete: (note: string) => void;
  onUndo: (note: string) => void;
  onShow: (mission: string) => void;
}

function Line({ note, me, pending, onDelete, onUndo }: { note: Note } & Pick<NotebooksProps, 'me' | 'pending' | 'onDelete' | 'onUndo'>) {
  const at = pending.get(note.id);
  if (at !== undefined) {
    return (
      <li className="commander-note commander-note-gone">
        <span>{deletedWords(me, at)}</span>
        <Button variant="quiet" size="sm" onClick={() => { onUndo(note.id); }}>{WORDS.undo}</Button>
      </li>
    );
  }
  return (
    <li className="commander-note">
      <time dateTime={note.day}>{noteDay(note.day)}</time>
      <span className="commander-note-line">{note.line}</span>
      <a className="commander-chip" href={note.href}>{eventsWords(note.events)}</a>
      <Button variant="quiet" size="sm" onClick={() => { onDelete(note.id); }}>{WORDS.delete}</Button>
    </li>
  );
}

function Lines({ lines, ...rest }: { lines: readonly Note[] } & Pick<NotebooksProps, 'me' | 'pending' | 'onDelete' | 'onUndo'>) {
  return <ul className="commander-notes">{lines.map((note) => <Line key={note.id} note={note} {...rest} />)}</ul>;
}

function MissionBook({ book, ...rest }: { book: MissionNotebook } & Omit<NotebooksProps, 'notebooks' | 'problem'>) {
  const open = !folded(book) || rest.shown.has(book.mission);
  return (
    <section className="commander-book">
      <p className="commander-lab">{missionNotebookTitle(book)}</p>
      {open ? <Lines lines={book.lines} {...rest} /> : (
        <p className="commander-fold">
          {linesWords(book.lines.length)} · <Button variant="quiet" size="sm" onClick={() => { rest.onShow(book.mission); }}>{WORDS.show}</Button>
        </p>
      )}
    </section>
  );
}

/** The drawer's content: the fleet notebook, then each mission's. */
export function NotebooksBody({ notebooks, problem, ...rest }: NotebooksProps) {
  return (
    <div className="commander-notebooks">
      <section className="commander-book">
        <p className="commander-lab">{WORDS.fleetNotebook}</p>
        {notebooks.fleet.length === 0 ? <p className="commander-nothing">{WORDS.noLines}</p> : <Lines lines={notebooks.fleet} {...rest} />}
      </section>
      {notebooks.missions.map((book) => <MissionBook key={book.mission} book={book} {...rest} />)}
      {problem !== null && <p className="commander-problem" role="alert">{problem}</p>}
    </div>
  );
}

/** `Notebooks · <n>`, opening the drawer. */
export function NotebooksDrawer(props: NotebooksProps) {
  return (
    <Drawer trigger={notebooksWords(props.notebooks.count)} title={WORDS.notebooks}>
      <NotebooksBody {...props} />
    </Drawer>
  );
}

/** The notebooks once a line was deleted: without it, the count one less. */
export function notebooksAfter(notebooks: Notebooks, note: string): Notebooks {
  const keep = (lines: readonly Note[]) => lines.filter((line) => line.id !== note);
  const fleet = keep(notebooks.fleet);
  const missions = notebooks.missions.map((book) => ({ ...book, lines: keep(book.lines) })).filter((book) => book.lines.length > 0);
  return { fleet, missions, count: fleet.length + missions.reduce((sum, book) => sum + book.lines.length, 0) };
}

/**
 * Deletions held before they are sent: `hold` sends one after `wait` unless `undo` takes it back first; `flush` sends every one
 * still held at once (the tab is left). `send` is told each line to delete.
 */
export function undoQueue(send: (note: string) => void, wait = UNDO_MS) {
  const held = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    hold(note: string) {
      if (held.has(note)) return;
      held.set(note, setTimeout(() => {
        held.delete(note);
        send(note);
      }, wait));
    },
    undo(note: string) {
      clearTimeout(held.get(note));
      held.delete(note);
    },
    flush() {
      for (const [note, timer] of held) {
        clearTimeout(timer);
        send(note);
      }
      held.clear();
    },
  };
}

/** The drawer's moves as a member makes them: a deletion held 5 seconds, undone, or sent; `deleted` is told each line gone. */
export function useNotebooks(calls: Pick<CommanderPort, 'deleteNote'>, deleted: (note: string) => void, now: () => Date = () => new Date()):
  Pick<NotebooksProps, 'pending' | 'shown' | 'problem' | 'onDelete' | 'onUndo' | 'onShow'> {
  const [pending, setPending] = useState<Pending>(new Map());
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [problem, setProblem] = useState<string | null>(null);
  const done = useRef(deleted);
  done.current = deleted;
  const drop = (note: string) => { setPending((was) => { const next = new Map(was); next.delete(note); return next; }); };
  const queue = useMemo(() => undoQueue((note) => {
    void calls.deleteNote(note).then((gone) => {
      drop(note);
      if (gone.ok) done.current(note);
      else setProblem(gone.message);
    });
  }), [calls]);

  // Leaving the tab sends the deletions that wait: the member pressed Delete and did not undo it.
  useEffect(() => () => { queue.flush(); }, [queue]);

  return {
    pending,
    shown,
    problem,
    onDelete: (note) => {
      setProblem(null);
      setPending((was) => new Map(was).set(note, now().toISOString()));
      queue.hold(note);
    },
    onUndo: (note) => {
      queue.undo(note);
      drop(note);
    },
    onShow: (mission) => { setShown((was) => new Set(was).add(mission)); },
  };
}
