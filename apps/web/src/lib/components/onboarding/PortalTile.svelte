<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { OnboardingPortal } from './onboarding-state';

	let {
		portal,
		title,
		description,
		action,
		onchoose
	}: {
		portal: OnboardingPortal;
		title: string;
		description: string;
		action: string;
		onchoose: () => void;
	} = $props();
</script>

<button
	type="button"
	class="flex min-h-[88px] w-full cursor-pointer flex-col items-start gap-1 rounded-md border border-border-strong bg-card p-4 text-left transition-colors duration-150 ease-out focus-within:bg-accent-surface hover:bg-accent-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
	aria-labelledby="tile-{portal}-title tile-{portal}-action"
	aria-describedby="tile-{portal}-desc"
	onclick={onchoose}
>
	<span id="tile-{portal}-title" class="text-body font-semibold">{title}</span>
	<span id="tile-{portal}-desc" class="text-body text-muted-foreground">{description}</span>
	<span
		id="tile-{portal}-action"
		class="mt-1 inline-flex items-center gap-1 text-body font-semibold"
	>
		{action}<ArrowRight size={16} aria-hidden="true" />
	</span>
</button>
