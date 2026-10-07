// Copied reel script (STU-03, 09-UI-SPEC "ReelScriptView anatomy", Copied text).
// reelFooter builds the fixed text that GenerationPanel receives as `emailFooter.text`: the
// caption disclosure under "ADD TO YOUR POST CAPTION", then the AI-disclosure checklist as "[ ]"
// lines under "BEFORE YOU POST THIS VIDEO". It is appended in this browser, never checked and
// never sent to the AI. formatReelForExit is the panel's `formatForExit` once `length` is bound:
// times always come from REEL_TEMPLATES via timeBeats, never from the model's text.
import { formatReelScript, parseReel, timeBeats, type ReelLength } from '@tran/core/studio';
import { REEL_CHECKLIST, REEL_CHECKLIST_FOOTNOTE } from './checklist';

export const CAPTION_HEADING = 'ADD TO YOUR POST CAPTION';
export const CHECKLIST_HEADING = 'BEFORE YOU POST THIS VIDEO';

/** The panel's `emailFooter.text`: caption disclosure, then the checklist and its footnote. */
export function reelFooter(disclosure: string): string {
	const boxes = REEL_CHECKLIST.map((item) => `[ ] ${item}\n`).join('');
	return `${CAPTION_HEADING}\n${disclosure.trim()}\n\n${CHECKLIST_HEADING}\n${boxes}\n${REEL_CHECKLIST_FOOTNOTE}`;
}

/**
 * The timecoded plain-text script followed by `footerText`. A draft Tran can't split into the
 * six beats is still copyable: the raw draft, a blank line, then the footer.
 */
export function formatReelForExit(draft: string, footerText: string, length: ReelLength): string {
	const parsed = parseReel(draft);
	if (parsed.ok) return formatReelScript(timeBeats(parsed.beats, length), length, footerText);
	const raw = draft.trimEnd();
	return footerText.trim() === '' ? raw : `${raw}\n\n${footerText}`;
}
