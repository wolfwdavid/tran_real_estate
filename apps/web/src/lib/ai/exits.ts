// The ONLY exit implementations for AI output (AI-04). Nothing here sends anything: the user
// copies the text, or clicks a mailto: link and presses send in their own email app.
// navigator.clipboard and 'mailto:' must not appear anywhere else under lib/ai (asserted in
// no-auto-send.test.ts).

type ClipboardLike = { writeText(t: string): Promise<void> };

/** Clipboard API only. Reports failure (permission, no API) instead of throwing. */
export async function copyText(
	text: string,
	clipboard: ClipboardLike | undefined = globalThis.navigator?.clipboard
): Promise<boolean> {
	if (!clipboard?.writeText) return false;
	try {
		await clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/** Above this many characters some email clients truncate or refuse the link. */
export const MAILTO_LONG_THRESHOLD = 1800;

const norm = (s: string): string => s.replace(/\r?\n/g, '\r\n');

/**
 * Builds an RFC 6068 mailto: href for an <a> the user clicks. Never navigates by itself and
 * adds no params other than subject and body.
 */
export function buildMailto(o: { to?: string; subject?: string; body: string }): {
	href: string;
	length: number;
	long: boolean;
} {
	const recipients = (o.to ?? '')
		.split(',')
		.map((a) => a.trim())
		.filter(Boolean)
		.map((a) => encodeURIComponent(a).replace(/%40/g, '@'))
		.join(',');
	const params: string[] = [];
	if (o.subject) params.push('subject=' + encodeURIComponent(norm(o.subject)));
	if (o.body) params.push('body=' + encodeURIComponent(norm(o.body)));
	const href = 'mailto:' + recipients + (params.length ? '?' + params.join('&') : '');
	return { href, length: href.length, long: href.length > MAILTO_LONG_THRESHOLD };
}

/** "Mark as sent" is a local note in Draft history, never a delivery. */
export async function markSent(
	id: string,
	repo: { setStatus(id: string, status: 'sent', at: Date): Promise<void> },
	now: () => Date = () => new Date()
): Promise<Date> {
	const at = now();
	await repo.setStatus(id, 'sent', at);
	return at;
}
