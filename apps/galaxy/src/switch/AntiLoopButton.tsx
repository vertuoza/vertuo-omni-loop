import { logoSvg } from '@omni/design';
import Link from 'next/link';
import { ANTI_HOME, type ShellMode } from '../anti/anti';
import { APP_HOME } from './switch';
import './switch.css';

// The Anti-loop switch, beside Game mode in the top bar (PRD 2490): a plain link, never a dialog, since
// nothing is lost by switching. On a forward page it reads Anti-loop and opens /anti; in anti-loop mode
// it reads Omni loop and opens /app. It wears the loop it opens (issue 2505): that loop's signal, and
// its crest at 1× in a chip, mirrored on the way to the anti-loop.

const CREST = { omni: logoSvg('mark', { scale: 1, title: null }), anti: logoSvg('mark', { scale: 1, title: null, mirror: true }) };

export function AntiLoopButton({ mode = 'omni' }: { mode?: ShellMode }) {
  const to = mode === 'anti' ? 'omni' : 'anti';
  return (
    <Link className="anti-loop-button" data-to={to} href={to === 'omni' ? APP_HOME : ANTI_HOME}>
      <span className="anti-loop-crest" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CREST[to] }} />
      {to === 'omni' ? 'Omni loop' : 'Anti-loop'}
    </Link>
  );
}
