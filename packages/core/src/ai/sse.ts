/**
 * Server-sent events parser: a pure, chunk-boundary-safe subset of the WHATWG
 * event-stream format, sized for POST streaming responses.
 *
 * - LF, CR and CRLF line endings (a CRLF split across two pushes is one ending).
 * - Comment lines (`:`) are ignored; `id` and `retry` are ignored (no reconnection).
 * - Multi-line `data` joins with `\n`; one leading space after the colon is stripped.
 * - An event dispatches on a blank line only when it carried at least one data line.
 * - The `[DONE]` sentinel is returned as ordinary data (adapters handle it).
 *
 * Callers decode bytes with `TextDecoder.decode(chunk, { stream: true })` before
 * pushing, so split UTF-8 sequences never reach this parser.
 */
export type SseEvent = { event: string; data: string };

export function createSseParser(): { push(chunk: string): SseEvent[]; end(): SseEvent[] } {
	let buf = '';
	let event = '';
	let data: string[] = [];
	let sawCR = false;
	const out: SseEvent[] = [];

	const dispatch = (): void => {
		if (data.length) out.push({ event: event || 'message', data: data.join('\n') });
		event = '';
		data = [];
	};

	const line = (l: string): void => {
		if (l === '') return dispatch();
		if (l.startsWith(':')) return; // comment, e.g. ": OPENROUTER PROCESSING"
		const i = l.indexOf(':');
		const field = i === -1 ? l : l.slice(0, i);
		let value = i === -1 ? '' : l.slice(i + 1);
		if (value.startsWith(' ')) value = value.slice(1);
		if (field === 'event') event = value;
		else if (field === 'data') data.push(value);
		// id / retry ignored (no reconnection for POST streams)
	};

	return {
		push(chunk: string): SseEvent[] {
			buf += chunk;
			let start = 0;
			for (let i = 0; i < buf.length; i++) {
				const c = buf[i];
				if (c === '\n' && sawCR) {
					// second half of a CRLF pair
					sawCR = false;
					start = i + 1;
					continue;
				}
				sawCR = false;
				if (c === '\r' || c === '\n') {
					line(buf.slice(start, i));
					sawCR = c === '\r';
					start = i + 1;
				}
			}
			buf = buf.slice(start);
			return out.splice(0);
		},
		end(): SseEvent[] {
			if (buf) line(buf);
			buf = '';
			sawCR = false;
			dispatch();
			return out.splice(0);
		}
	};
}
