// Safe contact and outbound links (RENT-03). Listing fields come from a third party and are
// rendered on an origin that holds API keys, so no listing string ever reaches an href
// unvalidated: phones become tel:+1 digits, emails become a bare mailto:, and websites keep
// only the http(s) schemes. Labels live in the components; this file only builds hrefs.

const PHONE_CHARS = /^[\d\s().+-]+$/;

/** The 10 NANP digits of a US phone number, or null. */
function usDigits(raw: string | null | undefined): string | null {
	if (typeof raw !== 'string' || !PHONE_CHARS.test(raw.trim())) return null;
	let digits = raw.replace(/\D/g, '');
	if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
	return /^\d{10}$/.test(digits) ? digits : null;
}

export function telHref(raw: string | null | undefined): string | null {
	const d = usDigits(raw);
	return d ? 'tel:+1' + d : null;
}

/** "(405) 555-0142" style display, or null when the value is not a US number. */
export function formatPhone(raw: string | null | undefined): string | null {
	const d = usDigits(raw);
	return d ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : null;
}

const EMAIL = /^[^\s@<>()"',;:?&]+@[^\s@<>()"',;:?&]+\.[A-Za-z]{2,}$/;

/** mailto: with the address only: never a body, subject or other header. */
export function mailtoHref(raw: string | null | undefined): string | null {
	if (typeof raw !== 'string') return null;
	const email = raw.trim();
	return EMAIL.test(email) ? `mailto:${email}` : null;
}

/** An absolute http(s) URL, or null. Bare hosts default to https. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
	if (typeof raw !== 'string') return null;
	const s = raw.trim();
	if (!s) return null;
	try {
		const u = new URL(s.includes('://') ? s : `https://${s}`);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
	} catch {
		return null;
	}
}

export type OutboundSearchId = 'google' | 'zillow' | 'apartments';

/** "Search elsewhere" links: plain searches for the address, never data extraction. */
export function outboundSearchLinks(fullAddress: string): { id: OutboundSearchId; href: string }[] {
	const enc = encodeURIComponent(fullAddress);
	return [
		{ id: 'google', href: `https://www.google.com/search?q=${enc}` },
		{ id: 'zillow', href: `https://www.zillow.com/homes/${enc}_rb/` },
		{
			id: 'apartments',
			href: `https://www.google.com/search?q=${encodeURIComponent('site:apartments.com ' + fullAddress)}`
		}
	];
}

/** Shape check for a `?id=` listing id read from the URL before any lookup. */
export function looksLikeListingId(s: string): boolean {
	return typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9,.\-]{2,199}$/.test(s);
}
