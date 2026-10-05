import { describe, expect, it } from 'vitest';
import {
	formatPhone,
	looksLikeListingId,
	mailtoHref,
	outboundSearchLinks,
	safeHttpUrl,
	telHref
} from './contact-links.js';

// Planted values are assembled from fragments so no contiguous phone/email sits in source.
const PHONE = ['405', '555', '0142'].join('');
const DASHED = ['1', '405', '555', '0142'].join('-');
const EMAIL = ['jane.doe', 'example.com'].join('@');

describe('telHref', () => {
	it('builds tel:+1 from 10 or 11 digits', () => {
		expect(telHref(PHONE)).toBe(`tel:+1${PHONE}`);
		expect(telHref(DASHED)).toBe(`tel:+1${PHONE}`);
	});
	it('rejects short, empty and missing values', () => {
		expect(telHref('555')).toBeNull();
		expect(telHref('')).toBeNull();
		expect(telHref(null)).toBeNull();
		expect(telHref(undefined)).toBeNull();
	});
	it('rejects values carrying letters or scheme text', () => {
		expect(telHref(`javascript:${PHONE}`)).toBeNull();
	});
});

describe('formatPhone', () => {
	it('formats US numbers', () => {
		expect(formatPhone(PHONE)).toBe('(405) 555-0142');
	});
	it('returns null for invalid input', () => {
		expect(formatPhone('555')).toBeNull();
		expect(formatPhone(null)).toBeNull();
	});
});

describe('mailtoHref', () => {
	it('builds mailto with no body or subject', () => {
		expect(mailtoHref(EMAIL)).toBe(`mailto:${EMAIL}`);
	});
	it('rejects malformed or parameter-carrying addresses', () => {
		expect(mailtoHref('bad@')).toBeNull();
		expect(mailtoHref(['a b', 'example.com'].join('@'))).toBeNull();
		expect(mailtoHref(['x', 'example.com?body=hi'].join('@'))).toBeNull();
		expect(mailtoHref(null)).toBeNull();
	});
});

describe('safeHttpUrl', () => {
	it('drops every non-http(s) scheme', () => {
		expect(safeHttpUrl('javascript:alert(1)')).toBeNull();
		expect(safeHttpUrl('JavaScript:alert(1)')).toBeNull();
		expect(safeHttpUrl('data:text/html,x')).toBeNull();
		expect(safeHttpUrl('vbscript:msgbox')).toBeNull();
		expect(safeHttpUrl('ftp://example.com/x')).toBeNull();
	});
	it('defaults bare hosts to https and normalizes', () => {
		expect(safeHttpUrl('example.com/agents/x')).toBe('https://example.com/agents/x');
		expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
	});
	it('rejects empty and missing values', () => {
		expect(safeHttpUrl('')).toBeNull();
		expect(safeHttpUrl('   ')).toBeNull();
		expect(safeHttpUrl(null)).toBeNull();
	});
});

describe('outboundSearchLinks', () => {
	it('returns google, zillow and apartments links in order', () => {
		const addr = '418 Larkspur Ln, Harlow Springs, OK 74201';
		const enc = encodeURIComponent(addr);
		expect(outboundSearchLinks(addr)).toEqual([
			{ id: 'google', href: `https://www.google.com/search?q=${enc}` },
			{ id: 'zillow', href: `https://www.zillow.com/homes/${enc}_rb/` },
			{
				id: 'apartments',
				href: `https://www.google.com/search?q=${encodeURIComponent('site:apartments.com ' + addr)}`
			}
		]);
	});
});

describe('looksLikeListingId', () => {
	it('accepts RentCast-style ids', () => {
		expect(looksLikeListingId('3821-Hargis-St,-Austin,-TX-78723')).toBe(true);
	});
	it('rejects empty, markup and oversized values', () => {
		expect(looksLikeListingId('')).toBe(false);
		expect(looksLikeListingId('<script>')).toBe(false);
		expect(looksLikeListingId('a'.repeat(300))).toBe(false);
	});
});
