<script lang="ts" module>
	/** Polite announcement after the toggle changes (05-UI-SPEC). */
	export function sampleAnnouncement(on: boolean, providerLabel?: string | null): string {
		if (on) return 'Sample output turned on.';
		return providerLabel
			? `Sample output turned off. Drafts use your ${providerLabel} key.`
			: 'Sample output turned off.';
	}
</script>

<script lang="ts">
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { aiPrefs } from '$lib/ai/prefs.svelte';

	// "Use sample output instead of my AI key" (05-UI-SPEC SampleOutputToggle). When checked every
	// panel uses the keyless sample provider even with a key saved. Persists per device in aiPrefs.

	interface Props {
		checked: boolean;
		/** The provider drafts fall back to when turned off (for the announcement), or null. */
		providerLabel: string | null;
	}

	let { checked = $bindable(false), providerLabel }: Props = $props();

	const uid = $props.id();

	function onCheckedChange(next: boolean): void {
		aiPrefs.sample = next;
		announce(sampleAnnouncement(next, providerLabel));
	}
</script>

<label class="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 py-2">
	<Checkbox
		bind:checked
		{onCheckedChange}
		aria-labelledby="{uid}-title"
		aria-describedby="{uid}-description"
		class="mt-0.5"
	/>
	<span class="grid gap-1">
		<span id="{uid}-title" class="text-base leading-[1.6] font-semibold text-foreground"
			>Use sample output instead of my AI key</span
		>
		<span id="{uid}-description" class="text-base leading-[1.6] text-muted-foreground"
			>Drafts are pre-written samples, so no key is used and nothing is sent. Handy for trying
			things out.</span
		>
	</span>
</label>
