/**
 * Keyless Fixture provider: streams pre-written, pre-linted sample output word by word with
 * realistic timing. Used when no key is present or sample mode is forced; the UI badges its
 * output "Sample output". No network access of any kind, and no usage event (so no cost).
 */
import type { LlmEvent, LlmProvider, LlmRequest } from '../ports.js';
import { FIXTURE_OUTPUTS } from './fixture-outputs.js';

export type FixtureDeps = {
	sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
	random?: () => number;
	outputs?: Readonly<Record<string, string>>;
};

const abortError = () => new DOMException('Aborted', 'AbortError');

/** setTimeout-based delay that rejects with an AbortError as soon as `signal` aborts. */
function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(abortError());
		const onAbort = () => {
			clearTimeout(timer);
			reject(abortError());
		};
		const timer = setTimeout(() => {
			signal.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal.addEventListener('abort', onAbort, { once: true });
	});
}

/** Own-property lookup so ids like 'constructor' never resolve to prototype members. */
function outputFor(outputs: Readonly<Record<string, string>>, promptId: string | undefined) {
	if (promptId !== undefined && Object.hasOwn(outputs, promptId)) return outputs[promptId]!;
	return Object.hasOwn(outputs, 'default') ? outputs.default! : FIXTURE_OUTPUTS.default;
}

export function fixtureProvider(deps: FixtureDeps = {}): LlmProvider {
	const sleep = deps.sleep ?? defaultSleep;
	const random = deps.random ?? Math.random;
	const outputs = deps.outputs ?? FIXTURE_OUTPUTS;

	return {
		id: 'fixture',
		async *stream(req: LlmRequest, signal: AbortSignal): AsyncGenerator<LlmEvent> {
			if (signal.aborted) throw abortError();
			const text = outputFor(outputs, req.promptId);
			// Each part is a word plus its trailing whitespace; together with any leading
			// whitespace they concatenate back to `text` exactly.
			const leading = /^\s*/.exec(text)?.[0] ?? '';
			const parts = text.match(/\S+\s*/g) ?? [];
			if (leading) yield { type: 'text', text: leading };
			for (const part of parts) {
				await sleep(20 + Math.floor(random() * 41), signal);
				yield { type: 'text', text: part };
			}
			yield { type: 'finish', reason: 'stop' };
		}
	};
}
