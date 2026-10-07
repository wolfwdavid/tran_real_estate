// CSV byte decoding (08-20, AGT-07; RESEARCH Pattern 12). Strict UTF-8 first: the decoder drops a
// leading BOM and throws on any malformed sequence. Excel's plain "CSV (Comma delimited)" is not
// UTF-8, so that failure falls back to windows-1252, which maps every byte. Core has no
// TextDecoder type, which is why this lives in the web app.

export type CsvEncoding = 'utf-8' | 'windows-1252';

export interface DecodedCsv {
	text: string;
	encoding: CsvEncoding;
}

export function decodeCsvBytes(buf: BufferSource): DecodedCsv {
	try {
		return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'utf-8' };
	} catch {
		return { text: new TextDecoder('windows-1252').decode(buf), encoding: 'windows-1252' };
	}
}
