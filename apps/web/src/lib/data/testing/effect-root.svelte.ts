// Test-only rune helpers for plain `.ts` test files (runes compile only in `.svelte.ts` modules).
// Not imported by app code.

/** Runs `fn` inside an $effect.root so effects it creates are live; dispose() tears them down. */
export function withEffectRoot<T>(fn: () => T): { value: T; dispose: () => void } {
	let value!: T;
	const dispose = $effect.root(() => {
		value = fn();
	});
	return { value, dispose };
}

/** A reactive box: reading `.current` inside an effect tracks it. */
export function reactiveBox<T>(initial: T): { current: T } {
	let current = $state(initial);
	return {
		get current() {
			return current;
		},
		set current(v: T) {
			current = v;
		}
	};
}
