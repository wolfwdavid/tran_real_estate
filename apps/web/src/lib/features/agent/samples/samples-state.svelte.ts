// Shared state for the sample-contacts notice and its Undo line in the agent layout. The layout
// clears it on navigation (afterNavigate), so an Undo never outlives the page it was offered on.
import type { SampleSnapshot } from './samples';

export const samplesState = $state<{ undo: SampleSnapshot | null; status: string | null }>({
	undo: null,
	status: null
});

export function clearSamplesState(): void {
	samplesState.undo = null;
	samplesState.status = null;
}
