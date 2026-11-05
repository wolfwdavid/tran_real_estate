// Memo artifact meta (DEBT-03). The memo page allows numerals from the user's notes, but the print
// page re-runs the number check later without the notes. So the notes' numerals are written into the
// artifact meta at creation and read back at /print/memo/. Format: distinct finite values, each in
// String() form (Number() restores the exact double), single-space joined, packed into <= 200-char
// chunks under `notesNumbers`, `notesNumbers.1` ... `notesNumbers.11`. If the values need more than
// 12 chunks, none are stored and the print stays blocked on those numbers (fail closed). Memos saved
// before this change have no notesNumbers and keep the old fail-closed print until redrafted.
import { allowedFromText } from '@tran/core/numbers';

export const NOTES_NUMBERS_KEY = 'notesNumbers';
const CHUNK_MAX = 200;
const MAX_CHUNKS = 12; // + analysisHash + copied = 14 <= the store's 16 meta keys

const chunkKey = (i: number) => (i === 0 ? NOTES_NUMBERS_KEY : `${NOTES_NUMBERS_KEY}.${i}`);

/** Meta for a new memo artifact: the analysis hash plus the notes' allowed numerals. */
export function memoArtifactMeta(analysisHash: string, notes: string): Record<string, string> {
	const meta: Record<string, string> = { analysisHash };
	const values = [
		...new Set(
			allowedFromText(notes, 'your notes')
				.map((a) => a.value)
				.filter(Number.isFinite)
				.map(String)
		)
	];
	const chunks: string[] = [];
	let current = '';
	for (const v of values) {
		if (current === '') current = v;
		else if (current.length + 1 + v.length <= CHUNK_MAX) current += ' ' + v;
		else {
			chunks.push(current);
			current = v;
		}
	}
	if (current !== '') chunks.push(current);
	if (chunks.length > MAX_CHUNKS) return meta;
	chunks.forEach((c, i) => (meta[chunkKey(i)] = c));
	return meta;
}

/** The notes numerals stored by memoArtifactMeta; [] for memos without them. */
export function notesNumbersFromMeta(meta: Readonly<Record<string, string>> | undefined): number[] {
	const out: number[] = [];
	if (!meta) return out;
	for (let i = 0; i < MAX_CHUNKS; i++) {
		const chunk = meta[chunkKey(i)];
		if (typeof chunk !== 'string') break;
		for (const token of chunk.split(' ')) {
			if (token === '') continue;
			const n = Number(token);
			if (Number.isFinite(n)) out.push(n);
		}
	}
	return out;
}
