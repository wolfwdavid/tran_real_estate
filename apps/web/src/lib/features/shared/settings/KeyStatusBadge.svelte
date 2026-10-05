<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import HardDrive from '@lucide/svelte/icons/hard-drive';
	import Lock from '@lucide/svelte/icons/lock';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { KeyState } from '$lib/storage/secrets';

	// The text alone carries the state; color and icon are reinforcement only.
	let { state }: { state: KeyState } = $props();
</script>

{#if state === 'session'}
	<Badge variant="positive">
		<Check size={14} aria-hidden="true" />
		Saved for this session
	</Badge>
{:else if state === 'remembered'}
	<Badge variant="positive">
		<HardDrive size={14} aria-hidden="true" />
		Remembered on this device
	</Badge>
{:else if state === 'locked'}
	<Badge variant="attention">
		<Lock size={14} aria-hidden="true" />
		Locked
	</Badge>
{:else}
	<Badge variant="neutral">Not added</Badge>
{/if}
