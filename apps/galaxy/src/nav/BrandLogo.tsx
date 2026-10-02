import { logoSvg } from '@omni/design';
import Link from 'next/link';
import type { MouseEventHandler } from 'react';
import { APP_HOME } from '../switch/switch';
import './brand-logo.css';

// The one OMNI LOOP logo (issue 956): the crest at twice its size, then the wordmark, linked to /app.
// The app's sidebar and the public bar of /docs and /releases both draw it, so the two never differ.

const CREST = logoSvg('mark', { scale: 2, title: null });

export type BrandLogoProps = {
  /** A class its place adds, beside brand-logo. */
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

export function BrandLogo({ className, onClick }: BrandLogoProps) {
  return (
    <Link className={className ? `brand-logo ${className}` : 'brand-logo'} href={APP_HOME} onClick={onClick}>
      <span className="brand-logo-crest" aria-hidden="true" dangerouslySetInnerHTML={{ __html: CREST }} />
      <span className="ask-mark">OMNI LOOP</span>
    </Link>
  );
}
