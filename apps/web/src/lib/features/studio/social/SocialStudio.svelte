<script lang="ts">
	// 09-UI-SPEC "Social post pack" (STU-02): lead, DisclosureStatus, action row, the brief form,
	// the Phase 5 GenerationPanel in `sections` mode (one PlatformCard per platform, each with its
	// own checks, count, disclosure block and one Copy) and Draft history.
	//
	// Every card's copied text ends with the agent's ad-inline disclosure (the Avery Sample one
	// while the form holds the unedited sample brief and the profile is incomplete). It is
	// appended in this browser by each SectionSpec's assemble and never reaches the AI. With an
	// incomplete profile and the agent's own brief, every card's Copy is gated with the profile
	// reason (exitDisabled.copy); writing posts still works.
	//
	// The run control validates first: no request while the brief is invalid, and focus moves to
	// the first invalid field. Dexie (autosave, Draft history, listing descriptions) and the
	// profile load by dynamic import in onMount, so the prerendered page shows only the loading line.
	import { onMount, tick, untrack } from 'svelte';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import type { ProfileInput } from '@tran/core/agent/types';
	import { composeDisclosure } from '@tran/core/disclosure';
	import { DISCLOSURE_FIELD_LABELS, PLATFORM_LABELS, missingFor } from '@tran/core/studio';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import type { ExitDisabled } from '$lib/ai/ui/panel-controller';
	import { copiedNote } from '$lib/ai/ui/PlatformCard.svelte';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import {
		SAMPLE_AGENT_PROFILE,
		isProfileComplete,
		loadAgentProfile,
		toDisclosureProfile
	} from '$lib/features/shared/agent-profile';
	import { announce, Button, ConfirmDialog } from '$lib/features/shared/data/platform-ui';
	import type { StudioAutosave } from '$lib/storage/studio/autosave.svelte';
	import DisclosureStatus from '../DisclosureStatus.svelte';
	import { SAMPLE_SOCIAL_BRIEF } from '../fixtures/sample-social-brief';
	import SocialBriefForm from './SocialBriefForm.svelte';
	import {
		briefToForm,
		emptySocialForm,
		listingOptionLabel,
		restoreSocialForm,
		sameBrief,
		toSocialInputs,
		validateSocialForm,
		type SocialForm
	} from './social-form';
	import { SOCIAL_CHECK_GROUPS, buildSocialSections } from './social-sections-spec';

	const LISTING_SOURCES = 20;

	let form = $state<SocialForm>(emptySocialForm());
	let profile = $state<ProfileInput | null>(null);
	let ready = $state(false);
	let formRef = $state<ReturnType<typeof SocialBriefForm> | null>(null);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let repo = $state<ArtifactRepo | null>(null);
	let listingDrafts = $state<AiArtifact[]>([]);
	let savedId = $state<string | null>(null);
	let refreshKey = $state(0);
	let clearOpen = $state(false);
	let clearedJustNow = false;
	/** The brief and link the last run was written from (checks fall back to them while invalid). */
	let generated = $state<{ brief: string; link: string } | null>(null);
	let autosave: StudioAutosave | null = null;

	const usingSample = $derived(sameBrief(form, SAMPLE_SOCIAL_BRIEF));
	const profileComplete = $derived(isProfileComplete(profile, 'ad-inline'));
	const sampleDisclosure = $derived(usingSample && !profileComplete);

	// The disclosure appended to every post: the agent's own once the profile is complete, the
	// sample agent's while the unedited sample brief is in the form. Otherwise every Copy is gated
	// with the profile reason, and the block shows what the profile composes so far (or the
	// sample agent's when there is no profile yet).
	const disclosureProfile = $derived<ProfileInput>(
		profileComplete && profile
			? profile
			: sampleDisclosure
				? SAMPLE_AGENT_PROFILE
				: (profile ?? SAMPLE_AGENT_PROFILE)
	);
	const disclosure = $derived(composeDisclosure(disclosureProfile, { variant: 'ad-inline' }).text);

	const errors = $derived(validateSocialForm(form));
	const briefValid = $derived(errors.brief === undefined);
	const linkValid = $derived(errors.link === undefined);
	const checkBrief = $derived(briefValid ? form.brief : (generated?.brief ?? form.brief));
	const checkLink = $derived(linkValid ? form.link : (generated?.link ?? ''));
	const sections = $derived(buildSocialSections(disclosure, checkBrief, checkLink));
	const inputs = $derived(toSocialInputs(form, disclosure));

	const NO_PROFILE = {
		fullName: '',
		brokerage: '',
		licenseType: '',
		licenseNumber: '',
		licenseState: ''
	};
	const LIST = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
	const missingText = $derived(
		LIST.format(
			missingFor(profile ? toDisclosureProfile(profile) : NO_PROFILE, 'ad-inline').map(
				(f) => DISCLOSURE_FIELD_LABELS[f]
			)
		)
	);
	const exitDisabled = $derived<ExitDisabled>(
		!profileComplete && !usingSample
			? { copy: `Add your ${missingText} in your profile so your disclosure can be added.` }
			: {}
	);

	const listingOptions = $derived(
		listingDrafts.map((a) => ({ value: a.id, label: listingOptionLabel(a) }))
	);

	/** Draft history row extra: "Copied: Instagram, LinkedIn". */
	const rowNote = (a: AiArtifact): string | null => copiedNote(a.meta, PLATFORM_LABELS);

	/** Run control: validate first; an invalid brief makes no request and focuses its field. */
	function beforeGenerate(): boolean {
		const r = formRef?.validate();
		if (!r) return false;
		if (!r.ok) {
			const id = r.firstInvalidId;
			void tick().then(() => {
				if (id) document.getElementById(id)?.focus();
			});
			return false;
		}
		generated = { brief: form.brief, link: form.link };
		return true;
	}

	async function fillSample(): Promise<void> {
		form = briefToForm(SAMPLE_SOCIAL_BRIEF);
		formRef?.clearErrors();
		announce('Sample brief filled in.');
		await tick();
		formRef?.focusFirst();
	}

	async function clearBrief(): Promise<void> {
		form = emptySocialForm();
		formRef?.clearErrors();
		clearedJustNow = true;
		announce('Form cleared.');
	}

	/** After a confirmed Clear, focus goes to the form's first field instead of the trigger. */
	function focusAfterClear(e: Event): void {
		if (!clearedJustNow) return;
		clearedJustNow = false;
		e.preventDefault();
		void tick().then(() => formRef?.focusFirst());
	}

	/** A listing description was chosen: its text (the stored draft, no disclosure) becomes the brief. */
	function useListing(id: string): void {
		const a = listingDrafts.find((x) => x.id === id);
		if (!a) return;
		form.brief = a.text.trim();
		formRef?.clearErrors();
		announce('Listing description copied into your brief.');
	}

	function onOpen(a: AiArtifact): void {
		void panel?.openArtifact(a);
	}

	// Draft history reloads after the panel saves or opens a pack, and after every copy.
	$effect(() => {
		void savedId;
		untrack(() => refreshKey++);
	});

	// Autosave: every change to the form (deep), 500 ms after the last one.
	$effect(() => {
		JSON.stringify(form);
		if (ready) autosave?.schedule(form);
	});

	onMount(() => {
		let disposed = false;
		void (async () => {
			const [autosaveMod, artifacts, saved] = await Promise.all([
				import('$lib/storage/studio/autosave.svelte'),
				import('$lib/ai/storage/artifacts'),
				loadAgentProfile().catch(() => null)
			]);
			if (disposed) return;
			const a = autosaveMod.createStudioAutosave('social');
			autosave = a;
			const r = artifacts.createArtifactRepo();
			const [data, listings] = await Promise.all([
				a.load().catch(() => null),
				r
					.listByFeature('studio-listing', { limit: LISTING_SOURCES })
					.catch(() => [] as AiArtifact[])
			]);
			if (disposed) return;
			if (data !== null) form = restoreSocialForm(data);
			profile = saved;
			listingDrafts = listings;
			repo = r;
			ready = true;
		})();
		const onHide = () => void autosave?.flush();
		window.addEventListener('pagehide', onHide);
		return () => {
			disposed = true;
			window.removeEventListener('pagehide', onHide);
			void autosave?.flush();
			autosave?.destroy();
		};
	});

	const LEAD =
		'Write one brief and get three posts, one each for Instagram, Facebook, and LinkedIn. Your disclosure is added to the end of each one, and each post has its own check and copy button.';
