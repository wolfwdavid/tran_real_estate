import { describe, expect, test } from 'vitest';
import { DRAG_MEDIA, DRAG_MIME, readDraggedId } from './dnd';

const dt = (value: string | null) => ({
	getData: (type: string) => (type === DRAG_MIME && value !== null ? value : '')
});

const known = new Set(['c-1', 'c-2']);

describe('readDraggedId', () => {
	test('returns the id when the dragged text is a known contact id', () => {
		expect(readDraggedId(dt('c-1'), known)).toBe('c-1');
		expect(readDraggedId(dt('c-2'), known)).toBe('c-2');
	});

	test('ignores text that is not a known id (foreign drags do nothing)', () => {
		expect(readDraggedId(dt('c-3'), known)).toBeNull();
		expect(readDraggedId(dt('hello'), known)).toBeNull();
		expect(readDraggedId(dt(' c-1'), known)).toBeNull();
		expect(readDraggedId(dt(''), known)).toBeNull();
	});

	test('returns null without a dataTransfer or when getData throws', () => {
		expect(readDraggedId(null, known)).toBeNull();
		expect(
			readDraggedId(
				{
					getData: () => {
						throw new Error('no access');
					}
				},
				known
			)
		).toBeNull();
	});

	test('reads only the text/plain type', () => {
		const other = { getData: (type: string) => (type === 'text/uri-list' ? 'c-1' : '') };
		expect(readDraggedId(other, known)).toBeNull();
	});

	test('an empty known set accepts nothing', () => {
		expect(readDraggedId(dt('c-1'), new Set())).toBeNull();
	});
});

describe('constants', () => {
	test('drag is offered only on the 1280px board with a fine, hover-capable pointer', () => {
		expect(DRAG_MEDIA).toContain('1280px');
		expect(DRAG_MEDIA).toContain('(hover: hover) and (pointer: fine)');
		expect(DRAG_MIME).toBe('text/plain');
	});
});
