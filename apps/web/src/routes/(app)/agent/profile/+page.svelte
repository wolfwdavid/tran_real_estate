<script lang="ts">
	// /agent/profile/ (AGT-01): the profile form with the live "Your disclosure" preview. The page
	// prerenders with an empty form; the saved profile is read from IndexedDB after mount through
	// the live view, so saved details survive a reload. Plan 08-22 adds Logo and Brand colors (and
	// BrandPreview above the disclosure); plan 08-24 adds the inquiry share builder below the form.
	import { onMount } from 'svelte';
	import {
		EMPTY_PROFILE_INPUT,
		type AgentProfile,
		type ProfileInput
	} from '@tran/core/agent/types';
	import DisclosurePreview from '$lib/features/agent/profile/DisclosurePreview.svelte';
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

<div class="mx-auto max-w-page px-6 pb-12 md:px-8 md:pb-16">
	<h1 class="font-display text-display font-semibold">Your profile</h1>
	<p class="mt-4 max-w-prose text-body text-muted-foreground">
		These details come from you. Tran adds them to the follow-ups and reports you export, so your
		license and brokerage information is always there. Tran is software, not your brokerage.
	</p>

	<div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,640px)_352px] lg:items-start">
		<div class="max-w-prose min-w-0">
			<ProfileForm {initial} onchange={(d) => (draft = d)} />
		</div>
		<aside class="min-w-0 lg:sticky lg:top-6" aria-label="Previews">
			<div class="rounded-lg border border-border bg-card p-6 shadow-card">
				<DisclosurePreview profile={draft} />
			</div>
		</aside>
	</div>
</div>
