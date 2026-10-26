import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { applyBadge, initBadgeColors } from '../lib/badge';
import { isCountPush } from '../lib/messages';

// Badge-only service worker: one synchronous listener, never answers (no sendResponse), no
// alarms, no storage writes. action.setBadge* need no permission.
export default defineBackground(() => {
	initBadgeColors(browser.action);
	browser.runtime.onMessage.addListener((msg, sender) => {
		if (isCountPush(msg) && sender.tab?.id !== undefined)
			applyBadge(browser.action, sender.tab.id, msg);
	});
});
