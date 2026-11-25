'use client';
import { Button, Textarea } from '@omni/ui';
import { useRouter } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';
import type { HeaderState } from '../page/model';
import { QUICK_ASKS, say, sayable, waitWords } from './chat';
import './chat.css';

// The owner's box under a thread (PRD omni-loop-34 s6, the before/after page's 2.B): the two quick questions, the box
// and Send, then `Acts only when you press.`. A message goes to the general thread, or to the open finding's, as that
// owner; the page then reads itself again, and the seat's answer comes in signed Supervisor · agent. While the seat
// cannot answer, the box says so and the message waits. A refusal is said in place. A member never gets the box
// (AC-11): the page draws `Only workspace owners write to the Supervisor.` in its place.

export interface ChatBoxProps {
  workspace: string;
  /** The finding whose thread the box writes in; null for the general thread. */
  finding: string | null;
  /** The seat's state, as the header reads it. */
  state: HeaderState;
  /** The call that stores the message: the route's, replaced in tests. */
  send?: typeof say;
}

export function ChatBox({ workspace, finding, state, send = say }: ChatBoxProps) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const waits = waitWords(state);

  async function post(typed: string) {
    const message = sayable(typed);
    if (message === null) {
      setError('Write a message of at most 4,000 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const done = await send(workspace, finding, message);
    setBusy(false);
    if (!done.ok) {
      setError(done.error);
      return;
    }
    setText('');
    router.refresh();
  }

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    void post(text);
  }

  return (
    <div className="sv-compose">
      {waits !== null && <p className="sv-compose-wait" role="status">{waits}</p>}
      <div className="sv-compose-asks">
        {QUICK_ASKS.map((ask) => <Button key={ask} size="sm" variant="quiet" disabled={busy} onClick={() => void post(ask)}>{ask}</Button>)}
      </div>
      <form className="sv-compose-box" onSubmit={submit}>
        <Textarea label="Message to the Supervisor" placeholder="Ask the Supervisor…" rows={2} value={text} disabled={busy} onChange={(event) => { setText(event.target.value); }} />
        <Button size="sm" variant="primary" type="submit" disabled={busy}>Send</Button>
      </form>
      {error !== null && <p className="sv-error" role="alert">{error}</p>}
      <p className="sv-compose-fine">Acts only when you press.</p>
    </div>
  );
}
