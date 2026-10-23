import { logoSvg } from '@omni/design';
import Link from 'next/link';
import type { MouseEventHandler } from 'react';
import { ANTI_HOME, type ShellMode } from '../anti/anti';
import { APP_HOME } from '../switch/switch';
import './brand-logo.css';

// The one OMNI LOOP logo (issue 956): the crest at twice its size, then the wordmark, linked to /app.
// The app's sidebar and the public bar of /docs and /releases both draw it, so the two never differ.

const CREST = logoSvg('mark', { scale: 2, title: null });
/** The anti-loop mode's crest (PRD 2490): the same drawing mirrored, its ring in the anti-loop colour. */
const ANTI_CREST = logoSvg('mark', { scale: 2, mirror: true, title: null });

export type BrandLogoProps = {
  /** A class its place adds, beside brand-logo. */
  className?: string;
  /** Anti-loop mode reads ANTI LOOP then the mirrored crest, linked to /anti (PRD 2490). */
  mode?: ShellMode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function BrandLogo({ className, mode = 'omni', onClick }: BrandLogoProps) {
  const anti = mode === 'anti';
  const crest = <span className="brand-logo-crest" aria-hidden="true" dangerouslySetInnerHTML={{ __html: anti ? ANTI_CREST : CREST }} />;
  return (
    <Link className={className ? `brand-logo ${className}` : 'brand-logo'} href={anti ? ANTI_HOME : APP_HOME} {...(onClick === undefined ? {} : { onClick })}>
      {anti ? <><span className="ask-mark">ANTI LOOP</span>{crest}</> : <>{crest}<span className="ask-mark">OMNI LOOP</span></>}
    </Link>
  );
}
