// Pins the Search Console slot in apps/web/src/app.html (12-05). Kit emits the CSP meta inside
// %sveltekit.head%, so the google-site-verification meta must come after that placeholder, on the
// line directly after the marker. A meta pasted anywhere else either precedes the CSP meta (which
// csp:assert rejects in the built HTML) or drifts away from the documented slot.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const APP_HTML = readFileSync(join(ROOT, 'apps/web/src/app.html'), 'utf8');

const MARKER_PREFIX = '<!-- search-console:';
const CHARSET = '<meta charset="utf-8" />';
const HEAD = '%sveltekit.head%';
const FRAME_GUARD = 'frame-guard.js';
const VERIFICATION_RE =
	/^\s*<meta name="google-site-verification" content="[A-Za-z0-9_-]{20,}" \/>$/;

/** Returns every rule the app.html template breaks; [] when the slot is intact. */
function checkAppHtml(text: string): string[] {
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	const trimmed = lines.map((l) => l.trim());
	const errors: string[] = [];
	const indexOf = (pred: (l: string) => boolean) => trimmed.findIndex(pred);

	const charset = indexOf((l) => l === CHARSET);
	const head = indexOf((l) => l === HEAD);
	const markers = trimmed.flatMap((l, i) => (l.startsWith(MARKER_PREFIX) ? [i] : []));
	const frame = indexOf((l) => l.includes(FRAME_GUARD));

	if (charset === -1) errors.push(`missing ${CHARSET}`);
	if (head === -1) errors.push(`missing ${HEAD}`);
	if (frame === -1) errors.push(`missing ${FRAME_GUARD}`);
	if (markers.length === 0) errors.push('missing the search-console marker');
	if (markers.length > 1) errors.push('more than one search-console marker');
	const marker = markers[0] ?? -1;

	if (charset !== -1 && head !== -1 && charset > head) {
		errors.push(`${CHARSET} must come before ${HEAD}`);
	}
	if (marker !== -1 && head !== -1 && marker !== head + 1) {
		errors.push(`the search-console marker must be on the line directly after ${HEAD}`);
	}
	if (marker !== -1 && frame !== -1 && marker > frame) {
		errors.push(`the search-console marker must come before ${FRAME_GUARD}`);
	}

	// Verification metas: any non-comment line naming google-site-verification.
	const metas = trimmed.flatMap((l, i) =>
		!l.startsWith('<!--') && l.includes('google-site-verification') ? [i] : []
	);
	if (metas.length > 1) errors.push('more than one google-site-verification meta');
	for (const i of metas) {
		if (head !== -1 && i < head) {
			errors.push(`the google-site-verification meta must come after ${HEAD}`);
		}
		if (marker === -1 || i !== marker + 1) {
			errors.push(
				'the google-site-verification meta must be on the line directly after the marker'
			);
		}
		if (!VERIFICATION_RE.test(lines[i])) {
			errors.push(
				'the google-site-verification meta must be <meta name="google-site-verification" content="<20+ of A-Za-z0-9_->" />'
			);
		}
	}
	return errors;
}

const MARKER_LINE =
	'\t\t<!-- search-console: the google-site-verification meta goes on the next line (docs/DEPLOY-CHECKLIST.md Step 8) -->';
const TOKEN = 'sample-site-verification-value-for-tests-00'; // 43 chars, fictional and low-entropy
const META = `\t\t<meta name="google-site-verification" content="${TOKEN}" />`;

/** A minimal template shaped like the real one, with the head lines given. */
function template(headLines: string[]): string {
	return [
		'<!doctype html>',
		'<html lang="en" hidden>',
		'\t<head>',
		...headLines,
		'\t</head>',
		'\t<body></body>',
		'</html>'
	].join('\n');
}
const CHARSET_LINE = `\t\t${CHARSET}`;
const HEAD_LINE = `\t\t${HEAD}`;
const FRAME_LINE = '\t\t<script src="%sveltekit.assets%/frame-guard.js"></script>';

describe('real app.html', () => {
	test('passes the slot contract', () => {
		expect(checkAppHtml(APP_HTML)).toEqual([]);
	});

	test('orders charset < %sveltekit.head% < marker < frame-guard, marker adjacent to head', () => {
		const lines = APP_HTML.replace(/\r\n/g, '\n').split('\n');
		const at = (s: string) => lines.findIndex((l) => l.includes(s));
		expect(at(CHARSET)).toBeLessThan(at(HEAD));
		expect(at(MARKER_PREFIX)).toBe(at(HEAD) + 1);
		expect(at(MARKER_PREFIX)).toBeLessThan(at(FRAME_GUARD));
		expect(lines[at(MARKER_PREFIX)]).toMatch(/^\t\t<!-- search-console: .* -->$/);
	});
});

describe('planted templates', () => {
	test('a valid 43-char verification meta right after the marker passes', () => {
		const t = template([CHARSET_LINE, HEAD_LINE, MARKER_LINE, META, FRAME_LINE]);
		expect(checkAppHtml(t)).toEqual([]);
	});

	test('marker before %sveltekit.head% fails', () => {
		const t = template([CHARSET_LINE, MARKER_LINE, HEAD_LINE, FRAME_LINE]);
		expect(checkAppHtml(t).join()).toMatch(/directly after %sveltekit\.head%/);
	});

	test('missing marker fails', () => {
		const t = template([CHARSET_LINE, HEAD_LINE, FRAME_LINE]);
		expect(checkAppHtml(t).join()).toMatch(/missing the search-console marker/);
	});

	test('verification meta before %sveltekit.head% fails', () => {
		const t = template([CHARSET_LINE, META, HEAD_LINE, MARKER_LINE, FRAME_LINE]);
		expect(checkAppHtml(t).join()).toMatch(/must come after %sveltekit\.head%/);
	});

	test('verification meta not adjacent to the marker fails', () => {
		const t = template([CHARSET_LINE, HEAD_LINE, MARKER_LINE, FRAME_LINE, META]);
		expect(checkAppHtml(t).join()).toMatch(/directly after the marker/);
	});

	test('two verification metas fail', () => {
		const t = template([CHARSET_LINE, HEAD_LINE, MARKER_LINE, META, META, FRAME_LINE]);
		expect(checkAppHtml(t).join()).toMatch(/more than one google-site-verification meta/);
	});

	test('a token shorter than 20 characters fails', () => {
		const short = `\t\t<meta name="google-site-verification" content="abc123" />`;
		const t = template([CHARSET_LINE, HEAD_LINE, MARKER_LINE, short, FRAME_LINE]);
		expect(checkAppHtml(t).join()).toMatch(/must be <meta name="google-site-verification"/);
	});

	test('a token containing a quote or angle bracket fails', () => {
		for (const bad of [`${TOKEN}"x`, `${TOKEN}<script>`]) {
			const meta = `\t\t<meta name="google-site-verification" content="${bad}" />`;
			const t = template([CHARSET_LINE, HEAD_LINE, MARKER_LINE, meta, FRAME_LINE]);
			expect(checkAppHtml(t).join()).toMatch(/must be <meta name="google-site-verification"/);
		}
	});

	test('marker after frame-guard fails', () => {
		const t = template([CHARSET_LINE, HEAD_LINE, FRAME_LINE, MARKER_LINE]);
		const errs = checkAppHtml(t).join();
		expect(errs).toMatch(/directly after %sveltekit\.head%/);
		expect(errs).toMatch(/before frame-guard\.js/);
	});
});
