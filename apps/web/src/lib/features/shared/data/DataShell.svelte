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
	// - the check-on-open saved-search run, once per mount, after start() resolves, and only while
	//   runAlerts is true (off on agent CRM routes, 08-27, SC5); a session opened on an agent page
	//   runs it on the first non-agent route. It asks through DueSearchesDialog when more than 3 are
	//   due and never goes past the cap. Leaving for an agent page while the dialog still asks
	//   withdraws it, settled as declined (nothing spent, asked again next open);
	// - polite announcements: meter threshold crossings (never on load) and other-tab changes.
	// Announcing from $effect is fine. Reactive re-runs must never spend (04-07): the deferred-start
	// effect below only calls the latched startAlerts() through untrack. The latch (alertsClaimed),
	// not the effect, is the spend guard, so any number of effect re-runs start at most one pass,
	// and the spend itself happens inside the scheduler after awaits, outside any tracking context.

	interface Props {
		showStatusBar: boolean;
		/** Injected in tests; the app creates its own. */
		runtime?: DataRuntime;
		/** Test seam for the alerts run (database, clock, lock). */
		alerts?: Partial<AlertsDeps>;
		/**
		 * Run the check-on-open saved-search pass on this route. The (app) layout passes false on
		 * agent CRM routes (08-27, SC5). Default true.
		 */
		runAlerts?: boolean;
		children: Snippet;
	}

	let { showStatusBar, runtime: injected, alerts, runAlerts = true, children }: Props = $props();

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
	let destroyed = false;
	// start() has resolved for this mount.
	let started = $state(false);
	// Once-per-mount latch for the pass (never rendered, so not $state).
	let alertsClaimed = false;

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

	/** Starts this mount's one check-on-open pass; later calls are no-ops. */
	function startAlerts(): void {
		if (alertsClaimed || destroyed) return;
		alertsClaimed = true;
		const go = async () => {
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
		go().catch(() => undefined);
	}

	// Deferred start: a mount that began on an agent CRM route runs the pass on the first route
	// where runAlerts turns true. The latch keeps it to one pass per mount.
	$effect(() => {
		if (started && runAlerts) untrack(startAlerts);
	});

	// Withdraw on leave: only while the dialog is still asking. A confirmed pass (answer === null)
	// was authorized on a non-agent page and runs to the end.
	$effect(() => {
		if (runAlerts) return;
		untrack(() => {
			if (answer) {
				dueOpen = false;
				settleDue(false);
			}
		});
	});

	onMount(() => {
		let stop: (() => void) | null = null;

		const boot = async () => {
			const cleanup = await runtime.start();
			if (destroyed) {
				cleanup();
				return;
			}
			stop = cleanup;
			started = true;
			if (untrack(() => runAlerts)) startAlerts();
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
