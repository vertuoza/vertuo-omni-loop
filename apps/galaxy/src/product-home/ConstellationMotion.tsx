'use client';

import { useEffect } from 'react';

// Pauses the Constellation's motion while the page is hidden (PRD 2174 s4): the section carries
// `data-paused` and the stylesheet stops every animation under it. It draws nothing.
export function ConstellationMotion() {
  useEffect(() => {
    const pause = () => {
      document.querySelector('.constellation')?.toggleAttribute('data-paused', document.hidden);
    };
    pause();
    document.addEventListener('visibilitychange', pause);
    return () => { document.removeEventListener('visibilitychange', pause); };
  }, []);
  return null;
}
