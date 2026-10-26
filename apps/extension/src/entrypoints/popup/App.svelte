<script lang="ts">
	import { onMount } from 'svelte';
	import { applyPush, loadStatus, type PopupDeps, type PopupStatus } from '../../lib/popup-model';
	import CountStatus from './components/CountStatus.svelte';
	import FilterSwitch from './components/FilterSwitch.svelte';
	import PopupFooter from './components/PopupFooter.svelte';
	import PopupHeader from './components/PopupHeader.svelte';
	import PrivacyCallout from './components/PrivacyCallout.svelte';

	let { deps }: { deps: PopupDeps } = $props();

	// enabled === null means "not read yet" (loading) or "could not read" (storage-error): the
	// switch stays disabled with no state word in both, so the wrong state never flashes.
	let status: PopupStatus = $state({ enabled: null, tabId: undefined, state: { kind: 'loading' } });

	onMount(() => {
		let alive = true;
		const stop = deps.onCountPush((push, sender) => {
			status.state = applyPush(status.state, push, status.tabId, sender);
		});
		void loadStatus(deps).then((s) => {
			if (alive) status = s;
		});
		return () => {
			alive = false;
			stop();
		};
	});

	async function toggle(value: boolean) {
		// Optimistic: the switch moves at once. The reload reports the persisted value, so a failed
		// write reverts it and any count push that raced the write is corrected.
		status.enabled = value;
		try {
			await deps.writeEnabled(value);
		} catch {
			// Fall through to the reload.
		}
		status = await loadStatus(deps);
	}
</script>

<main>
	<PopupHeader />
	<FilterSwitch enabled={status.enabled} disabled={status.enabled === null} onchange={toggle} />
	<CountStatus state={status.state} />
	<PrivacyCallout />
	<PopupFooter />
</main>

<style>
	main {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px;
	}
</style>
