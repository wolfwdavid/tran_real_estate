<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';
	import { meterTransition, type MeterState } from '@tran/core/budget';
	import {
		checkSavedSearchesOnOpen,
		createDataRuntime,
		setDataRuntime,
		type AlertsDeps,
		type CapPrompt,
		type ConfirmInput,
		type DataRuntime,
		type SchedulerResult
	} from '$lib/data';
	import CapConfirmDialog from './CapConfirmDialog.svelte';
	import DataStatusBar, { type DataStatus } from './DataStatusBar.svelte';
	import DueSearchesDialog from './DueSearchesDialog.svelte';
	import { thresholdAnnouncement } from './copy/meter';
	import { CAP_CHANGED_ELSEWHERE, dueDone, sourceAnnouncement } from './copy/source';
	import { announce } from './platform-ui';

	// The (app) layout's data shell (04-UI-SPEC Layout & Placement Contract; DATA-01..03):
	// - one data runtime per app session, provided through context and started in onMount;
	// - the DataStatusBar as the first child of <main> (no wrapper element, so AppNotice and the page
	//   stay direct children of <main> after it);
	// - the over-cap prompt host: any user spend that hits the cap opens CapConfirmDialog, per call;
	// - the check-on-open saved-search run, once per mount, after start() resolves. It asks through
	//   DueSearchesDialog when more than 3 are due and never goes past the cap;
	// - polite announcements: meter threshold crossings (never on load) and other-tab changes.
	// Announcing from $effect is fine; spending from $effect is not (the run starts in onMount).

	interface Props {
		showStatusBar: boolean;
		/** Injected in tests; the app creates its own. */
		runtime?: DataRuntime;
		/** Test seam for the alerts run (database, clock, lock). */
		alerts?: Partial<AlertsDeps>;
		children: Snippet;
	}

	let { showStatusBar, runtime: injected, alerts, children }: Props = $props();

	// One runtime for this mount; a later prop change does not swap it.
	const runtime = untrack(() => injected) ?? createDataRuntime();
	setDataRuntime(runtime);

	// ---------------------------------------------------------------------------------------------
	// Status bar
	// ---------------------------------------------------------------------------------------------

	let alertResult = $state<SchedulerResult | null>(null);

	// Declined or busy passes are not "waiting for cap room"; only cap waits show in the bar.
	const waiting = $derived(
		alertResult && (alertResult.skipped === null || alertResult.skipped === 'cap')
			? alertResult.waiting.length
			: 0
	);

	const status: DataStatus = $derived.by(() => {
		const mode = runtime.mode;
		if (!mode) return 'hydrating';
		if (mode.reason !== 'live') return { kind: 'sample', reason: mode.reason };
		const usage = runtime.usage;
		if (!usage) return 'hydrating';
		return {
			kind: 'live',
			used: usage.countedTowardCap,
			unbilled: usage.noResults,
			cap: usage.cap,
			resetsAt: usage.resetsAt,
			waiting,
			skippedForCap: alertResult?.skipped === 'cap'
		};
	});

	// ---------------------------------------------------------------------------------------------
	// Over-cap prompt (one at a time; the runtime parks the spend until confirm or cancel)
	// ---------------------------------------------------------------------------------------------

	let capOpen = $state(false);
	// Kept after the runtime clears its prompt, so the dialog's text holds while it closes.
	let capShown = $state<CapPrompt | null>(null);

	$effect(() => {
		const prompt = runtime.capPrompt;
		if (prompt) {
			capShown = prompt;
			capOpen = true;
		}
	});

	// ---------------------------------------------------------------------------------------------
	// Check-on-open saved searches
	// ---------------------------------------------------------------------------------------------

	let dueOpen = $state(false);
	let dueInput = $state<ConfirmInput | null>(null);
	let progress = $state<{ i: number; k: number } | null>(null);
	let answer: ((ok: boolean) => void) | null = null;
	let run: Promise<unknown> | null = null;

	function askDue(input: ConfirmInput): Promise<boolean> {
		dueInput = input;
		dueOpen = true;
		return new Promise<boolean>((resolve) => (answer = resolve));
	}

	function settleDue(ok: boolean): void {
		const reply = answer;
		answer = null;
		reply?.(ok);
	}

	async function confirmDue(): Promise<void> {
		settleDue(true);
		// The dialog stays open (label "Checking {i} of {k}…") until the run settles.
		await run;
	}

	onMount(() => {
		let destroyed = false;
		let stop: (() => void) | null = null;

		const boot = async () => {
			const cleanup = await runtime.start();
			if (destroyed) {
				cleanup();
				return;
			}
			stop = cleanup;
			const pass = checkSavedSearchesOnOpen(runtime, askDue, {
				...alerts,
				onProgress: (i, k) => {
					if (!destroyed) progress = { i, k };
				}
			});
			run = pass;
			const result = await pass.finally(() => {
				progress = null;
			});
			if (destroyed || !result) return;
			alertResult = result;
			// Live: one announcement after any run. Sample: only when something is new.
			const sample = runtime.mode?.source === 'sample';
			if (result.ran.length > 0 && (!sample || result.newListings > 0)) {
				announce(dueDone(result.ran.length, result.newListings));
			}
		};
		// Storage failures leave the bar on "Checking data source…"; spends surface their own errors.
		boot().catch(() => undefined);

		return () => {
			destroyed = true;
			settleDue(false);
			stop?.();
		};
	});

	// ---------------------------------------------------------------------------------------------
	// Announcements
	// ---------------------------------------------------------------------------------------------

	// The first usage snapshot only sets the baseline: the meter is never announced on load.
	let previousState: MeterState | null = null;
	$effect(() => {
		const usage = runtime.usage;
		if (!usage) return;
		const crossed = meterTransition(previousState, usage.state);
		previousState = usage.state;
		if (crossed) {
			announce(
				thresholdAnnouncement(crossed, {
					left: Math.max(usage.cap - usage.countedTowardCap, 0),
					used: usage.countedTowardCap,
					cap: usage.cap
				})
			);
		}
	});

	let lastRemoteSeq = 0;
	$effect(() => {
		const change = runtime.lastRemoteChange;
		if (!change || change.seq === lastRemoteSeq) return;
		lastRemoteSeq = change.seq;
		if (change.type === 'cap-changed') {
			announce(CAP_CHANGED_ELSEWHERE);
			return;
		}
		const mode = untrack(() => runtime.mode);
		if (mode) announce(sourceAnnouncement(mode.source));
	});
</script>

{#if showStatusBar}
	<DataStatusBar {status} />
{/if}
{@render children()}

{#if capShown}
	<CapConfirmDialog
		bind:open={capOpen}
		used={capShown.used}
		cap={capShown.cap}
		onConfirm={() => runtime.confirmCapPrompt()}
		onCancel={() => runtime.cancelCapPrompt()}
	/>
{/if}

{#if dueInput}
	<DueSearchesDialog
		bind:open={dueOpen}
		names={dueInput.due.map((s) => s.name)}
		dueCount={dueInput.due.length}
		runCount={dueInput.run.length}
		calls={dueInput.calls}
		used={dueInput.used}
		cap={dueInput.cap}
		{progress}
		onConfirm={confirmDue}
		onDecline={() => settleDue(false)}
	/>
{/if}
