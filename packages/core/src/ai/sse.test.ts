import { describe, expect, test } from 'vitest';

import { createSseParser, type SseEvent } from './sse.js';

function runAll(chunks: string[]): SseEvent[] {
	const p = createSseParser();
	return [...chunks.flatMap((c) => p.push(c)), ...p.end()];
}

function parse(text: string): SseEvent[] {
	return runAll([text]);
}

describe('createSseParser', () => {
	test('a single data line dispatches a message event', () => {
		const p = createSseParser();
		expect(p.push('data: hello\n\n')).toEqual([{ event: 'message', data: 'hello' }]);
	});

	test('event field names the event', () => {
		const p = createSseParser();
		expect(p.push('event: content_block_delta\ndata: {"a":1}\n\n')).toEqual([
			{ event: 'content_block_delta', data: '{"a":1}' }
		]);
	});

	test('comment lines are ignored', () => {
		expect(parse(': OPENROUTER PROCESSING\n\ndata: x\n\n')).toEqual([
			{ event: 'message', data: 'x' }
		]);
	});

	test('multi-line data joins with a newline', () => {
		expect(parse('data: a\ndata: b\n\n')).toEqual([{ event: 'message', data: 'a\nb' }]);
	});

	test('no space after the colon is accepted', () => {
		expect(parse('data:x\n\n')).toEqual([{ event: 'message', data: 'x' }]);
	});

	test('only one leading space is stripped', () => {
		expect(parse('data:  x\n\n')).toEqual([{ event: 'message', data: ' x' }]);
	});

	test('CRLF, CR-only and LF-only line endings produce identical events', () => {
		const lf = 'event: e\ndata: a\ndata: b\n\ndata: c\n\n';
		const crlf = lf.replace(/\n/g, '\r\n');
		const cr = lf.replace(/\n/g, '\r');
		const expected = [
			{ event: 'e', data: 'a\nb' },
			{ event: 'message', data: 'c' }
		];
		expect(parse(lf)).toEqual(expected);
		expect(parse(crlf)).toEqual(expected);
		expect(parse(cr)).toEqual(expected);
	});

	test('a CRLF split across two pushes is one line ending', () => {
		const p = createSseParser();
		const first = p.push('data: a\r');
		const second = p.push('\n\r\n');
		expect([...first, ...second, ...p.end()]).toEqual([{ event: 'message', data: 'a' }]);
	});

	test('[DONE] is returned as plain data', () => {
		expect(parse('data: [DONE]\n\n')).toEqual([{ event: 'message', data: '[DONE]' }]);
	});

	test('a field line with no colon yields empty data that still dispatches', () => {
		expect(parse('data\n\n')).toEqual([{ event: 'message', data: '' }]);
	});

	test('id and retry are ignored', () => {
		expect(parse('id: 7\nretry: 100\ndata: z\n\n')).toEqual([{ event: 'message', data: 'z' }]);
	});

	test('a block with only an event line dispatches nothing', () => {
		expect(parse('event: ping\n\n')).toEqual([]);
	});

	test('end() flushes a final unterminated event', () => {
		const p = createSseParser();
		expect(p.push('data: tail')).toEqual([]);
		expect(p.end()).toEqual([{ event: 'message', data: 'tail' }]);
	});

	test('the event name resets after each dispatch', () => {
		expect(parse('event: a\ndata: x\n\ndata: y\n\n')).toEqual([
			{ event: 'a', data: 'x' },
			{ event: 'message', data: 'y' }
		]);
	});
});

describe('chunk-boundary fuzz', () => {
	const frames = [
		': OPENROUTER PROCESSING',
		'',
		'event: message_start',
		'data: {"type":"message_start"}',
		'',
		'event: content_block_delta',
		'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"It’s a 🏠 near transit"}}',
		'',
		'data: line one ’',
		'data: line two 🏠',
		'',
		'data: [DONE]',
		'',
		''
	];
	const stream = frames.join('\r\n');
	const expected: SseEvent[] = [
		{ event: 'message_start', data: '{"type":"message_start"}' },
		{
			event: 'content_block_delta',
			data: '{"type":"content_block_delta","delta":{"type":"text_delta","text":"It’s a 🏠 near transit"}}'
		},
		{ event: 'message', data: 'line one ’\nline two 🏠' },
		{ event: 'message', data: '[DONE]' }
	];

	test('the fixture contains CRLF, a curly quote, an emoji and [DONE]', () => {
		expect(stream).toContain('\r\n');
		expect(stream).toContain('’');
		expect(stream).toContain('🏠');
		expect(stream).toContain('[DONE]');
	});

	test('whole stream parses to the expected events', () => {
		expect(runAll([stream])).toEqual(expected);
	});

	test('split at every character offset yields identical events', () => {
		for (let i = 0; i <= stream.length; i++) {
			expect(runAll([stream.slice(0, i), stream.slice(i)]), `offset ${i}`).toEqual(expected);
		}
	});

	test('1-character chunks yield identical events', () => {
		expect(runAll(stream.split(''))).toEqual(expected);
	});
});
