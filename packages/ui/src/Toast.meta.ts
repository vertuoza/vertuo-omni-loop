import type { ComponentMeta } from './meta.ts';

export const TOAST_TONES = ['info', 'success', 'danger'] as const;

export const toastMeta = {
  name: 'Toast',
  variants: { tone: TOAST_TONES },
  usage: 'A short word that something happened, which fades by itself while the page goes on: a runner restarted, an answer saved.',
  do: ['Say what happened in a few words; add one line of detail at most.', 'Raise it from `useToast().show` once, after the thing it reports.'],
  dont: ['Put the only copy of something the person must act on in a toast: it goes away. That is a Notice or a Dialog.', 'Stack a string of toasts: merge them into one.'],
  contrast: {
    base: [
      { text: 'text-primary', on: 'raised' },
      { text: 'text-secondary', on: 'raised' },
      { text: 'focus-ring', on: 'raised', edge: true },
      { text: 'border-strong', on: 'raised', edge: true },
    ],
    'tone=info': [{ text: 'info', on: 'raised', edge: true }],
    'tone=success': [{ text: 'success', on: 'raised', edge: true }],
    'tone=danger': [{ text: 'danger', on: 'raised', edge: true }],
  },
  accessibility: [
    'Its queue, timing and dismissal are Base UI\'s Toast: the viewport is a polite live region named "Notifications", so a screen reader announces each toast as it arrives.',
    'A toast stays while it holds focus or the pointer; Escape on a focused toast dismisses it, and so does its close button, named in words.',
    'The tone shows as a strong start edge: never as colour alone, the words carry the meaning.',
  ],
  replaces: ['snackbar', 'flash-message'],
  example: '<Toast><SaveButton /></Toast>  // inside: const toast = useToast(); toast.show({ title: "Answer saved", tone: "success" })',
} satisfies ComponentMeta;
