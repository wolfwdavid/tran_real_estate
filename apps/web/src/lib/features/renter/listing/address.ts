// Address lines for the listing detail (06-14). Pure, so cards, titles and announcements agree.
import type { Listing } from '@tran/core/listings';

type AddressParts = Pick<
	Listing,
	'formattedAddress' | 'addressLine1' | 'city' | 'state' | 'zipCode'
> &
	Pick<Partial<Listing>, 'addressLine2'>;

/** "12 Oak St, Apt 4B": line 1 (+ line 2), else the part of formattedAddress before the city. */
export function streetLine(row: AddressParts): string {
	const line1 = row.addressLine1?.trim() || row.formattedAddress.split(',')[0]?.trim() || '';
	const line2 = row.addressLine2?.trim();
	return line2 ? `${line1}, ${line2}` : line1;
}

/** "Harlow Springs, OK 74201" (missing parts are left out). */
export function placeLine(row: AddressParts): string {
	const stateZip = [row.state, row.zipCode].filter(Boolean).join(' ');
	return [row.city, stateZip].filter(Boolean).join(', ');
}
