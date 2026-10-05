// The single polite live region's message. LiveAnnouncer (root layout) renders it; any component
// calls announce(). Messages are fixed UI copy and NEVER contain key material, last4 or passphrases.
// This module imports nothing from storage, so it is safe on marketing pages.

const state = $state({ message: '' });

/** Current announcer text (read by LiveAnnouncer). */
export function announcerMessage(): string {
	return state.message;
}

/**
 * Announces `message` politely. Clears the region first and sets the text on the next animation
 * frame, so repeating the same message is announced again.
 */
export function announce(message: string): void {
	state.message = '';
	const set = () => {
		state.message = message;
	};
	if (typeof requestAnimationFrame === 'function') requestAnimationFrame(set);
	else setTimeout(set, 0);
}
