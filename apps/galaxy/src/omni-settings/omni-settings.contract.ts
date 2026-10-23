// The Omni settings area's contract (PRD 2417, s3): what the page serves a repository of its
// workspace's settings repository, as the kit's own schema (kit/lib/omni-settings/schema.ts), so
// `omni sync` and this area read one shape.
export { SettingsPlaybookSchema, type SettingsPlaybook, type SettingsFile } from 'omni-loop/kit/lib/omni-settings/schema.ts';
