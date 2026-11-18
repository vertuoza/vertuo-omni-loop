'use client';

import { Toast as Base } from '@base-ui/react/toast';
import type { ReactNode } from 'react';
import './Button.css';
import './Toast.css';
import type { TOAST_TONES } from './Toast.meta.ts';

export type ToastTone = (typeof TOAST_TONES)[number];

export type ToastProps = {
  /** The words that name the live region of toasts, for a screen reader. */
  label?: string;
  /** The words on each toast's close button. */
  closeLabel?: string;
  /** How long a toast stays, in milliseconds; 0 keeps it until it is dismissed. */
  timeout?: number;
  /** How many show at once. */
  limit?: number;
  children?: ReactNode;
};

/** What a toast says: a title, a line of detail at most, and its tone. */
export type ToastMessage = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Overrides the timeout of the Toast that holds it. */
  timeout?: number;
};

type ToastData = { tone: ToastTone };

function List({ closeLabel }: { closeLabel: string }) {
  const { toasts } = Base.useToastManager<ToastData>();
  return toasts.map((toast) => {
    const tone = toast.data?.tone ?? 'info';
    return (
      <Base.Root key={toast.id} toast={toast} className={`omni-toast omni-toast--${tone}`}>
        <Base.Content className="omni-toast__content">
          <div className="omni-toast__text">
            <Base.Title className="omni-toast__title" />
            <Base.Description className="omni-toast__description" />
          </div>
          <Base.Close className="omni-toast__close" aria-label={closeLabel}>{'×'}</Base.Close>
        </Base.Content>
      </Base.Root>
    );
  });
}

/** Holds the queue of toasts for the page under it; its toasts appear in a polite live region and go by themselves or on Escape. Raise one with `useToast`. */
export function Toast({ label = 'Notifications', closeLabel = 'Dismiss', timeout, limit, children }: ToastProps) {
  return (
    <Base.Provider timeout={timeout} limit={limit}>
      {children}
      <Base.Viewport className="omni-toast-viewport" aria-label={label}>
        <List closeLabel={closeLabel} />
      </Base.Viewport>
    </Base.Provider>
  );
}

/** Raises and dismisses the toasts of the `Toast` above it. */
export function useToast(): { show: (message: ToastMessage) => string; close: (id?: string) => void } {
  const manager = Base.useToastManager<ToastData>();
  return {
    show: ({ title, description, tone = 'info', timeout }) => manager.add({ title, description, timeout, data: { tone } }),
    close: (id) => { manager.close(id); },
  };
}

/** A button that raises one toast: what the catalogue's specimen shows live (a function prop cannot cross from the server page). */
export function ToastTrigger({ label, title, description, tone }: { label: string; title: string; description?: string; tone: ToastTone }) {
  const toast = useToast();
  return (
    <button
      type="button"
      className="omni-button omni-button--secondary omni-button--md"
      onClick={() => { toast.show({ title, description, tone }); }}
    >
      {label}
    </button>
  );
}
