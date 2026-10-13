<script lang="ts">
	// Public inquiry page (AGT-02), configured entirely by its query string: no profile, no logo,
	// no IndexedDB. The query is read in onMount only (prerendering forbids reading it), so the
	// prerendered HTML is a neutral shell with an h1 and a loading line. Every URL value renders
	// through text interpolation only.
	import { onMount } from 'svelte';
	import { composeDisclosure } from '@tran/core/disclosure';
	import { EMPTY_PROFILE_INPUT, type ProfileInput } from '@tran/core/agent/types';
	import { SAMPLE_AGENT_PROFILE } from '@tran/core/agent/fixtures/sample-profile';
	import type { InquiryConfig } from '@tran/core/leads/inquiry-params';
	import { formatPhoneUS } from '@tran/core/leads/normalize';
	import InquiryForm from '$lib/components/inquiry/InquiryForm.svelte';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import { readInquiryParams } from '$lib/leads/inquiry-url';

	type View =
		| { kind: 'loading' }
		| { kind: 'incomplete' }
		| { kind: 'newer-version' }
		| {
				kind: 'agent';
				demo: boolean;
				name: string;
				brokerageLine: string;
				disclosure: string[];
				accessKey: string | null;
				property: string;
		  };

	let view = $state<View>({ kind: 'loading' });

	function profileFrom(c: InquiryConfig): ProfileInput {
		return {
			...EMPTY_PROFILE_INPUT,
			name: c.name,
			brokerage: c.brokerage,
			teamName: c.team ?? '',
			licenseType: c.title ?? '',
			licenseNumber: c.license ?? '',
			licenseState: c.state ?? '',
			brokeragePhone: c.brokeragePhone ? formatPhoneUS(c.brokeragePhone) : ''
		};
	}

	function agentView(p: ProfileInput, accessKey: string | null, property: string): View {
		const team = p.teamName.trim();
		return {
			kind: 'agent',
			demo: accessKey === null,
			name: p.name,
			brokerageLine: team ? `${team} at ${p.brokerage}` : p.brokerage,
			disclosure: composeDisclosure(p, 'web').lines,
			accessKey,
			property
		};
	}

	onMount(() => {
		const parsed = readInquiryParams(location.search);
		if (parsed.status === 'valid') {
			const c = parsed.config;
			view = agentView(profileFrom(c), c.key, c.property ?? '');
		} else if (parsed.status === 'demo') {
			view = agentView(SAMPLE_AGENT_PROFILE, null, '');
		} else {
			view = { kind: parsed.status };
		}
	});

	const title = $derived(
		view.kind === 'agent'
			? `Contact ${view.name}: inquiry form`
			: view.kind === 'loading'
				? 'Inquiry form'
				: "This inquiry link isn't complete: inquiry form"
	);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="referrer" content="no-referrer" />
	<meta name="description" content="Send an inquiry to a real estate agent." />
</svelte:head>

{#if view.kind === 'loading'}
	<h1 class="font-display text-heading font-semibold">Contact an agent</h1>
	<p class="mt-4 text-label text-muted-foreground">Loading this form&hellip;</p>
{:else if view.kind === 'incomplete' || view.kind === 'newer-version'}
	<h1 class="font-display text-heading font-semibold">This inquiry link isn't complete</h1>
	<p class="mt-4">
		{#if view.kind === 'newer-version'}
			This link was made by a newer version of Tran Real Estate Tools, so this form can't read it.
			Ask the person who shared it for a new link.
		{:else}
			The link is missing some details, so this form can't send messages. Ask the person who shared
			it for a new link.
		{/if}
	</p>
{:else}
	<!-- Brokerage first, at the same size as the agent's name (state advertising rules). -->
	<p data-inquiry-brokerage class="font-display text-heading font-semibold">
		{view.brokerageLine}
	</p>
	<div class="mt-2 flex flex-wrap items-center gap-3">
		<h1 class="font-display text-heading font-semibold">Contact {view.name}</h1>
		{#if view.demo}<SampleChip />{/if}
	</div>
	{#if view.disclosure.length > 0}
		<div data-inquiry-disclosure class="mt-2 grid gap-1 text-label text-muted-foreground">
			{#each view.disclosure as line, i (i)}
				<p>{line}</p>
			{/each}
		</div>
	{/if}
	{#if view.demo}
		<p class="mt-4 rounded-md bg-accent-surface px-4 py-2 text-label">
			This is a sample page. Messages aren't sent anywhere.
		</p>
	{/if}
	<p class="mt-4 mb-8">
		Send {view.name} a question about buying, renting, or a specific property. {view.name} will reply
		to the email address you give.
	</p>
	<InquiryForm agentName={view.name} accessKey={view.accessKey} initialProperty={view.property} />
{/if}
