// The words of a member's controls on an ideas board (PRD 1246, s4), in one place. English, whatever
// the locale. Every refusal is in plain words, with no error detail.

export const MEMBERS = {
  /** The add form's heading, and its button. */
  addHeading: 'Add an idea',
  add: 'Add the idea',
  title: 'Title',
  pitch: 'Pitch',
  lane: 'Lane',
  prd: 'PRD number',
  /** A card's controls. */
  edit: 'Edit',
  editFor: (title: string) => `Edit ${title}`,
  save: 'Save',
  cancel: 'Cancel',
  archive: 'Archive',
  archiveFor: (title: string) => `Archive ${title}`,
  /** Every card's line to copy into Claude. */
  brainstorm: 'Brainstorm this',
  copy: 'Copy',
  copied: 'Copied',
  copyFor: (title: string) => `Copy the brainstorm line of ${title}`,
  /** The form's refusals. */
  badTitle: 'A title holds 1 to 120 characters.',
  badPitch: 'A pitch holds 1 to 600 characters.',
  badLane: 'The lane is Now, Next or Later.',
  badPrd: 'A PRD number is a whole number above 0, or nothing.',
  /** The database's refusals. */
  notMember: 'Only a member of the workspace changes its ideas.',
  broken: 'The idea breaks a rule of the board.',
  failed: 'That could not be saved. Try again.',
  /** The demo has no database: a member's control saves nothing there. */
  demo: 'The demo saves nothing.',
} as const;
