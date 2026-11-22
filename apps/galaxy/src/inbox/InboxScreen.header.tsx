'use client';
import { Field, Popover, Switch, Tabs } from '@omni/ui';
import Link from 'next/link';
import { BLOCKED_BY_BROWSER } from '../waiting/alerts';
import { useAlerts, useWaiting, type WaitingAlerts } from '../waiting/WaitingProvider';
import { countWords, problemsOf, unreadCounted } from './InboxScreen.model';

// The Inbox's header (PRD omni-loop-22, s5), on each of its tabs: the title, how many things wait on the
// person (the waiting list's total, the number the menu, the tab's title and its icon dot show), the
// Alerts button holding the Desktop alerts and Chime switches the bell's panel held (kept by the waiting
// provider, src/waiting/alerts.ts), and the tabs Open (with the count), Done and Workspace.

export type InboxTab = 'open' | 'done' | 'workspace';

/** The Alerts popover: the two switches, as the bell's panel drew them. */
function Alerts({ desktop, chime, onDesktop, onChime }: WaitingAlerts) {
  const blocked = desktop === 'blocked';
  return (
    <Popover trigger="Alerts" title="Alerts">
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

/** The header as it draws a given count: what the render tests pin. */
export function InboxHeadView({ tab, count, words, alerts }: { tab: InboxTab; count: number; words: string; alerts?: WaitingAlerts | undefined }) {
  const items = [
    { id: 'open', label: 'Open', href: '/app/inbox', ...(count > 0 ? { count: String(count), attention: true } : {}) },
    { id: 'done', label: 'Done', href: '/app/inbox/done' },
    { id: 'workspace', label: 'Workspace', href: '/app/inbox/workspace' },
  ];
  return (
    <header className="inbox-head">
      <div className="inbox-title-row">
        <h1 className="inbox-title">Inbox</h1>
        <span className="inbox-count">{words}</span>
        {alerts && <span className="inbox-alerts-button"><Alerts {...alerts} /></span>}
      </div>
      <Tabs label="Inbox views" items={items} current={tab} link={Link} />
    </header>
  );
}

/** The header, live: the waiting list's total and the alert switches (none signed out). */
export function InboxHead({ tab }: { tab: InboxTab }) {
  const { counts, unread, unreadPrds } = useWaiting();
  const alerts = useAlerts();
  return <InboxHeadView tab={tab} count={counts.total} words={countWords(counts.total, unreadCounted(problemsOf(unread, unreadPrds)))} alerts={alerts} />;
}
