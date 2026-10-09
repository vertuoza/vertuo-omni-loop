import type { SupabaseClient } from '@supabase/supabase-js';
import { orThrow, parseRow, parseRows } from '../data/parse-rows';
import type { Database } from '../../../../supabase/database.types.ts';
import { AlertChannels, CHANNELS_OFF, type PushDevice } from './device';

// The one way into a person's alert switches and devices (PRD 1322 s9), as that person:
// `alert_channels` and `push_subscriptions` (supabase/migrations/20261124090000_product_approvers.sql),
// each read and written by its own person only, so row-level security keeps every call to the caller's
// own rows. A person with no row has both switches off. A failed call throws, naming what failed.

/** The columns of `alert_channels` the page reads. */
export const CHANNEL_COLUMNS = 'push, email';

export interface AlertStore {
  /** Their switches, off when they never set one. */
  channels(userId: string): Promise<AlertChannels>;
  /** Both switches, set as given; answers them as stored. */
  setChannels(userId: string, channels: AlertChannels): Promise<AlertChannels>;
  /** This device's subscription, stored or refreshed (one row per person and endpoint). */
  subscribe(userId: string, device: PushDevice): Promise<void>;
  /** This device's subscription, removed; nothing to remove is no error. */
  unsubscribe(userId: string, endpoint: string): Promise<void>;
}

const failed = (what: string, message: string) => new Error(`Supabase: could not ${what} (${message})`);

export function alertStore(db: SupabaseClient<Database>): AlertStore {
  return {
    async channels(userId) {
      const { data, error } = await db.from('alert_channels').select(CHANNEL_COLUMNS).eq('user_id', userId);
      if (error) throw failed('read your alert channels', error.message);
      return orThrow(parseRows(AlertChannels, data, 'push: alert_channels'))[0] ?? CHANNELS_OFF;
    },
    async setChannels(userId, channels) {
      const { data, error } = await db
        .from('alert_channels')
        .upsert({ user_id: userId, ...channels, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        .select(CHANNEL_COLUMNS)
        .single();
      if (error) throw failed('save your alert channels', error.message);
      return orThrow(parseRow(AlertChannels, data, 'push: alert_channels saved'));
    },
    async subscribe(userId, device) {
      const { error } = await db.from('push_subscriptions').upsert(
        { user_id: userId, endpoint: device.endpoint, p256dh: device.keys.p256dh, auth: device.keys.auth, device_label: device.label },
        { onConflict: 'user_id,endpoint' },
      );
      if (error) throw failed('subscribe this device', error.message);
    },
    async unsubscribe(userId, endpoint) {
      const { error } = await db.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
      if (error) throw failed('unsubscribe this device', error.message);
    },
  };
}
