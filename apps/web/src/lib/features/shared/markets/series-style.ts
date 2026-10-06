/**
 * Chart series styling for the watched-ZIP dashboards (07-UI-SPEC "Chart series tokens").
 * Every series differs by color, dash pattern AND marker shape, so any one cue identifies it.
 * Colors are Phase 2 token NAMES only; the class helpers return literal Tailwind utilities so
 * the scanner sees every class (no string building at the call site).
 */
import type { SeriesKey } from '@tran/core/markets';

export type MarkerShape = 'diamond' | 'square' | 'circle' | 'triangle' | 'ring';
export type ChartToken =
	'muted-foreground' | 'secondary' | 'primary' | 'foreground' | 'border-strong';

export interface SeriesStyle {
	token: ChartToken;
	/** `stroke-dasharray` value, or null for a solid line. */
	dash: string | null;
	marker: MarkerShape;
}

export const SERIES_STYLE: Record<SeriesKey, SeriesStyle> = {
	studio: { token: 'muted-foreground', dash: '2 4', marker: 'diamond' },
	'1': { token: 'secondary', dash: '8 4', marker: 'square' },
	'2': { token: 'primary', dash: null, marker: 'circle' },
	'3': { token: 'foreground', dash: '12 4 2 4', marker: 'triangle' },
	'4plus': { token: 'border-strong', dash: '4 4', marker: 'ring' }
};

export const PRICE_TO_RENT_STYLE: { token: ChartToken; dash: null; marker: 'circle' } = {
	token: 'foreground',
	dash: null,
	marker: 'circle'
};

/** Plot height in px: below 768px, and from 768px. */
export const CHART_HEIGHT = { compact: 256, regular: 320 } as const;

/** Plot gutters in px (UI-SPEC: 64px left for y labels, 32px bottom for x labels). */
export const CHART_PADDING = { top: 8, right: 16, bottom: 32, left: 64 } as const;

/** PriceToRentChart keeps 48px on the right for its direct last-point label. */
export const CHART_PADDING_LABELLED = { ...CHART_PADDING, right: 48 } as const;

/** Print variant size (Phase 9 reuse). */
export const PRINT_SIZE = { width: 640, height: 240 } as const;

const STROKE: Record<ChartToken, string> = {
	'muted-foreground': 'stroke-muted-foreground',
	secondary: 'stroke-secondary',
	primary: 'stroke-primary',
	foreground: 'stroke-foreground',
	'border-strong': 'stroke-border-strong'
};

const FILL: Record<ChartToken, string> = {
	'muted-foreground': 'fill-muted-foreground',
	secondary: 'fill-secondary',
	primary: 'fill-primary',
	foreground: 'fill-foreground',
	'border-strong': 'fill-border-strong'
};

export const strokeClass = (t: ChartToken): string => STROKE[t];
export const fillClass = (t: ChartToken): string => FILL[t];

/** X tick spacing in months: every month from 1024px, every 2 from 640px, every 3 below. */
export function xTickEvery(width: number): 1 | 2 | 3 {
	if (width >= 1024) return 1;
	if (width >= 640) return 2;
	return 3;
}

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });

/** 'YYYY-MM' -> Date at the UTC first of that month. */
export function monthDate(ym: string): Date {
	const [y, m] = ym.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, 1));
}

/** "Oct"; with the year on the first tick and every January ("Oct 2025", "Jan 2026"). */
export function tickLabel(month: string | Date, isFirst: boolean): string {
	const d = typeof month === 'string' ? monthDate(month) : month;
	const name = MONTH.format(d);
	return isFirst || d.getUTCMonth() === 0 ? `${name} ${d.getUTCFullYear()}` : name;
}
