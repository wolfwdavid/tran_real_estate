<script lang="ts">
	// 06-UI-SPEC "OutreachSection" (RENT-07). The renter fills a short form, the Phase 5
	// GenerationPanel drafts the message, and the Fair Housing checker gates its three exits (Copy
	// text, Open in email app, Mark as sent). Tran never sends anything: the email exit is a
	// mailto: link to the listing contact that opens the renter's own email app.
	//
	// PII minimization: buildOutreachInputs keeps only listing facts plus six form fields (the
	// household detail is a number). Drafts are saved with subjectId = listing id, so this
	// listing's Draft history shows only its own drafts.
	import { onMount, untrack } from 'svelte';
	import type { Listing } from '@tran/core/listings';
	import { mailtoHref } from '@tran/core/renter/contact-links';
	import type { Provenance } from '$lib/data';
	import {
		buildOutreachInputs,
		type RenterOutreachListing
	} from '$lib/ai/prompts/renter/outreach.v1';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import { streetLine } from '../listing/address';
	import OutreachForm from './OutreachForm.svelte';
	import { newOutreachForm } from './outreach-form';

	let { row, provenance }: { row: Listing; provenance: Provenance } = $props();

	const NO_RECIPIENT =
		"RentCast didn't list an email for this contact, so your email app will open without a recipient. Add one there, or call the listing contact instead.";

	let form = $state(newOutreachForm());
	let formRef = $state<ReturnType<typeof OutreachForm> | null>(null);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let repo = $state<ArtifactRepo | null>(null);
	let savedId = $state<string | null>(null);
	let refreshKey = $state(0);

	const street = $derived(streetLine(row));

	/** The agent's email when it validates, else the office's; never an unchecked listing string. */
	const recipient = $derived.by((): string | null => {
		for (const c of [row.agent, row.office]) {
			const href = c ? mailtoHref(c.email) : null;
			if (href) return href.slice('mailto:'.length);
		}
		return null;
	});

	const listingFacts = $derived<RenterOutreachListing>({
		streetLine: street,
		city: row.city ?? '',
		state: row.state ?? '',
		zipCode: row.zipCode,
		rent: row.price,
		bedrooms: row.bedrooms,
		bathrooms: row.bathrooms,
		propertyType: row.propertyType,
		daysOnMarket: row.daysOnMarket,
		contactName: row.agent?.name?.trim() || row.office?.name?.trim() || null
	});

	const inputs = $derived(buildOutreachInputs(listingFacts, $state.snapshot(form)));
	const mailto = $derived({ to: recipient ?? undefined, subject: `Question about ${street}` });

	// Draft history reloads after the panel saves or opens a draft, and after every exit.
	$effect(() => {
		void savedId;
		untrack(() => refreshKey++);
	});

	onMount(() => {
		let disposed = false;
		void import('$lib/ai/storage/artifacts').then((m) => {
			if (!disposed) repo = m.createArtifactRepo();
		});
		return () => {
			disposed = true;
		};
	});

	function beforeGenerate(): boolean {
		return formRef?.validate() ?? false;
	}

	function onOpen(a: AiArtifact): void {
		void panel?.openArtifact(a);
	}
</script>

<section
	class="grid gap-6 rounded-lg border border-border bg-card p-4 sm:p-6"
	aria-labelledby="outreach-heading"
	data-outreach={row.id}
	data-outreach-source={provenance.source}
>
	<div class="grid gap-2">
		<h2
			id="outreach-heading"
			class="font-display text-heading font-semibold text-balance text-foreground"
		>
			Message the listing contact
		</h2>
		<p class="max-w-reading text-base leading-[1.6] text-muted-foreground">
			Fill in what matters to you, and Tran drafts a message that asks the right questions. You
			review it and send it yourself.
		</p>
	</div>

	<OutreachForm bind:this={formRef} bind:form idPrefix="outreach-{row.id}" />

	<div class="grid gap-4 border-t border-border pt-6">
		{#if recipient === null}
			<p class="text-label text-muted-foreground" data-outreach-no-recipient>{NO_RECIPIENT}</p>
		{/if}
		{#key row.id}
			<GenerationPanel
				bind:this={panel}
				bind:savedId
				feature="renter-outreach"
				promptId="renter/outreach.v1"
				title="Your message"
				headingLevel={3}
				generateLabel="Draft message"
				{inputs}
				subjectId={row.id}
				{mailto}
				containsClientData={true}
				{beforeGenerate}
				onExit={() => refreshKey++}
			/>
		{/key}

		{#if repo}
			<DraftHistory
				feature="renter-outreach"
				{repo}
				headingLevel={4}
				subjectId={row.id}
				{onOpen}
				{refreshKey}
			/>
		{:else}
			<p class="text-label text-muted-foreground">Checking this browser…</p>
		{/if}
	</div>
</section>
