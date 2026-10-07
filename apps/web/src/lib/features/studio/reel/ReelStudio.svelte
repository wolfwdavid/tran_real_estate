<script lang="ts" module>
	import type { CheckGroupCopy } from '$lib/ai/ui/post-check';
	import { STUDIO_CHECKERS } from '../post-checks';
	import type { ProfileInput } from '@tran/core/agent/types';
	import { composeDisclosure } from '@tran/core/disclosure';
	import { SAMPLE_AGENT_PROFILE, isProfileComplete } from '$lib/features/shared/agent-profile';
	import { REEL_CHECKERS } from './reel-checks';
	import { reelFooter } from './reel-export';

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	/**
	 * Findings groups after Fair Housing (presentational only; gating stays Phase 5's). None
	 * offers an automatic fix: a replacement number or result would itself be invented.
	 */
	export const REEL_CHECK_GROUPS: CheckGroupCopy[] = [
		{
			checker: STUDIO_CHECKERS.numbers,
			label: 'Number check',
			passedTitle: 'Number check passed',
			passedNote: 'Every number is one you typed.',
			findingsTitle: (b, w) => `Number check: ${b + w} to fix`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0
					? 'Every number is one you typed.'
					: `${plural(b + w, 'number', 'numbers')} to fix.`
		},
		{
			checker: REEL_CHECKERS.resultsBeat,
			label: 'Results check',
			passedTitle: 'Results check passed',
			findingsTitle: (b, w) => `Results check: ${b + w} to fix`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0 ? '' : `${plural(b + w, 'result', 'results')} you didn't provide.`
		},
		{
			checker: STUDIO_CHECKERS.numberWords,
			label: 'Numbers as words',
			passedTitle: 'Numbers are written as digits',
			findingsTitle: (b, w) => `Numbers as words: ${b + w} to review`,
			allowRemovePhrase: false,
			doneSentence: (b, w) =>
				b + w === 0 ? '' : `${plural(b + w, 'number word', 'number words')} to review.`
		},
		{
			checker: REEL_CHECKERS.quotes,
			label: 'Quote check',
			passedTitle: 'No quotes to confirm',
			findingsTitle: (b, w) => `Quote check: ${b + w} to review`,
			allowRemovePhrase: false,
			doneSentence: (b, w) => (b + w === 0 ? '' : `${plural(b + w, 'quote', 'quotes')} to confirm.`)
		}
	];

	export const REEL_FOOTER_LABEL = 'Added to the end of the copied script';

	/**
	 * The panel's emailFooter: the caption disclosure plus the checklist. The agent's own
	 * disclosure once the profile is complete; the Avery Sample one only while unedited sample
	 * beats are in the form; otherwise none (it would mislabel the agent), and the host gates
	 * every exit with the profile reason.
	 */
	export function reelEmailFooter(
		profile: ProfileInput | null,
		usingSampleBeats: boolean
	): { text: string; label: string } | undefined {
		const who = isProfileComplete(profile, 'ad-inline')
			? profile
			: usingSampleBeats
				? SAMPLE_AGENT_PROFILE
				: null;
		if (!who) return undefined;
		return {
			text: reelFooter(composeDisclosure(who, { variant: 'ad-inline' }).text),
			label: REEL_FOOTER_LABEL
		};
	}
</script>