</script>

{#if !ready}
	<p class="mt-4 text-label text-muted-foreground">Loading your studio&hellip;</p>
{:else}
	<div class="mt-6 flex min-w-0 flex-col gap-8" data-social-studio>
		<div class="flex max-w-reading min-w-0 flex-col gap-8">
			<p class="text-base leading-[1.6] text-foreground">{LEAD}</p>

			<DisclosureStatus {profile} usingSample={sampleDisclosure} />

			<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
				<Button variant="outline" onclick={() => void fillSample()}>
					<FlaskConical size={16} aria-hidden="true" />
					Use a sample brief
				</Button>
				<ConfirmDialog
					bind:open={clearOpen}
					title="Clear this brief?"
					body={["This empties the form. Drafts in Draft history aren't affected."]}
					confirmLabel="Clear brief"
					confirmBusyLabel="Clearing…"
					cancelLabel="Keep them"
					onConfirm={clearBrief}
					onCloseAutoFocus={focusAfterClear}
				>
					{#snippet trigger({ props })}
						<Button {...props} variant="ghost">
							<Eraser size={16} aria-hidden="true" />
							Clear brief
						</Button>
					{/snippet}
				</ConfirmDialog>
				{#if usingSample}<SampleChip />{/if}
			</div>

			<SocialBriefForm bind:this={formRef} bind:form {listingOptions} onsource={useListing} />
		</div>

		<GenerationPanel
			bind:this={panel}
			bind:savedId
			feature="studio-social"
			promptId="studio/social.v1"
			{inputs}
			title="Post pack"
			headingLevel={2}
			generateLabel="Write post pack"
			containsClientData={false}
			{sections}
			checkGroups={SOCIAL_CHECK_GROUPS}
			{exitDisabled}
			{beforeGenerate}
			onExit={() => refreshKey++}
		/>

		{#if repo}
			<div class="max-w-reading min-w-0">
				<DraftHistory
					feature="studio-social"
					{repo}
					headingLevel={3}
					{onOpen}
					{refreshKey}
					{rowNote}
				/>
			</div>
		{/if}
	</div>
{/if}
