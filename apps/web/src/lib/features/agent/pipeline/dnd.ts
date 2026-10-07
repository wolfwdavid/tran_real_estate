// Native HTML5 drag-and-drop helpers for the pipeline board (AGT-04, RESEARCH Pattern 7). Pure:
// no DOM access, so the Node project can test it. Drag is a progressive enhancement for mouse
// users on a wide screen; the per-card Move menu is the accessible path (WCAG 2.2 SC 2.5.7), so
// nothing here is required for a move to be possible.

/** The one dataTransfer type a card drag carries. Firefox needs setData() to start a drag at all. */
export const DRAG_MIME = 'text/plain';

/**
 * When pointer drag is offered: the board layout (1280px and up, UI-SPEC "Breakpoint behavior")
 * on a hover-capable device with a fine pointer. Touch and narrow screens use the Move menu only.
 */
export const DRAG_MEDIA = '(min-width: 1280px) and (hover: hover) and (pointer: fine)';

/**
 * The contact id carried by a drop, or null. Only an id the board knows is accepted, so text
 * dragged in from anywhere else (a selection, another window) never triggers a move.
 */
export function readDraggedId(
	dt: Pick<DataTransfer, 'getData'> | null,
	knownIds: ReadonlySet<string>
): string | null {
	if (!dt) return null;
	let raw: string;
	try {
		raw = dt.getData(DRAG_MIME);
	} catch {
		return null;
	}
	if (typeof raw !== 'string' || raw === '') return null;
	return knownIds.has(raw) ? raw : null;
}
