'use client';
import { useEffect, useRef, type ReactNode } from 'react';

// What pins while a dossier page scrolls (PRD 476). On a concept's page, the header box; on /prd/<id> and a
// fix's page, since omni-loop-20 s6, the tab row alone (`bar`): the head above it scrolls away. From
// 900 × 700 px its stylesheet pins it at the top while the page scrolls; this measures it and writes its
// height to --dossier-head-h on the page, so a round the way back from /ask/q/<round> scrolls to (and a
// markdown heading) lands just under it. Before any script runs, or without one, the variable is unset and
// the margin falls back to 16 px.

/** The value of --dossier-head-h for a measured height: whole pixels, never negative. */
export function headHeight(px: number): string {
  return `${Number.isFinite(px) && px > 0 ? Math.ceil(px) : 0}px`;
}

export function PinnedHead({ children, bar = false }: { children: ReactNode; bar?: boolean }) {
  const head = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = bar ? row.current : head.current;
    const page = box?.parentElement;
    if (!box || !page || typeof ResizeObserver === 'undefined') return;
    const write = () => { page.style.setProperty('--dossier-head-h', headHeight(box.getBoundingClientRect().height)); };
    write();
    const observer = new ResizeObserver(write);
    observer.observe(box);
    return () => {
      observer.disconnect();
      page.style.removeProperty('--dossier-head-h');
    };
  }, [bar]);

  if (bar) return <div ref={row} className="dossier-tabbar">{children}</div>;
  return <header ref={head} className="dossier-head">{children}</header>;
}
