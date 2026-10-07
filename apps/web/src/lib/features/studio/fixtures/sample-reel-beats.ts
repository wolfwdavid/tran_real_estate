// Sample beats for "Fill with sample beats" (09-UI-SPEC "Reel script"). Synthetic only: a
// fictional agent's story with no places, people or client names. The keyless Fixture script built
// from these beats (studio/reel.v1 sample()) passes every reel check with zero findings, with and
// without results (reel.v1.test.ts and reel-view.test.ts assert it). The results line has no
// digits, so the E2E can plant "I helped 47 families." as a Must fix.
import type { ReelInputs } from '$lib/ai/prompts/studio/reel.v1';

/** The reel form's value: every beat as a string (empty when not filled) plus the length. */
export type ReelBeats = Required<ReelInputs>;

export const SAMPLE_REEL_BEATS: Readonly<ReelBeats> = Object.freeze({
	length: 30,
	hook: 'I used to lose messages in my inbox.',
	pain: 'I tracked every showing request on sticky notes, and callbacks slipped through.',
	beforeAfter: 'Before, follow-ups took my whole evening. Now I reply from one list each morning.',
	results: 'Answered every inquiry within an hour last spring.',
	mission: 'I want every client to feel heard from the first message.',
	cta: 'Send me a message to talk about your move.'
} satisfies ReelBeats);

/** The same story with "Your results" left empty (the placeholder path). */
export const SAMPLE_REEL_BEATS_NO_RESULTS: Readonly<ReelBeats> = Object.freeze({
	...SAMPLE_REEL_BEATS,
	results: ''
});
