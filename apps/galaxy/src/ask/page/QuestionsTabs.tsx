'use client';
import { SectionTabs } from '../../nav/SectionTabs';
import { QUESTIONS_TABS, withCounts, type SectionTab } from '../../nav/section-tabs';
import { useWaiting } from '../../waiting/WaitingProvider';

// The Questions pages' tab row (PRD 733): Open questions · Shared with me · History, at the top of
// /ask, /ask/for-me and /ask/history, the page's own tab (`current`, its address) marked. The counts
// are the waiting provider's (PRD 499), read again as it polls: the questions not shared with the
// person on Inbox, the shared ones on Shared with me, each shown only above 0.
//
// Since PRD 2011 s14 the first tab is Inbox (today's ask-mode questions) and Outbox follows Shared with
// me: the decisions agents took alone, at /ask/outbox. Only that page knows how many are open (`open`),
// so only it shows the count.

const INBOX = '/ask';
const OUTBOX = '/ask/outbox';

/** The tabs in the page's order: Inbox, Shared with me, Outbox, History. */
function tabsOf(counted: readonly SectionTab[], open: number | undefined): SectionTab[] {
  const named = counted.map((tab) => (tab.href === INBOX ? { ...tab, label: 'Inbox' } : tab));
  const outbox: SectionTab = open === undefined ? { href: OUTBOX, label: 'Outbox' } : { href: OUTBOX, label: 'Outbox', count: open };
  const history = named.findIndex((tab) => tab.href === '/ask/history');
  return [...named.slice(0, history), outbox, ...named.slice(history)];
}

export function QuestionsTabs({ current, open }: { current: string; open?: number }) {
  const { counts } = useWaiting();
  return <SectionTabs label="Questions" tabs={tabsOf(withCounts(QUESTIONS_TABS, counts), open)} current={current} />;
}
