import { storage } from 'wxt/utils/storage';

// The only persisted setting. 'local:enabled' is chrome.storage.local key `enabled`.
// This is the only file in apps/extension/src that imports wxt/utils/storage.
export const enabledSetting = storage.defineItem<boolean>('local:enabled', { fallback: true });

export type EnabledSetting = Pick<typeof enabledSetting, 'getValue' | 'setValue' | 'watch'>;
