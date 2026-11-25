'use client';
import { Button, Input } from '@omni/ui';
import { useRouter } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';
import { setSeat } from './seat.client';
import { limitOf } from './model';
import { MemoryDrawer } from '../memory/MemoryDrawer';

// The header's seat controls for an owner (PRD omni-loop-34 s5): Pause, or Resume once paused, and Token limit, which
// opens the daily limit in millions in place, with Save and Cancel. Each goes through PATCH /api/supervisor/seat as
// that owner, then the page reads itself again; a refusal is said in place. A member never gets them (AC-11). The
// Memory button before them opens the Memory drawer (s6, ../memory/).

export function SeatControls({ workspace, paused, dailyTokens, notes }: { workspace: string; paused: boolean; dailyTokens: number; notes: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(String(dailyTokens / 1_000_000));

  async function change(next: { paused?: boolean; dailyTokens?: number }) {
    setBusy(true);
    setError(null);
    const done = await setSeat(workspace, next);
    setBusy(false);
    if (!done.ok) {
      setError(done.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  function save(event: SyntheticEvent) {
    event.preventDefault();
    const tokens = limitOf(limit);
    if (tokens === null) {
      setError('Give the daily limit in millions of tokens, from 0.001 to 1000.');
      return;
    }
    void change({ dailyTokens: tokens });
  }

  return (
    <div className="sv-tools">
      <div className="sv-tools-row">
        <MemoryDrawer workspace={workspace} count={notes} />
        <Button size="sm" variant="secondary" expanded={editing} disabled={busy} onClick={() => { setEditing(!editing); setError(null); }}>Token limit</Button>
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void change({ paused: !paused })}>{paused ? 'Resume' : 'Pause'}</Button>
      </div>
      {editing && (
        <form className="sv-limit" onSubmit={save}>
          <Input label="Tokens a day, in millions" type="number" value={limit} onChange={(event) => { setLimit(event.target.value); }} />
          <Button size="sm" variant="primary" type="submit" disabled={busy}>Save</Button>
          <Button size="sm" variant="quiet" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
        </form>
      )}
      {error !== null && <p className="sv-error" role="alert">{error}</p>}
    </div>
  );
}
