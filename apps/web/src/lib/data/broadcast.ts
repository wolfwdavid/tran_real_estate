// Cross-tab notifications for the data runtime (UI-SPEC CapEditor: a cap saved in one tab updates
// every open tab). Messages carry only an event type, never a key, a value or a request.
// Same convention as the Phase 3 vault channel ('tran-vault'): one named BroadcastChannel per concern.

export type DataMessage = { type: 'cap-changed' } | { type: 'source-changed' };

/** The slice of BroadcastChannel the runtime uses (tests pass an in-memory fake). */
export interface ChannelLike {
	postMessage(m: DataMessage): void;
	addEventListener(t: 'message', cb: (e: { data: DataMessage }) => void): void;
	close(): void;
}

export const DATA_CHANNEL = 'tran-data';

/** A BroadcastChannel('tran-data') wrapper, or null where BroadcastChannel is unavailable. */
export function createDataChannel(): ChannelLike | null {
	if (typeof BroadcastChannel === 'undefined') return null;
	const channel = new BroadcastChannel(DATA_CHANNEL);
	return {
		postMessage: (m) => channel.postMessage(m),
		addEventListener: (t, cb) =>
			channel.addEventListener(t, (e) => cb({ data: (e as MessageEvent<DataMessage>).data })),
		close: () => channel.close()
	};
}
