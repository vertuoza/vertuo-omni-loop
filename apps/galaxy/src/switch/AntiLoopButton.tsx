import Link from 'next/link';
import { ANTI_HOME, type ShellMode } from '../anti/anti';
import { APP_HOME } from './switch';
import './switch.css';

// The Anti-loop switch, beside Game mode in the top bar (PRD 2490): a plain link, never a dialog, since
// nothing is lost by switching. On a forward page it reads Anti-loop and opens /anti; in anti-loop mode
// it reads Omni loop and opens /app.

export function AntiLoopButton({ mode = 'omni' }: { mode?: ShellMode }) {
  const anti = mode === 'anti';
  return (
    <Link className="game-mode" href={anti ? APP_HOME : ANTI_HOME}>
      {anti ? 'Omni loop' : 'Anti-loop'}
    </Link>
  );
}
