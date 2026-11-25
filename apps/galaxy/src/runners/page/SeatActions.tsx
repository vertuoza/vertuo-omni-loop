'use client';
import { Button } from '@omni/ui';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { placeSeat } from './seat.client';

// An owner's two seat controls on the Runners page (PRD omni-loop-34 s8): `Place the Supervisor` on a runner card while
// the workspace has no seat, and the strip's Move, which lists the other runners in place, each a button that moves the
// seat there. Both call POST /api/supervisor/seat (./seat.client.ts), then read the page again; a refusal shows its words
// beside the control. A member is drawn neither.

function usePlace(workspace: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function place(runner: string) {
    setBusy(true);
    setProblem(null);
    const called = await placeSeat(workspace, runner);
    setBusy(false);
    if (called.ok) router.refresh();
    else setProblem(called.error);
  }
  return { busy, problem, place };
}

const Problem = ({ problem }: { problem: string | null }) => (problem ? <span className="runners-problem" role="alert">{problem}</span> : null);

/** `Place the Supervisor` on a runner card: the seat goes on this runner. */
export function PlaceSeatButton({ workspace, runner }: { workspace: string; runner: string }) {
  const { busy, problem, place } = usePlace(workspace);
  return (
    <span className="runners-action runners-place">
      <Button size="sm" disabled={busy} onClick={() => { void place(runner); }}>Place the Supervisor</Button>
      <Problem problem={problem} />
    </span>
  );
}

/** Move on the seat strip: opens the list of the other runners in place; with none, disabled and titled so. */
export function MoveSeatButton({ workspace, targets }: { workspace: string; targets: readonly { id: string; name: string }[] }) {
  const { busy, problem, place } = usePlace(workspace);
  const [open, setOpen] = useState(false);
  if (targets.length === 0) return <Button size="sm" disabled title="No other runner to move it to">Move</Button>;
  return (
    <span className="runners-action runners-move">
      <Button size="sm" expanded={open} disabled={busy} onClick={() => { setOpen(!open); }}>Move</Button>
      {open && (
        <span className="runners-move-to" role="group" aria-label="Move the Supervisor to">
          {targets.map((target) => (
            <Button key={target.id} size="sm" disabled={busy} onClick={() => { void place(target.id); }}>To {target.name}</Button>
          ))}
        </span>
      )}
      <Problem problem={problem} />
    </span>
  );
}
