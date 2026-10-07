// Studio form autosave (09-UI-SPEC "StudioWorkingDraft"): each tool's form is written to its
// studioDraft row 500 ms after the last change, the same debounce as the Phase 7 analyzer draft.
// There is deliberately no leave-page prompt: the form is already saved.
//
// schedule() takes the live form (a Svelte $state proxy is fine): it is snapshotted with
// $state.snapshot() at once, so IndexedDB only ever receives plain data and later edits to the
// proxy cannot change a pending write. Timers are injectable so tests drive the clock by hand
// (Vitest fake timers do not mix with fake-indexeddb).
import { getStudioDraft, putStudioDraft } from './studio-draft-repo';
import type { StudioTool } from './types';

export interface StudioAutosaveOptions {
	setTimer?: (fn: () => void, ms: number) => unknown;
	clearTimer?: (handle: unknown) => void;
	/** Defaults to putStudioDraft (tests may pass a spy). */
	write?: (tool: StudioTool, data: unknown) => Promise<unknown>;
	/** Defaults to getStudioDraft. */
	read?: (tool: StudioTool) => Promise<{ data: unknown } | null>;
	/** A failed write is reported here (the next change retries); never thrown into an effect. */
	onError?: (error: unknown) => void;
}

export interface StudioAutosave {
	/** The tool's stored form data, or null when none is saved. */
	load(): Promise<unknown>;
	/** Write `data` once no further schedule() arrives for delayMs: only the last one lands. */
	schedule(data: unknown): void;
	/** Write the pending form now (page hide, before navigation). No-op when nothing is pending. */
	flush(): Promise<void>;
	/** Cancel a pending write and stop accepting new ones (component destroy). */
	destroy(): void;
}

export function createStudioAutosave(
	tool: StudioTool,
	delayMs = 500,
	o: StudioAutosaveOptions = {}
): StudioAutosave {
	const setTimer = o.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
	const clearTimer =
		o.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
	const write = o.write ?? ((t: StudioTool, d: unknown) => putStudioDraft(t, d));
	const read = o.read ?? getStudioDraft;

	let timer: unknown = null;
	let pending: { data: unknown } | null = null;
	let destroyed = false;

	const stop = () => {
		if (timer !== null) clearTimer(timer);
		timer = null;
	};

	const run = async () => {
		stop();
		const p = pending;
		pending = null;
		if (!p) return;
		try {
			await write(tool, p.data);
		} catch (error) {
			o.onError?.(error);
		}
	};

	return {
		async load() {
			const rec = await read(tool);
			return rec ? rec.data : null;
		},
		schedule(data) {
			if (destroyed) return;
			pending = { data: $state.snapshot(data) };
			stop();
			timer = setTimer(() => void run(), delayMs);
		},
		flush: run,
		destroy() {
			destroyed = true;
			stop();
			pending = null;
		}
	};
}
