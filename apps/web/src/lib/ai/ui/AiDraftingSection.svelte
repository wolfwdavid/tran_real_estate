<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { LiveProviderId } from '@tran/core/ai';
	import { aiPrefs } from '$lib/ai/prefs.svelte';
	import { PROVIDER_LABELS } from '$lib/ai/models';
	import { DEMO_INPUTS } from '$lib/ai/prompts/shared/demo.v1';
	import { defaultPreferred, toAiKeyState, type AiKeyState } from '$lib/ai/setup';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import { getSettingsContext } from '$lib/features/shared/settings/settings-context.svelte';
	import AiProviderPicker from './AiProviderPicker.svelte';
	import DraftHistory from './DraftHistory.svelte';
	import GenerationPanel from './GenerationPanel.svelte';
	import SampleOutputToggle from './SampleOutputToggle.svelte';

	// Settings slot 3, "AI drafting" (05-UI-SPEC "Settings: new section 'AI drafting'"; AI-01,
	// AI-04): the provider picker, the sample toggle, and "Try a draft" (the shared demo prompt in
	// a GenerationPanel plus its Draft history). The prerendered shell shows the static copy and
	// "Checking this browser…" where live state goes. Key state comes from the Settings context
	// (filled by the page's onMount); the Test connection testers and the artifact repository load
	// here in onMount through dynamic import(), and the panel loads its runner and adapters itself.

	const ctx = getSettingsContext();

	/** Reactive key state for the picker, read from the vault status mirror (no key material). */
	const keyState = $derived.by((): ((id: LiveProviderId) => AiKeyState) => {
		const providers = ctx.vaultStatus?.providers;
		return (id) => toAiKeyState(providers?.[id]?.state ?? 'none');
	});
	const fallbackLabel = $derived.by(() => {
		const id = aiPrefs.provider ?? defaultPreferred(keyState);
		return id ? PROVIDER_LABELS[id] : null;
	});

	let repo = $state<ArtifactRepo | null>(null);
	let testersReady = $state(false);
	let refreshKey = $state(0);
	let savedId = $state<string | null>(null);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);

	// Draft history reloads after the panel saves or opens a draft, and after every exit (Reviewed).
	$effect(() => {
		void savedId;
		untrack(() => refreshKey++);
	});

	// The panel's chip and "What will be sent" follow provider, sample and key changes.
	$effect(() => {
		void aiPrefs.provider;
		void aiPrefs.sample;
		void ctx.vaultStatus;
		untrack(() => panel?.refreshProvider());
	});

	function onExit(): void {
		refreshKey++;
	}

	function onOpen(a: AiArtifact): void {
		void panel?.openArtifact(a);
	}

	onMount(() => {
		let disposed = false;
		const cleanups: (() => void)[] = [];

		void (async () => {
			const [setup, testers, artifacts] = await Promise.all([
				import('$lib/ai/setup'),
				import('$lib/storage/secrets/testers'),
				import('$lib/ai/storage/artifacts')
			]);
			if (disposed) return;
			// Test connection for the four AI cards, registered only while Settings is mounted.
			cleanups.push(
				...setup.registerAiTestKeys(testers.registerKeyTester, {
					model: (id) => aiPrefs.effectiveModel(id)
				})
			);
			repo = artifacts.createArtifactRepo();
			testersReady = true;
		})();

		return () => {
			disposed = true;
			for (const off of cleanups) off();
		};
	});

	const ready = $derived(ctx.ready && testersReady);
</script>

<section
	id="ai-drafting"
	aria-labelledby="ai-drafting-heading"
	data-ai-drafting
	data-ai-ready={ready ? 'true' : undefined}
	class="scroll-mt-4"
>
	<h2 id="ai-drafting-heading" tabindex="-1" class="font-display text-heading font-semibold">
		AI drafting
	</h2>
	<p class="mt-4 text-body text-muted-foreground">
		Choose which AI provider writes your drafts. Drafts are generated in your browser with your own
		key, checked for Fair Housing problem phrases, and never sent anywhere until you send them
		yourself.
	</p>

	<div class="mt-8 space-y-4">
		{#if ctx.ready}
			<AiProviderPicker {keyState} bind:selected={aiPrefs.provider} />
			<SampleOutputToggle bind:checked={aiPrefs.sample} providerLabel={fallbackLabel} />
		{:else}
			<p class="text-label text-muted-foreground">Checking this browser…</p>
		{/if}
	</div>

	<div class="mt-8 border-t border-border pt-8">
		<h3 class="text-body font-semibold">Try a draft</h3>
		<p class="mt-2 text-body text-muted-foreground">
			Generate a short sample inquiry about a fictional listing to check that your provider works.
			The details are made up, but they're treated like real client details, so you can see what
			gets replaced before sending.
		</p>

		<div class="mt-6">
			<GenerationPanel
				bind:this={panel}
				bind:savedId
				feature="demo"
				promptId="shared/demo"
				inputs={DEMO_INPUTS}
				title="Sample inquiry"
				headingLevel={3}
				{onExit}
			/>
		</div>

		<div class="mt-8">
			{#if repo}
				<DraftHistory feature="demo" {repo} headingLevel={4} {onOpen} {refreshKey} />
			{:else}
				<p class="text-label text-muted-foreground">Checking this browser…</p>
			{/if}
		</div>
	</div>
</section>
