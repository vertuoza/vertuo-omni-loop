'use client';
import { Field, Popover, Switch, Tabs } from '@omni/ui';
import Link from 'next/link';
import { BLOCKED_BY_BROWSER } from '../waiting/alerts';
import { useAlerts, useWaiting, type WaitingAlerts } from '../waiting/WaitingProvider';
import { countWords, problemsOf, unreadCounted } from './InboxScreen.model';

// The Inbox's header (PRD omni-loop-22 s5, PRD omni-loop-23 s4), on each of its tabs: a visually hidden
// title (the top bar's trail names the page), the tabs Open, Done and Workspace right under the top bar,
// the Open tab's count (the waiting list's total, the number the menu, the tab's title and its icon dot
// show; the page's one filled signal shape, named "12 wait on you"), and, at the end of the tabs line,
// the Alerts icon button holding the Desktop alerts and Chime switches (kept by the waiting provider,
// src/waiting/alerts.ts).

export type InboxTab = 'open' | 'done' | 'workspace';

/** The Alerts icon button: a quiet button at the end of the tabs line that opens the two switches. */
function Alerts({ desktop, chime, onDesktop, onChime }: WaitingAlerts) {
  const blocked = desktop === 'blocked';
  return (
    <Popover trigger="Alerts" title="Alerts" openOn="hover" triggerIcon="settings">
      <div className="inbox-alerts">
        <Field label="Desktop alerts" {...(blocked ? { hint: BLOCKED_BY_BROWSER } : {})}>
          <Switch checked={desktop === 'on'} disabled={blocked} onChange={(e) => { onDesktop(e.currentTarget.checked); }} />
        </Field>
        <Field label="Chime">
          <Switch checked={chime} onChange={(e) => { onChime(e.currentTarget.checked); }} />
        </Field>
        <p className="inbox-muted">The tab title and its dot show the same count as the Inbox.</p>
      </div>
    </Popover>
  );
}

/** The header as it draws a given count: what the render tests pin. No visible title: the top bar's trail names the page. */
export function InboxHeadView({ tab, count, words, alerts }: { tab: InboxTab; count: number; words: string; alerts?: WaitingAlerts | undefined }) {
  const items = [
    { id: 'open', label: 'Open', href: '/app/inbox', ...(count > 0 ? { count: String(count), attention: true, countLabel: count === 1 ? 'waits on you' : 'wait on you' } : {}) },
    { id: 'done', label: 'Done', href: '/app/inbox/done' },
    { id: 'workspace', label: 'Workspace', href: '/app/inbox/workspace' },
  ];
  return (
    <header className="inbox-head">
      <h1 className="inbox-vh">Inbox</h1>
      {count === 0 && <p className="inbox-vh" role="status">{words}</p>}
      <Tabs
        label="Inbox views"
        items={items}
        current={tab}
        link={Link}
        filledCount
        {...(alerts ? { endSlot: <span className="inbox-alerts-button"><Alerts {...alerts} /></span> } : {})}
      />
    </header>
  );
}

/** The header, live: the waiting list's total and the alert switches (none signed out). */
export function InboxHead({ tab }: { tab: InboxTab }) {
  const { counts, unread, unreadPrds } = useWaiting();
  const alerts = useAlerts();
  return <InboxHeadView tab={tab} count={counts.total} words={countWords(counts.total, unreadCounted(problemsOf(unread, unreadPrds)))} alerts={alerts} />;
}
