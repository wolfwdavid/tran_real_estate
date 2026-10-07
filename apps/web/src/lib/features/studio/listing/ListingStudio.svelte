<script lang="ts" module>
	import type { CheckGroupCopy } from '$lib/ai/ui/post-check';
	import { STUDIO_CHECKERS } from '../post-checks';

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	/**
	 * Findings groups after Fair Housing (presentational only; gating stays Phase 5's). None of the
	 * three offers an automatic fix: a replacement number or feature would itself be invented, so
	 * each row offers Show in draft and Edit it myself.
	 */
	export const LISTING_CHECK_GROUPS: CheckGroupCopy[] = [
		{
			checker: STUDIO_CHECKERS.numbers,
			label: 'Number check',
			passedTitle: 'Number check passed',
			passedNote: 'Every number matches the facts you entered.',
			findingsTitle: (b, w) => `Number check: ${b + w} to fix`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0
					? 'Every number matches your facts.'
					: `${plural(b + w, 'number', 'numbers')} to fix.`
		},
		{
			checker: STUDIO_CHECKERS.features,
			label: 'Facts check',
			passedTitle: 'Facts check passed',
			passedNote: 'Every feature in the draft is in your facts.',
			findingsTitle: (b, w) => `Facts check: ${b + w} to review`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0
					? 'Every feature is in your facts.'
					: `${plural(b + w, 'feature', 'features')} to review.`
		},
		{
			checker: STUDIO_CHECKERS.numberWords,
			label: 'Numbers as words',
			passedTitle: 'Numbers are written as digits',
			findingsTitle: (b, w) => `Numbers as words: ${b + w} to review`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0 ? '' : `${plural(b + w, 'number word', 'number words')} to review.`
		}
	];
</script>

