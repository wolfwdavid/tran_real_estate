// Contacts CSV export (AGT-07, UI-SPEC "CSV export"). The file bytes come from the one shared
// serializer in @tran/core/csv (BOM, quote-all, CRLF, formula escaping, samples and tombstones
// excluded), so a Tran export always re-imports through the same column contract. This module
// only decides whether there is anything to export, names the file, and hands it to the browser.
import { isLive, type Contact } from '@tran/core/agent';
import { exportContactsCsv } from '@tran/core/csv';

export interface ContactsExport {
	/** tran-contacts-YYYY-MM-DD.csv */
	filename: string;
	/** The complete file text, starting with the UTF-8 BOM. */
	text: string;
	/** Live, non-sample contacts in the file. */
	count: number;
}

/**
 * The export for the agent's own contacts, or null when there are none (no contacts, or only
 * samples). `today` is the local calendar date (YYYY-MM-DD) used in the filename.
 */
export function buildExport(contacts: readonly Contact[], today: string): ContactsExport | null {
	const count = contacts.filter((c) => !c.sample && isLive(c)).length;
	if (count === 0) return null;
	return { filename: `tran-contacts-${today}.csv`, text: exportContactsCsv(contacts), count };
}

/**
 * Same-origin blob download via a temporary <a download> (the Phase 3 backup mechanism; blob:
 * needs no CSP change for downloads). Browser only.
 */
export function downloadText(filename: string, text: string): void {
	const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
	const a = Object.assign(document.createElement('a'), { href: url, download: filename });
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 0);
}
