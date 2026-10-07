// Paste import glue (08-20, AGT-03): turns pasted email text into IncomingLeads for the dry-run
// diff. TRAN-LEAD v1 blocks win (exact fields, one lead per block); only when the text holds no
// block at all does the free-form pass look for at most one lead by pattern. The pasted text is
// never stored: it lives in the textarea until the agent checks it, and only the leads they
// choose to add reach IndexedDB.
import type { IncomingLead } from '@tran/core/agent/types';
import { parseLeadBlocks } from '@tran/core/leads/lead-block';
import { parseFreeform } from '@tran/core/leads/parse-freeform';

/** UI-SPEC: the textarea accepts up to 100,000 characters; longer pastes are refused, not cut. */
export const MAX_PASTE_CHARS = 100_000;

export type PasteMode = 'blocks' | 'freeform' | 'none' | 'empty' | 'too-long';

export interface PasteResult {
	mode: PasteMode;
	leads: IncomingLead[];
	/** TRAN-LEAD blocks from a newer format version (skipped, reported). */
	newerVersion: number;
	/** v1 blocks that could not be read (missing key, bad email, over a cap): skipped. */
	invalid: number;
}

const empty = (mode: PasteMode): PasteResult => ({ mode, leads: [], newerVersion: 0, invalid: 0 });

export function pasteToLeads(text: string): PasteResult {
	if (text.length > MAX_PASTE_CHARS) return empty('too-long');
	if (text.trim() === '') return empty('empty');

	const blocks = parseLeadBlocks(text);
	if (blocks.length > 0) {
		const leads: IncomingLead[] = [];
		let newerVersion = 0;
		let invalid = 0;
		for (const block of blocks) {
			if (!block.ok) {
				if (block.error === 'newer-version') newerVersion += 1;
				else invalid += 1;
				continue;
			}
			const { lead } = block;
			leads.push({
				rowNumber: leads.length + 1,
				name: lead.name,
				email: lead.email,
				phone: lead.phone,
				propertyOfInterest: lead.property,
				notes: '',
				source: 'inquiry',
				consentSource: lead.consent ? 'inquiry-form' : 'unknown',
				message: lead.message
			});
		}
		// Text that carries blocks is an inquiry email: never guess a second lead from its prose.
		return { mode: leads.length > 0 ? 'blocks' : 'none', leads, newerVersion, invalid };
	}

	const found = parseFreeform(text);
	if (found === null) return empty('none');
	return {
		mode: 'freeform',
		leads: [
			{
				rowNumber: 1,
				name: found.name,
				email: found.email,
				phone: found.phone,
				propertyOfInterest: '',
				notes: '',
				source: 'paste',
				consentSource: 'unknown'
			}
		],
		newerVersion: 0,
		invalid: 0
	};
}
