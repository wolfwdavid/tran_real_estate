import { describe, expect, it } from 'vitest';
import { SERIES_KEYS } from '@tran/core/markets';
import {
	CHART_HEIGHT,
	PRICE_TO_RENT_STYLE,
	SERIES_STYLE,
	monthDate,
	strokeClass,
	fillClass,
	tickLabel,
	xTickEvery
} from './series-style';

describe('SERIES_STYLE (07-UI-SPEC chart series tokens)', () => {
	it('matches the series contract table exactly', () => {
		expect(SERIES_STYLE).toEqual({
			studio: { token: 'muted-foreground', dash: '2 4', marker: 'diamond' },
			'1': { token: 'secondary', dash: '8 4', marker: 'square' },
			'2': { token: 'primary', dash: null, marker: 'circle' },
			'3': { token: 'foreground', dash: '12 4 2 4', marker: 'triangle' },
			'4plus': { token: 'border-strong', dash: '4 4', marker: 'ring' }
		});
	});

	it('gives every series a distinct token, dash and marker (never color alone)', () => {
		const styles = SERIES_KEYS.map((k) => SERIES_STYLE[k]);
		expect(new Set(styles.map((s) => s.token)).size).toBe(5);
		expect(new Set(styles.map((s) => s.dash)).size).toBe(5);
		expect(new Set(styles.map((s) => s.marker)).size).toBe(5);
	});

	it('styles price-to-rent as a solid foreground line with circles', () => {
		expect(PRICE_TO_RENT_STYLE).toEqual({ token: 'foreground', dash: null, marker: 'circle' });
	});

	it('maps tokens to literal Tailwind token utilities', () => {
		expect(strokeClass('primary')).toBe('stroke-primary');
		expect(strokeClass('border-strong')).toBe('stroke-border-strong');
		expect(fillClass('muted-foreground')).toBe('fill-muted-foreground');
		expect(fillClass('secondary')).toBe('fill-secondary');
	});

	it('uses the UI-SPEC plot heights', () => {
		expect(CHART_HEIGHT).toEqual({ compact: 256, regular: 320 });
	});
});

describe('xTickEvery', () => {
	it.each([
		[1280, 1],
		[1024, 1],
		[1023, 2],
		[800, 2],
		[640, 2],
		[639, 3],
		[375, 3],
		[0, 3]
	])('width %i -> every %i month(s)', (w, n) => {
		expect(xTickEvery(w)).toBe(n);
	});
});

describe('tickLabel', () => {
	it('shows the year on the first tick', () => {
		expect(tickLabel('2025-10', true)).toBe('Oct 2025');
	});
	it('shows only the month on later ticks', () => {
		expect(tickLabel('2025-11', false)).toBe('Nov');
	});
	it('shows the year on every January', () => {
		expect(tickLabel('2026-01', false)).toBe('Jan 2026');
		expect(tickLabel('2026-01', true)).toBe('Jan 2026');
	});
	it('accepts a UTC Date', () => {
		expect(tickLabel(new Date(Date.UTC(2025, 11, 1)), false)).toBe('Dec');
	});
});

describe('monthDate', () => {
	it('returns the UTC first of the month', () => {
		expect(monthDate('2025-10').toISOString()).toBe('2025-10-01T00:00:00.000Z');
	});
});
