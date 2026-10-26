import { browser } from 'wxt/browser';
import { isCountPush } from '../../lib/messages';
import type { PopupDeps } from '../../lib/popup-model';
import { enabledSetting } from '../../lib/settings';

// The only popup module that touches the browser global. App.svelte receives these deps as a
// prop, so the browser-mode tests can inject every state without a real extension context.
export function createBrowserDeps(): PopupDeps {
	return {
		readEnabled: () => enabledSetting.getValue(),
		writeEnabled: (value) => enabledSetting.setValue(value),
		// No `tabs` permission: the URL is visible only on zillow.com, through the host permission.
		activeTab: async () => (await browser.tabs.query({ active: true, currentWindow: true }))[0],
		sendToTab: (tabId, message) => browser.tabs.sendMessage(tabId, message),
		onCountPush: (listener) => {
			const handler = (message: unknown, sender: { tab?: { id?: number } }) => {
				if (isCountPush(message)) listener(message, sender.tab?.id);
			};
			browser.runtime.onMessage.addListener(handler);
			return () => browser.runtime.onMessage.removeListener(handler);
		}
	};
}
