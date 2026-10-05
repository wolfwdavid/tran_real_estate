import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAILTO_LONG_THRESHOLD, buildMailto, copyText, markSent } from './exits';

describe('buildMailto', () => {
	it('encodes line breaks as %0D%0A', () => {
		expect(buildMailto({ body: 'Line 1\nLine 2' }).href).toBe(
			'mailto:?body=Line%201%0D%0ALine%202'
		);
	});

	it('does not double CRLF input', () => {
		expect(buildMailto({ body: 'a\r\nb' }).href).toBe('mailto:?body=a%0D%0Ab');
	});

	it('keeps @ readable in the recipient and encodes &, ? and # in subject and body', () => {
		expect(
			buildMailto({ to: 'agent@example.com', subject: 'Tour & fees?', body: 'Is #4 open?' }).href
		).toBe('mailto:agent@example.com?subject=Tour%20%26%20fees%3F&body=Is%20%234%20open%3F');
	});

	it('joins multiple recipients with a bare comma', () => {
		expect(buildMailto({ to: 'a@example.com, b@example.com', body: 'Hi' }).href).toBe(
			'mailto:a@example.com,b@example.com?body=Hi'
		);
	});

	it('omits empty subject and body', () => {
		expect(buildMailto({ to: 'a@example.com', subject: '', body: 'x' }).href).toBe(
			'mailto:a@example.com?body=x'
		);
		expect(buildMailto({ to: 'a@example.com', subject: 'S', body: '' }).href).toBe(
			'mailto:a@example.com?subject=S'
		);
		expect(buildMailto({ to: 'a@example.com', body: '' }).href).toBe('mailto:a@example.com');
	});

	it('reports length and flags long links', () => {
		expect(MAILTO_LONG_THRESHOLD).toBe(1800);
		const long = buildMailto({ body: 'a'.repeat(2000) });
		expect(long.length).toBe(long.href.length);
		expect(long.long).toBe(true);
		const short = buildMailto({ body: 'a'.repeat(100) });
		expect(short.length).toBe(short.href.length);
		expect(short.long).toBe(false);
	});

	it('adds no tracking or extra params', () => {
		const { href } = buildMailto({ to: 'a@example.com', subject: 'S', body: 'B' });
		expect(href).not.toContain('utm_');
		const params = new URLSearchParams(href.split('?')[1]);
		expect([...params.keys()].sort()).toEqual(['body', 'subject']);
	});
});

describe('copyText', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns true when the clipboard write succeeds', async () => {
		const writeText = vi.fn(async () => {});
		await expect(copyText('x', { writeText })).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('x');
	});

	it('returns false instead of throwing when the write is rejected', async () => {
		await expect(
			copyText('x', {
				writeText: async () => {
					throw new DOMException('denied', 'NotAllowedError');
				}
			})
		).resolves.toBe(false);
	});

	it('returns false with no clipboard', async () => {
		await expect(copyText('x', undefined)).resolves.toBe(false);
	});

	it('reads navigator.clipboard at call time by default', async () => {
		const writeText = vi.fn(async () => {});
		vi.stubGlobal('navigator', { clipboard: { writeText } });
		await expect(copyText('late')).resolves.toBe(true);
		expect(writeText).toHaveBeenCalledWith('late');
	});
});

describe('markSent', () => {
	it('records a local sent status once and returns the date', async () => {
		const at = new Date('2026-10-04T15:42:00Z');
		const setStatus = vi.fn(async () => {});
		await expect(markSent('id1', { setStatus }, () => at)).resolves.toBe(at);
		expect(setStatus).toHaveBeenCalledTimes(1);
		expect(setStatus).toHaveBeenCalledWith('id1', 'sent', at);
	});
});
