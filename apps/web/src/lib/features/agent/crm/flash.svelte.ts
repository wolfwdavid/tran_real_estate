// A one-shot status message carried across a navigation (Delete contact -> /agent/contacts/).
// Module state, never the URL or history: a contact's name is not written anywhere that outlives
// the redirect. The message expires after FLASH_TTL_MS because its only reader (ContactsView)
// mounts just when the CRM has contacts; deleting the last contact must not leave "Deleted X."
// waiting to surface the next time the list renders.
const FLASH_TTL_MS = 10_000;

let flash = $state<{ message: string; at: number } | null>(null);

/** Stores `message` for the next ContactsView mount. */
export function setFlash(message: string): void {
	flash = { message, at: Date.now() };
}

/** Returns and clears the pending message, or null when there is none or it has expired. */
export function takeFlash(): string | null {
	const f = flash;
	flash = null;
	if (!f || Date.now() - f.at > FLASH_TTL_MS) return null;
	return f.message;
}
