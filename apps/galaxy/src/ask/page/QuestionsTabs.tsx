'use client';
import { SectionTabs } from '../../nav/SectionTabs';
import { QUESTIONS_TABS, withCounts } from '../../nav/section-tabs';
import { useWaiting } from '../../waiting/WaitingProvider';

// The Questions pages' tab row (PRD 733): Open questions · Shared with me · History, at the top of
// /ask, /ask/for-me and /ask/history, the page's own tab (`current`, its address) marked. The counts
// are the waiting provider's (PRD 499), read again as it polls: the questions not shared with the
// person on Open questions, the shared ones on Shared with me, each shown only above 0.

export function QuestionsTabs({ current }: { current: string }) {
  const { counts } = useWaiting();
  return <SectionTabs label="Questions" tabs={withCounts(QUESTIONS_TABS, counts)} current={current} />;
}
