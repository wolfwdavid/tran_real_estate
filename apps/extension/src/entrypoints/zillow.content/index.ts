import './style.css';
import { browser } from 'wxt/browser';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { ZILLOW_MATCH } from '../../lib/config';
import { wireContent } from '../../lib/content-wiring';
import { enabledSetting } from '../../lib/settings';

// Thin wiring only; every behaviour lives in tested lib modules. The filter gates on the
// results container being present, not on the URL.
export default defineContentScript({
	matches: [ZILLOW_MATCH],
	runAt: 'document_idle',
	async main(ctx) {
		await wireContent(ctx, {
			doc: document,
			win: window,
			runtime: browser.runtime,
			setting: enabledSetting
		});
	}
});
