// Reactive install state for the Install the app section. static/pwa-capture.js (a head script)
// catches Chromium's beforeinstallprompt before hydration, stores it on window.__tranInstallPrompt
// and dispatches tran:installable; appinstalled clears it and dispatches tran:installed.
import { announce } from '$lib/components/a11y/announcer.svelte';
import { isIos, isStandalone } from './detect';

/** Chromium's install prompt event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
	interface Window {
		/** Set by static/pwa-capture.js; cleared on appinstalled or an accepted prompt. */
		__tranInstallPrompt?: BeforeInstallPromptEvent;
	}
	interface Navigator {
		/** iOS Safari: true when running from the home screen. */
		standalone?: boolean;
	}
}

export type InstallState = 'installable' | 'ios' | 'installed' | 'unsupported';
export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

const INSTALLED_MESSAGE = 'Tran was installed.';

export function createInstallState(win: Window = window) {
	function initial(): InstallState {
		if (isStandalone(win)) return 'installed';
		if (win.__tranInstallPrompt) return 'installable';
		if (isIos(win.navigator)) return 'ios';
		return 'unsupported';
	}

	let state = $state<InstallState>(initial());
	// An accepted prompt announces at once; the browser's appinstalled event follows and must not
	// announce a second time.
	let announced = false;
	const announceInstalled = () => {
		if (announced) return;
		announced = true;
		announce(INSTALLED_MESSAGE);
	};

	const onInstallable = () => {
		if (state !== 'installed') state = 'installable';
	};
	const onInstalled = () => {
		state = 'installed';
		announceInstalled();
	};
	win.addEventListener('tran:installable', onInstallable);
	win.addEventListener('tran:installed', onInstalled);

	return {
		get state() {
			return state;
		},
		/** Opens the browser's install prompt. Resolves with the user's choice. */
		async install(): Promise<InstallOutcome> {
			const e = win.__tranInstallPrompt;
			if (!e) return 'unavailable';
			await e.prompt();
			const { outcome } = await e.userChoice;
			if (outcome === 'accepted') {
				// A prompt event can only be used once; the section switches to "installed" when the
				// browser fires appinstalled (pwa-capture.js relays it as tran:installed).
				win.__tranInstallPrompt = undefined;
				announceInstalled();
			}
			return outcome;
		},
		dispose() {
			win.removeEventListener('tran:installable', onInstallable);
			win.removeEventListener('tran:installed', onInstalled);
		}
	};
}