<script lang="ts">
	// 09-UI-SPEC "Listing description" (STU-01): lead, DisclosureStatus, action row, the facts
	// form, the Phase 5 GenerationPanel (Fair Housing plus the studio number, number-word and
	// unsupported-feature checks), the count line and Draft history.
	//
	// The disclosure is the agent's ad-block disclosure (the Avery Sample one while the form holds
	// unedited sample facts and the profile is incomplete). It is appended in this browser through
	// emailFooter + formatForExit, so it rides along in all three exits and never reaches the AI.
	// With an incomplete profile and the agent's own facts, every exit is gated with the profile
	// reason (exitDisabled); writing drafts still works.
	//
	// The run control validates first: no request while a required fact is invalid, and focus
	// moves to the first invalid field. Dexie (autosave, Draft history) and the profile load by
	// dynamic import in onMount, so the prerendered page shows only the loading line.
	import { onMount, tick, untrack } from 'svelte';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import type { ProfileInput } from '@tran/core/agent/types';
	import { composeDisclosure } from '@tran/core/disclosure';
	import { DISCLOSURE_FIELD_LABELS, missingFor, type ListingFacts } from '@tran/core/studio';
	import { PROVIDER_LABELS } from '$lib/ai/models';
	import { aiPrefs } from '$lib/ai/prefs.svelte';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import type { ExitDisabled } from '$lib/ai/ui/panel-controller';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import {
		SAMPLE_AGENT_PROFILE,
		isProfileComplete,
		loadAgentProfile,
		toDisclosureProfile
	} from '$lib/features/shared/agent-profile';
	import { announce, Button, ConfirmDialog } from '$lib/features/shared/data/platform-ui';
	import type { StudioAutosave } from '$lib/storage/studio/autosave.svelte';
	import CharacterCount from '../CharacterCount.svelte';
	import DisclosureStatus from '../DisclosureStatus.svelte';
	import { SAMPLE_LISTING_FACTS } from '../fixtures/sample-listing-facts';
	import {
		listingAllowedNumbers,
		numberPostCheck,
		numberWordsPostCheck,
		unsupportedFeaturePostCheck
	} from '../post-checks';
	import { countLine, siteLimitLine, withDisclosure } from './listing-count';
	import ListingFactsForm from './ListingFactsForm.svelte';
	import {
		emptyListingForm,
		factsToForm,
		restoreListingForm,
		sameForm,
		toFactsInput,
		validateListingForm,
		type ListingForm
	} from './listing-form';

	const FOOTER_LABEL = 'Added to the end of this description';

	let form = $state<ListingForm>(emptyListingForm());
	let profile = $state<ProfileInput | null>(null);
	let ready = $state(false);
	let formRef = $state<ReturnType<typeof ListingFactsForm> | null>(null);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let repo = $state<ArtifactRepo | null>(null);
	let savedId = $state<string | null>(null);
	let draftText = $state('');
	let refreshKey = $state(0);
	let clearOpen = $state(false);
	let clearedJustNow = false;
	/** The facts the last run was written from (checks fall back to them while the form is invalid). */
	let generatedFacts = $state<ListingFacts | null>(null);
	let autosave: StudioAutosave | null = null;

	const SAMPLE_FORM = factsToForm(SAMPLE_LISTING_FACTS);
	/** Fallback when no facts have validated yet (a draft reopened from history on an empty form). */
	const NO_FACTS: ListingFacts = {
		listingType: 'sale',
		propertyType: 'Single family',
		bedrooms: 0,
		bathrooms: 0,
		features: [],
		nearby: [],
		tone: 'warm',
		length: 'medium'
	};

	const usingSampleFacts = $derived(sameForm(form, SAMPLE_FORM));
	const profileComplete = $derived(isProfileComplete(profile, 'ad-block'));
	const sampleDisclosure = $derived(usingSampleFacts && !profileComplete);

	const validation = $derived(validateListingForm(form, new Date()));
	const validFacts = $derived(validation.ok ? validation.value : null);
	const checkFacts = $derived(validFacts ?? generatedFacts ?? NO_FACTS);
	// Invalid input is still passed through: the run control validates before any request, and
	// the prompt's build() refuses anything off the whitelist.
	const inputs = $derived(validFacts ?? toFactsInput(form));

	const postChecks = $derived([
		numberPostCheck('listing', listingAllowedNumbers(checkFacts)),
		unsupportedFeaturePostCheck(checkFacts),
		numberWordsPostCheck()
	]);

	// The disclosure that is appended: the agent's own once the profile is complete, the sample
	// agent's while unedited sample facts are in the form, otherwise none (the exits are gated).
	const footerProfile = $derived<ProfileInput | null>(
		profileComplete ? profile : sampleDisclosure ? SAMPLE_AGENT_PROFILE : null
	);
	const footerText = $derived(
		footerProfile ? composeDisclosure(footerProfile, { variant: 'ad-block' }).text : ''
	);
	const emailFooter = $derived(footerText ? { text: footerText, label: FOOTER_LABEL } : undefined);

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
			missingFor(profile ? toDisclosureProfile(profile) : NO_PROFILE, 'ad-block').map(
				(f) => DISCLOSURE_FIELD_LABELS[f]
			)
		)
	);
	const gateReason = $derived(
		`Add your ${missingText} in your profile so your disclosure can be added.`
	);
	const exitDisabled = $derived<ExitDisabled>(
		!profileComplete && !usingSampleFacts
			? { copy: gateReason, email: gateReason, 'marked-sent': gateReason }
			: {}
	);

	const streetOrArea = $derived(form.streetOrArea.trim());
	const mailto = $derived({
		subject: streetOrArea ? `Listing description: ${streetOrArea}` : 'Listing description'
	});

	const providerLabel = $derived(
		aiPrefs.provider && !aiPrefs.sample ? PROVIDER_LABELS[aiPrefs.provider] : 'your AI provider'
	);

	const count = $derived(draftText ? countLine(draftText, footerText) : '');
	const siteLine = $derived(
		draftText ? siteLimitLine(draftText, validFacts?.siteCharLimit ?? undefined) : null
	);

	/** Run control: validate first; an invalid form makes no request and focuses its first error. */
	function beforeGenerate(): boolean {
		const r = formRef?.validate();
		if (!r) return false;
		if (!r.ok || !r.facts) {
			const id = r.firstInvalidId;
			void tick().then(() => {
				if (id) document.getElementById(id)?.focus();
			});
			return false;
		}
		generatedFacts = r.facts;
		return true;
	}

	async function fillSample(): Promise<void> {
		form = factsToForm(SAMPLE_LISTING_FACTS);
		formRef?.clearErrors();
		announce('Sample facts filled in.');
		await tick();
		formRef?.focusFirst();
	}

	async function clearFacts(): Promise<void> {
		form = emptyListingForm();
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

	function onOpen(a: AiArtifact): void {
		void panel?.openArtifact(a);
	}

	// Draft history reloads after the panel saves or opens a draft, and after every exit.
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
			const a = autosaveMod.createStudioAutosave('listing');
			autosave = a;
			const data = await a.load().catch(() => null);
			if (disposed) return;
			if (data !== null) form = restoreListingForm(data);
			profile = saved;
			repo = artifacts.createArtifactRepo();
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
		'Enter the facts about the home. Tran writes a description in your tone using only those facts, checks it for Fair Housing problem phrases, and adds your disclosure.';
</script>

{#if !ready}
	<p class="mt-4 text-label text-muted-foreground">Loading your studio&hellip;</p>
{:else}
	<div class="mt-6 flex max-w-reading min-w-0 flex-col gap-8" data-listing-studio>
		<p class="text-base leading-[1.6] text-foreground">{LEAD}</p>

		<DisclosureStatus {profile} usingSample={sampleDisclosure} />

		<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
			<Button variant="outline" onclick={() => void fillSample()}>
				<FlaskConical size={16} aria-hidden="true" />
				Fill with sample facts
			</Button>
			<ConfirmDialog
				bind:open={clearOpen}
				title="Clear these facts?"
				body={["This empties the form. Drafts in Draft history aren't affected."]}
				confirmLabel="Clear facts"
				confirmBusyLabel="Clearing…"
				cancelLabel="Keep them"
				onConfirm={clearFacts}
				onCloseAutoFocus={focusAfterClear}
			>
				{#snippet trigger({ props })}
					<Button {...props} variant="ghost">
						<Eraser size={16} aria-hidden="true" />
						Clear facts
					</Button>
				{/snippet}
			</ConfirmDialog>
			{#if usingSampleFacts}<SampleChip />{/if}
		</div>

		<ListingFactsForm bind:this={formRef} bind:form />

		<p class="text-label text-muted-foreground" data-listing-sent-note>
			Your disclosure is added in this browser after the draft is written. It isn't sent to {providerLabel}.
		</p>

		<div class="flex min-w-0 flex-col gap-4">
			<GenerationPanel
				bind:this={panel}
				bind:savedId
				bind:draftText
				feature="studio-listing"
				promptId="studio/listing.v1"
				{inputs}
				title="Listing description"
				headingLevel={2}
				generateLabel="Write description"
				containsClientData={false}
				{mailto}
				{postChecks}
				checkGroups={LISTING_CHECK_GROUPS}
				{emailFooter}
				formatForExit={withDisclosure}
				{exitDisabled}
				{beforeGenerate}
				onExit={() => refreshKey++}
			/>

			{#if count}
				<div class="flex flex-col gap-1" data-listing-count>
					<CharacterCount length={draftText.length} text={count} />
					{#if siteLine}
						<CharacterCount
							length={siteLine.length}
							limit={siteLine.limit}
							text={siteLine.text}
							overText={siteLine.overText}
						/>
					{/if}
				</div>
			{/if}
		</div>

		{#if repo}
			<DraftHistory feature="studio-listing" {repo} headingLevel={3} {onOpen} {refreshKey} />
		{/if}
	</div>
{/if}
