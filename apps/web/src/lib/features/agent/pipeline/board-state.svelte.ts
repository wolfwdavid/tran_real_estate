// The pipeline board's one move path (AGT-04). The Move menu, a pointer drop and Undo all go
// through move() / undoLast(), which call the 08-12 repo (moveStage writes the stage plus the
// "Moved from {Old} to {New}" activity in one transaction; undoMove reverses both), set the
// UndoStatus line, announce through the Phase 3 live region, and move focus per UI-SPEC "Focus
// management". Focus waits for the live contacts view to reflect the write (the card re-renders
// in its new column), then lands on the card's Move button; if the active smart-list filter hides
// the card there, it lands on the status line instead.
import { tick } from 'svelte';
import { STAGE_LABELS, type Contact, type Stage } from '@tran/core/agent/types';
import { announce } from '$lib/components/a11y/announcer.svelte';
import { moveStage, undoMove, type MoveUndo } from '$lib/storage/agent/contacts-repo';

/** The last reversible move: the status copy plus what Undo needs. */
export interface BoardUndo {
	message: string;
	token: MoveUndo;
	name: string;
	from: Stage;
}

/** A focus request that settles once the live contacts list satisfies `ready`. */
export interface FocusRequest {
	ready: (contacts: readonly Contact[]) => boolean;
	target: () => HTMLElement | null;
	fallback: () => HTMLElement | null;
}

/** The UndoStatus line's id (focus fallback when the moved card is filtered out). */
export const BOARD_UNDO_ID = 'board-undo';

const moveButton = (id: string, stage: Stage): HTMLElement | null =>
	document.querySelector<HTMLElement>(`#stage-${stage} [data-move-for="${CSS.escape(id)}"]`);

const statusLine = (): HTMLElement | null => document.getElementById(BOARD_UNDO_ID);

/** Scrolls `el` into view (instant under reduced motion) and focuses it without a second scroll. */
export function focusInView(el: HTMLElement): void {
	const reduce =
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	el.scrollIntoView({ behavior: reduce ? 'instant' : 'smooth', block: 'nearest' });
	el.focus({ preventScroll: true });
}

export function createBoardState() {
	let undo = $state<BoardUndo | null>(null);
	let status = $state<string | null>(null);
	let pending = $state<FocusRequest | null>(null);
	let busy = false;

	/**
	 * Moves `contact` to `to`. opts.focus is true for the Move menu (focus follows the card) and
	 * false for a pointer drop (no focus change; the announcement is the feedback).
	 */
	async function move(contact: Contact, to: Stage, opts: { focus: boolean }): Promise<void> {
		if (busy || contact.stage === to) return;
		busy = true;
		try {
			const token = await moveStage(contact.id, to);
			if (!token) return;
			const message = `Moved ${contact.name} to ${STAGE_LABELS[to]}.`;
			undo = { message, token, name: contact.name, from: token.fromStage };
			status = message;
			announce(message);
			if (opts.focus) {
				pending = {
					ready: (list) => list.some((c) => c.id === contact.id && c.stage === to),
					target: () => moveButton(contact.id, to),
					fallback: statusLine
				};
			}
		} finally {
			busy = false;
		}
	}

	/** Reverses the last move: restores the stage, removes the activity, focuses the card. */
	async function undoLast(): Promise<void> {
		const u = undo;
		if (!u || busy) return;
		busy = true;
		try {
			await undoMove(u.token);
			undo = null;
			const message = `Moved ${u.name} back to ${STAGE_LABELS[u.from]}.`;
			status = message;
			announce(message);
			pending = {
				ready: (list) => list.some((c) => c.id === u.token.contactId && c.stage === u.from),
				target: () => moveButton(u.token.contactId, u.from),
				fallback: statusLine
			};
		} finally {
			busy = false;
		}
	}

	/** Queues a focus move for the board to settle once the live list reflects a change. */
	function requestFocus(req: FocusRequest): void {
		pending = req;
	}

	/**
	 * Called by the board from an effect over the live contacts list. Once the pending request's
	 * condition holds, waits for the DOM and focuses the target (or the fallback).
	 */
	async function settle(contacts: readonly Contact[]): Promise<void> {
		const p = pending;
		if (!p || !p.ready(contacts)) return;
		pending = null;
		await tick();
		const el = p.target() ?? p.fallback();
		if (el) focusInView(el);
	}

	/** Clears the status line and any Undo (an Undo never outlives its page). */
	function clear(): void {
		undo = null;
		status = null;
		pending = null;
	}

	return {
		get undo() {
			return undo;
		},
		get status() {
			return status;
		},
		get pending() {
			return pending;
		},
		move,
		undoLast,
		requestFocus,
		settle,
		clear
	};
}

export type BoardState = ReturnType<typeof createBoardState>;
