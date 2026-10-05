// Listing price/event history (RENT-03). Pure: RentCast's date-keyed history object in,
// a newest-first event list out. If Phase 4's domain row reshapes history, adapt it to
// RawHistory in the component, not here.

export type HistoryEventKind = 'listed' | 'rent-changed' | 'delisted' | 'relisted';

export interface HistoryEvent {
	/** YYYY-MM-DD */
	date: string;
	kind: HistoryEventKind;
	rent: number | null;
	/** Signed difference from the previous recorded rent; only set on 'rent-changed'. */
	change: number | null;
}

export type RawHistory =
	| Record<
			string,
			{
				event?: string | null;
				price?: number | null;
				listedDate?: string | null;
				removedDate?: string | null;
				daysOnMarket?: number | null;
			}
	  >
	| null
	| undefined;

export type HistorySummary =
	| { kind: 'none'; listedOn: string }
	| { kind: 'one'; from: number; to: number; on: string }
	| { kind: 'many'; first: number; firstOn: string; last: number; lastOn: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const priceOf = (v: unknown): number | null =>
	typeof v === 'number' && Number.isFinite(v) ? v : null;

const dayOf = (v: string | null | undefined): string | null =>
	typeof v === 'string' && DATE_KEY.test(v.slice(0, 10)) ? v.slice(0, 10) : null;

export function historyEvents(h: RawHistory): HistoryEvent[] {
	if (!h || typeof h !== 'object') return [];
	const keys = Object.keys(h)
		.filter((k) => DATE_KEY.test(k))
		.sort();
	const out: HistoryEvent[] = [];
	let prevPrice: number | null = null;
	let wasDelisted = false;

	keys.forEach((date, i) => {
		const entry = h[date] ?? {};
		const rent = priceOf(entry.price);
		if (i === 0) {
			out.push({ date, kind: 'listed', rent, change: null });
		} else if (wasDelisted) {
			out.push({ date, kind: 'relisted', rent, change: null });
		} else if (rent !== null && prevPrice !== null && rent !== prevPrice) {
			out.push({ date, kind: 'rent-changed', rent, change: rent - prevPrice });
		}
		wasDelisted = false;
		if (rent !== null) prevPrice = rent;
		const removed = dayOf(entry.removedDate);
		if (removed) {
			out.push({ date: removed, kind: 'delisted', rent, change: null });
			wasDelisted = true;
		}
	});

	// Built oldest-first; a stable sort keeps same-day events in causal order before reversing.
	return out
		.map((e, idx) => ({ e, idx }))
		.sort((a, b) => (a.e.date === b.e.date ? a.idx - b.idx : a.e.date < b.e.date ? -1 : 1))
		.map(({ e }) => e)
		.reverse();
}

export function historySummary(events: HistoryEvent[]): HistorySummary | null {
	if (events.length === 0) return null;
	const oldestFirst = [...events].reverse();
	const changes = oldestFirst.filter(
		(e): e is HistoryEvent & { rent: number } => e.kind === 'rent-changed' && e.rent !== null
	);
	const listed = oldestFirst.find((e) => e.kind === 'listed') ?? oldestFirst[0]!;
	if (changes.length === 0) return { kind: 'none', listedOn: listed.date };
	const firstChange = changes[0]!;
	if (changes.length === 1) {
		return {
			kind: 'one',
			from: firstChange.rent - (firstChange.change ?? 0),
			to: firstChange.rent,
			on: firstChange.date
		};
	}
	const last = changes[changes.length - 1]!;
	const first = listed.rent ?? firstChange.rent - (firstChange.change ?? 0);
	return { kind: 'many', first, firstOn: listed.date, last: last.rent, lastOn: last.date };
}

/** Rents oldest-first for the sparkline, excluding delisted entries and unknown prices. */
export function pricePoints(events: HistoryEvent[]): number[] {
	const out: number[] = [];
	for (const e of [...events].reverse()) {
		if (e.kind !== 'delisted' && e.rent !== null) out.push(e.rent);
	}
	return out;
}