<script lang="ts">
	// 09-UI-SPEC "Reel script" (STU-03): lead, DisclosureStatus, action row, the beats form, the
	// empty-results notice, the Phase 5 GenerationPanel (Fair Housing plus the reel number,
	// results-beat, number-word and quote checks), the derived Script at a glance view, the
	// AI-disclosure checklist and Draft history.
	//
	// The copied script is built in this browser by formatReelForExit: the timecoded beats, the
	// B-roll list, then emailFooter.text (the ad-inline caption disclosure and the checklist as
	// "[ ]" lines). None of it reaches the AI, and every time comes from REEL_TEMPLATES. With an
	// incomplete profile and the agent's own beats, every exit is gated with the profile reason
	// (exitDisabled); writing drafts still works.
	import { onMount, tick, untrack } from 'svelte';
	import Eraser from '@lucide/svelte/icons/eraser';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { DISCLOSURE_FIELD_LABELS, missingFor, type ReelLength } from '@tran/core/studio';
	import type { ReelInputs } from '$lib/ai/prompts/studio/reel.v1';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import type { ExitDisabled } from '$lib/ai/ui/panel-controller';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import { loadAgentProfile, toDisclosureProfile } from '$lib/features/shared/agent-profile';
	import { announce, Button, ConfirmDialog } from '$lib/features/shared/data/platform-ui';
	import type { StudioAutosave } from '$lib/storage/studio/autosave.svelte';
	import DisclosureStatus from '../DisclosureStatus.svelte';
	import { SAMPLE_REEL_BEATS, SAMPLE_REEL_BEATS_NO_RESULTS } from '../fixtures/sample-reel-beats';
	import { numberPostCheck, numberWordsPostCheck, reelAllowedNumbers } from '../post-checks';
	import AiDisclosureChecklist from './AiDisclosureChecklist.svelte';
	import ReelBeatsForm, {
		BEAT_FIELDS,
		emptyReelForm,
		restoreReelForm,
		sameStory,
		type ReelForm
	} from './ReelBeatsForm.svelte';
	import { quotePostCheck, resultsBeatPostCheck } from './reel-checks';
	import { formatReelForExit } from './reel-export';
	import ReelScriptView from './ReelScriptView.svelte';

	let form = $state<ReelForm>(emptyReelForm());
	let profile = $state<ProfileInput | null>(null);
	let ready = $state(false);
	let formRef = $state<ReturnType<typeof ReelBeatsForm> | null>(null);
	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let repo = $state<ArtifactRepo | null>(null);
	let savedId = $state<string | null>(null);
	let draftText = $state('');
	/** True while the panel is connecting or streaming: the partial text is not judged as a script. */
	let running = $state(false);
	let refreshKey = $state(0);
	let clearOpen = $state(false);
	let clearedJustNow = false;
	/** The length the current draft was written for (the view and the copy keep it until the next run). */
	let scriptLength = $state<ReelLength | null>(null);
	let autosave: StudioAutosave | null = null;

	const length = $derived<ReelLength>(scriptLength ?? form.length);

	// Unedited sample beats (with or without results; the length is a style choice).
	const usingSampleBeats = $derived(
		sameStory(form, SAMPLE_REEL_BEATS) || sameStory(form, SAMPLE_REEL_BEATS_NO_RESULTS)
	);
	const profileComplete = $derived(isProfileComplete(profile, 'ad-inline'));
	const sampleDisclosure = $derived(usingSampleBeats && !profileComplete);
	const resultsEmpty = $derived(form.results.trim() === '');

	/** The beat fields only: what the agent typed, the source of every allowed number. */
	const beats = $derived<Record<string, string>>(
		Object.fromEntries(BEAT_FIELDS.map(({ key }) => [key, form[key]]))
	);
	const inputs = $derived<ReelInputs>({
		length: form.length,
		hook: form.hook,
		pain: form.pain,
		beforeAfter: form.beforeAfter,
		results: form.results,
		mission: form.mission,
		cta: form.cta
	});

	const postChecks = $derived([
		numberPostCheck('reel', reelAllowedNumbers(beats)),
		resultsBeatPostCheck(!beats.results?.trim()),
		numberWordsPostCheck(),
		quotePostCheck()
	]);

	// The caption disclosure and checklist (none with the agent's own beats and an incomplete
	// profile: the exits are gated then).
	const emailFooter = $derived(reelEmailFooter(profile, usingSampleBeats));
	const formatForExit = (d: string, f: string) => formatReelForExit(d, f, length);

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
	const gateReason = $derived(
		`Add your ${missingText} in your profile so your disclosure can be added.`
	);
	const exitDisabled = $derived<ExitDisabled>(
		!profileComplete && !usingSampleBeats
			? { copy: gateReason, email: gateReason, 'marked-sent': gateReason }
			: {}
	);

	const mailto = { subject: 'Reel script' };

	/** Run control: validate first; an invalid form makes no request and focuses its first error. */
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
		scriptLength = form.length;
		return true;
	}

	async function fillSample(): Promise<void> {
		form = { ...SAMPLE_REEL_BEATS };
		formRef?.clearErrors();
		announce('Sample beats filled in.');
		await tick();
		formRef?.focusFirst();
	}

	async function clearBeats(): Promise<void> {
		form = emptyReelForm();
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
		// A reopened draft is shown at the form's current length (drafts don't store one).
		scriptLength = null;
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
			const a = autosaveMod.createStudioAutosave('reel');
			autosave = a;
			const data = await a.load().catch(() => null);
			if (disposed) return;
			if (data !== null) form = restoreReelForm(data);
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
		'Tell your story in your own words, beat by beat. Tran turns it into a timed script with captions and a B-roll list. Results come only from what you type here.';
	const RESULTS_NOTICE =
		"You haven't added results, so the script will say [Add a real result you can document] in the results beat. Fill it in with a real result before you record.";
</script>

{#if !ready}
	<p class="mt-4 text-label text-muted-foreground">Loading your studio&hellip;</p>
{:else}
	<div class="mt-6 flex min-w-0 flex-col gap-8" data-reel-studio>
		<div class="flex max-w-reading min-w-0 flex-col gap-8">
			<p class="text-base leading-[1.6] text-foreground">{LEAD}</p>

			<DisclosureStatus {profile} usingSample={sampleDisclosure} />

			<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
				<Button variant="outline" onclick={() => void fillSample()}>
					<FlaskConical size={16} aria-hidden="true" />
					Fill with sample beats
				</Button>
				<ConfirmDialog
					bind:open={clearOpen}
					title="Clear these beats?"
					body={["This empties the form. Drafts in Draft history aren't affected."]}
					confirmLabel="Clear beats"
					confirmBusyLabel="Clearing…"
					cancelLabel="Keep them"
					onConfirm={clearBeats}
					onCloseAutoFocus={focusAfterClear}
				>
					{#snippet trigger({ props })}
						<Button {...props} variant="ghost">
							<Eraser size={16} aria-hidden="true" />
							Clear beats
						</Button>
					{/snippet}
				</ConfirmDialog>
				{#if usingSampleBeats}<SampleChip />{/if}
			</div>

			<ReelBeatsForm bind:this={formRef} bind:form />

			{#if resultsEmpty}
				<p
					class="flex items-start gap-2 text-base leading-[1.6] text-foreground"
					data-reel-results-notice
				>
					<TriangleAlert size={16} class="mt-1 shrink-0 text-foreground" aria-hidden="true" />
					<span>{RESULTS_NOTICE}</span>
				</p>
			{/if}

			<GenerationPanel
				bind:this={panel}
				bind:savedId
				bind:draftText
				bind:running
				feature="studio-reel"
				promptId="studio/reel.v1"
				{inputs}
				title="Reel script"
				headingLevel={2}
				generateLabel="Write reel script"
				containsClientData={false}
				{mailto}
				{postChecks}
				checkGroups={REEL_CHECK_GROUPS}
				{emailFooter}
				{formatForExit}
				{exitDisabled}
				{beforeGenerate}
				onExit={() => refreshKey++}
			/>
		</div>

		<ReelScriptView draft={draftText} {length} streaming={running} />

		<div class="flex max-w-reading min-w-0 flex-col gap-8">
			<AiDisclosureChecklist />

			{#if repo}
				<DraftHistory feature="studio-reel" {repo} headingLevel={3} {onOpen} {refreshKey} />
			{/if}
		</div>
	</div>
{/if}
