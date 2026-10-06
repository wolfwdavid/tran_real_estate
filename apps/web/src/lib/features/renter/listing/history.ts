// The mapped PriceEvent list (Phase 4 domain row) back into RentCast's date-keyed history shape
// that @tran/core/renter/history reads. Keeps each entry's removedDate, so the detail's price
// history can show Delisted and Relisted events, not only rent changes.
import type { PriceEvent } from '@tran/core/listings';
import type { RawHistory } from '@tran/core/renter/history';

export function toRawHistory(events: readonly PriceEvent[]): RawHistory {
	return Object.fromEntries(
		events.map((e) => [
			e.date,
			{ event: e.event, price: e.price, removedDate: e.removedDate ?? null }
		])
	);
}
