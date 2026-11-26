'use client';
import { Button, Drawer, SegmentedControl } from '@omni/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Note } from '../api/supervisor.contract';
import { askOf, clearMemory, forgetNote, memoryWords, notesAfter, readNotes, scopeOf, sourceWords, type Ask, type Scope } from './memory';
import './memory.css';

// The Memory drawer (PRD omni-loop-34 s6, the before/after page's 2.C), opened from `Memory · <n>` in the header for an
// owner only (a member never gets it, AC-11): the Short-term and Long-term tabs, each note with its source and a delete
// button, then `Clear short-term` (or long-term) and `Clear all memory`. Each delete or clear first asks in place
// (`Clear all 9 notes? Findings and chat stay.`), then goes through DELETE /api/supervisor/memory as that owner, and
// the page reads itself again for the header's count. A refusal is said in place. The notes are read when it opens.

export interface MemoryCalls {
  read: typeof readNotes;
  forgetNote: typeof forgetNote;
  clear: typeof clearMemory;
}

const CALLS: MemoryCalls = { read: readNotes, forgetNote, clear: clearMemory };

interface MemoryBodyProps {
  /** The notes once read; null while they are read. */
  notes: readonly Note[] | null;
  scope: Scope;
  /** What waits on the owner's confirmation, asked in place. */
  asking: Ask | null;
  busy: boolean;
  error: string | null;
  onScope: (scope: Scope) => void;
  onAsk: (ask: Ask | null) => void;
  onConfirm: (ask: Ask) => void;
}

function Confirm({ ask, notes, busy, onAsk, onConfirm }: { ask: Ask; notes: readonly Note[] } & Pick<MemoryBodyProps, 'busy' | 'onAsk' | 'onConfirm'>) {
  const words = askOf(ask, notes);
  return (
    <div className="sv-mem-confirm" role="group" aria-label={words.question}>
      <p><b>{words.question}</b></p>
      <p>{words.keeps}</p>
      <div className="sv-mem-acts">
        <Button size="sm" variant="danger" disabled={busy} onClick={() => { onConfirm(ask); }}>{words.confirm}</Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => { onAsk(null); }}>Cancel</Button>
      </div>
    </div>
  );
}

type Asked = Pick<MemoryBodyProps, 'busy' | 'onAsk' | 'onConfirm'> & { all: readonly Note[] };

/** The scope's notes, each with its source and Delete, or the question asked in place for the one asked about. */
function Notes({ notes, label, askingNote, all, ...asked }: { notes: readonly Note[] | null; label: string; askingNote: string | null } & Asked) {
  if (notes === null) return <p className="sv-mem-quiet" role="status">Reading the notes…</p>;
  if (notes.length === 0) return <p className="sv-mem-quiet">No {label.toLowerCase()} note.</p>;
  return (
    <ul className="sv-mem-notes">
      {notes.map((note) => (
        <li key={note.id} className="sv-mem-note">
          <p className="sv-mem-line">{note.line}</p>
          <small className="sv-mem-source">{sourceWords(note)}</small>
          {askingNote === note.id
            ? <Confirm ask={{ what: 'note', note: note.id }} notes={all} {...asked} />
            : <Button size="sm" variant="quiet" disabled={asked.busy} onClick={() => { asked.onAsk({ what: 'note', note: note.id }); }}>Delete</Button>}
        </li>
      ))}
    </ul>
  );
}

/** The foot: `Clear <scope>` and `Clear all memory`, or the question asked in place for one of them. */
function Foot({ scope, label, count, asking, all, ...asked }: { scope: Scope; label: string; count: number; asking: Ask | null } & Asked) {
  if (asking !== null) return <Confirm ask={asking} notes={all} {...asked} />;
  return (
    <div className="sv-mem-acts">
      <Button size="sm" variant="secondary" disabled={asked.busy || count === 0} onClick={() => { asked.onAsk({ what: 'scope', scope }); }}>{`Clear ${label.toLowerCase()}`}</Button>
      <Button size="sm" variant="danger" disabled={asked.busy || all.length === 0} onClick={() => { asked.onAsk({ what: 'all' }); }}>Clear all memory</Button>
    </div>
  );
}

/** The drawer's content in one state: the tabs, the scope's notes, the clear buttons, the question asked in place. */
function MemoryBody({ notes, scope, asking, busy, error, onScope, onAsk, onConfirm }: MemoryBodyProps) {
  const all = notes ?? [];
  const shown = scopeOf(all, scope);
  const tabs = (['short', 'long'] as const).map((id) => ({ id, label: scopeOf(all, id).label, count: String(scopeOf(all, id).notes.length) }));
  const asked: Asked = { busy, onAsk, onConfirm, all };
  return (
    <div className="sv-mem">
      <p className="sv-mem-own">Workspace owners only</p>
      <div className="sv-mem-tabs">
        <SegmentedControl label="Memory" size="sm" value={scope} options={tabs} onChange={(id) => { onScope(id === 'long' ? 'long' : 'short'); }} />
        <span className="sv-mem-keeps">{shown.keeps}</span>
      </div>
      <Notes notes={notes === null ? null : shown.notes} label={shown.label} askingNote={asking?.what === 'note' ? asking.note : null} {...asked} />
      {error !== null && <p className="sv-error" role="alert">{error}</p>}
      <div className="sv-mem-foot">
        <Foot scope={scope} label={shown.label} count={shown.notes.length} asking={asking?.what === 'note' ? null : asking} {...asked} />
      </div>
    </div>
  );
}

/** `Memory · <n>`, opening the drawer; the notes read on opening, each delete or clear sent once confirmed. */
export function MemoryDrawer({ workspace, count, calls = CALLS }: { workspace: string; count: number; calls?: MemoryCalls }) {
  const router = useRouter();
  const [notes, setNotes] = useState<readonly Note[] | null>(null);
  const [scope, setScope] = useState<Scope>('short');
  const [asking, setAsking] = useState<Ask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setNotes(null);
    setAsking(null);
    setError(null);
    const read = await calls.read(workspace);
    if (read.ok) setNotes(read.value);
    else {
      setNotes([]);
      setError(read.error);
    }
  }

  async function confirm(ask: Ask) {
    setBusy(true);
    setError(null);
    const done = ask.what === 'note' ? await calls.forgetNote(workspace, ask.note) : await calls.clear(workspace, ask.what === 'all' ? 'all' : ask.scope);
    setBusy(false);
    setAsking(null);
    if (!done.ok) {
      setError(done.error);
      return;
    }
    setNotes((was) => notesAfter(was ?? [], ask));
    router.refresh();
  }

  return (
    <Drawer trigger={memoryWords(count)} title="Memory" description="Each note cites its source." onOpenChange={(opened) => { if (opened) void open(); }}>
      <MemoryBody notes={notes} scope={scope} asking={asking} busy={busy} error={error}
        onScope={(next) => { setScope(next); setAsking(null); }} onAsk={(ask) => { setAsking(ask); setError(null); }} onConfirm={(ask) => void confirm(ask)} />
    </Drawer>
  );
}
