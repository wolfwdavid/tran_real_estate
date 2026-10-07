<script lang="ts">
	// /agent/profile/ (AGT-01): the profile form with the live "Preview" (brand kit) and "Your
	// disclosure" previews. The page prerenders with an empty form; the saved profile is read from
	// IndexedDB after mount through the live view, so saved details survive a reload. The Logo and
	// Brand colors fieldsets are rendered inside the form through its `extraFieldsets` snippet and
	// write straight into the form draft (stored on Save profile). Plan 08-24 adds the inquiry share
	// builder below the form.
	import { onMount } from 'svelte';
	import {
		EMPTY_PROFILE_INPUT,
		type AgentProfile,
		type ProfileInput
	} from '@tran/core/agent/types';
	import BrandColorField from '$lib/features/agent/profile/BrandColorField.svelte';
	import BrandPreview from '$lib/features/agent/profile/BrandPreview.svelte';
	import DisclosurePreview from '$lib/features/agent/profile/DisclosurePreview.svelte';
	import LogoUpload from '$lib/features/agent/profile/LogoUpload.svelte';
	import ProfileForm from '$lib/features/agent/profile/ProfileForm.svelte';
	import { toProfileInput } from '$lib/features/agent/profile/profile-form';
	import { useProfile, type LiveView } from '$lib/storage/agent/live.svelte';

	let view = $state.raw<LiveView<AgentProfile | null> | null>(null);
	onMount(() => {
		view = useProfile();
	});

	const initial = $derived.by<ProfileInput>(() => {
		const stored = view?.current ?? null;
		return stored ? toProfileInput(stored) : EMPTY_PROFILE_INPUT;
	});

	let draft = $state.raw<ProfileInput>(EMPTY_PROFILE_INPUT);
</script>

<svelte:head>
	<title>Your profile: Agent portal &middot; Tran Real Estate Tools</title>
	<meta
		name="description"
		content="Your name, license, brokerage, brand colors, disclosures, and the link to your inquiry page."
	/>
</svelte:head>

{#snippet brandFieldsets(d: ProfileInput)}
	<LogoUpload logo={d.logo} brokerage={d.brokerage} name={d.name} onchange={(l) => (d.logo = l)} />

	<fieldset class="min-w-0 rounded-lg border border-border bg-card p-6 shadow-card">
		<legend class="float-left mb-6 w-full">
			<h2 class="font-display text-heading font-semibold">Brand colors</h2>
		</legend>
		<div class="clear-both grid gap-6">
			<BrandColorField role="primary" bind:value={d.brandPrimary} />
			<BrandColorField role="accent" bind:value={d.brandAccent} />
			<p class="text-label text-muted-foreground">
				Your colors appear only on what you create for clients. Tran's own screens keep their
				colors.
			</p>
		</div>
	</fieldset>
{/snippet}

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h1 class="font-display text-display font-semibold">Your profile</h1>
	<p class="mt-4 max-w-prose text-body text-muted-foreground">
		These details come from you. Tran adds them to the follow-ups and reports you export, so your
		license and brokerage information is always there. Tran is software, not your brokerage.
	</p>

	<div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,640px)_352px] lg:items-start">
		<div class="max-w-prose min-w-0">
			<ProfileForm {initial} onchange={(d) => (draft = d)} extraFieldsets={brandFieldsets} />
		</div>
		<aside class="flex min-w-0 flex-col gap-8 lg:sticky lg:top-6" aria-label="Previews">
			<div class="rounded-lg border border-border bg-card p-6 shadow-card">
				<BrandPreview profile={draft} />
			</div>
			<div class="rounded-lg border border-border bg-card p-6 shadow-card">
				<DisclosurePreview profile={draft} />
			</div>
		</aside>
	</div>
</div>
