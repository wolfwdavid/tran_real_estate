// Pure helpers for the feedback form (GTM-02, UI-SPEC FeedbackForm): the character counter, the
// one-time "100 characters left" crossing, and the default topic from ?portal=.
import { FORMS_COPY } from '$lib/content/forms';
import { TOPICS, type Topic } from './form-gate';

export const MAX_FEEDBACK = 2000;
/** At or below this many remaining characters the counter switches to "{r} characters left". */
const LEFT_THRESHOLD = 100;

const remaining = (len: number) => Math.max(0, MAX_FEEDBACK - len);

export function counterText(len: number): string {
	const r = remaining(len);
	const copy = FORMS_COPY.feedback;
	return r <= LEFT_THRESHOLD ? copy.counterLeft(r) : copy.counter(len);
}

/** True only when an edit moves the message from more than 100 left to 100 or fewer left. */
export function crossedThreshold(prevLen: number, nextLen: number): boolean {
	return remaining(prevLen) > LEFT_THRESHOLD && remaining(nextLen) <= LEFT_THRESHOLD;
}

const TOPIC_IDS: readonly string[] = TOPICS.map(([t]) => t);

/** `?portal=renter|investor|agent|tools` pre-selects that topic; anything else is "other". */
export function topicFromSearch(search: string): Topic {
	const v = new URLSearchParams(search).get('portal') ?? '';
	return TOPIC_IDS.includes(v) ? (v as Topic) : 'other';
}
