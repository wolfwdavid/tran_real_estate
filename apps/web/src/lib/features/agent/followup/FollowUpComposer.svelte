<script lang="ts">
	// 08-UI-SPEC "FollowUpComposer" (AGT-06): purpose, subject and points above the Phase 5
	// GenerationPanel. The model drafts the body only; the signature, mailing address, opt-out line
	// and disclosure are the deterministic footer from followupState (composeEmailFooter), handed
	// to the panel as `emailFooter`, so all three exits (Copy text, Open in email app, Mark as sent)
	// carry draft + footer and the provider never sees it. Tran never sends anything: Mark as sent
	// only logs "Follow-up email marked as sent" and updates the contact's last contact date.
	//
	// Gates: opted-out contacts get no panel; a real contact with an incomplete profile gets the
	// prerequisite block; a sample contact falls back to the sample agent profile; a contact with
	// no email keeps Copy text but gates Open in email app with a reason.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Info from '@lucide/svelte/icons/info';
	import { onMount, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { STAGES, type Contact, type ProfileInput, type Stage } from '@tran/core/agent/types';
	import { PROVIDER_LABELS } from '$lib/ai/models';
	import { aiPrefs } from '$lib/ai/prefs.svelte';
	import type { AiArtifact, ArtifactRepo } from '$lib/ai/storage/artifacts';
	import DraftHistory from '$lib/ai/ui/DraftHistory.svelte';
	import GenerationPanel from '$lib/ai/ui/GenerationPanel.svelte';
	import type { ExitKind } from '$lib/ai/ui/panel-controller';
	import { Alert } from '$lib/components/ui/alert/index.js';
	import SampleChip from '$lib/components/sample/SampleChip.svelte';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { buttonVariants, Input, Label } from '$lib/features/shared/data/platform-ui';
	import { markFollowupSent } from '$lib/storage/agent/contacts-repo';
	import NativeSelect from '../ui/NativeSelect.svelte';
	import {
		MAX_POINTS,
		MAX_SUBJECT,
		PURPOSES,
		SUBJECT_DEFAULTS,
		buildFollowupInputs,
		followupState,
		validateSubject
	} from './followup-compose';
	import { FOLLOWUP_FEATURE, FOLLOWUP_PROMPT_ID } from './followup-prompt';

	let { contact, profile }: { contact: Contact; profile: ProfileInput | null } = $props();

	const uid = $props.id();
	const ids = {
		purpose: `${uid}-purpose`,
		subject: `${uid}-subject`,
		subjectError: `${uid}-subject-error`,
		points: `${uid}-points`,
		pointsHelp: `${uid}-points-help`
	};

	// "They aren't sent to {Provider}": the chosen live provider, or a generic name while the
	// keyless sample provider (which sends nothing) is in use.
	const providerLabel = $derived(
		aiPrefs.provider && !aiPrefs.sample ? PROVIDER_LABELS[aiPrefs.provider] : 'your AI provider'
	);
	const st = $derived(followupState({ contact, profile }));

	const PURPOSE_OPTIONS = STAGES.map((s) => ({ value: s, label: PURPOSES[s] }));

	// The form starts from the contact's stage; the subject follows Purpose until it is edited.
	let purpose = $state<string>(untrack(() => contact.stage));
	let subject = $state(untrack(() => SUBJECT_DEFAULTS[contact.stage]));
	let subjectEdited = false;
	let points = $state('');
	let subjectError = $state<string | null>(null);
	let subjectEl = $state<HTMLInputElement | null>(null);

	const purposeStage = $derived(
		(STAGES as readonly string[]).includes(purpose) ? (purpose as Stage) : contact.stage
	);

	function onPurpose(v: string): void {
		if (subjectEdited) return;
		const s = (STAGES as readonly string[]).includes(v) ? (v as Stage) : contact.stage;
		subject = SUBJECT_DEFAULTS[s];
		subjectError = null;
	}

	const inputs = $derived(
		buildFollowupInputs(contact, { purpose: PURPOSES[purposeStage], subject, points })
	);
	const mailto = $derived({ to: contact.email.trim() || undefined, subject: subject.trim() });

	/** Generate runs only with a valid subject; otherwise the field shows its error and takes focus. */
	function beforeGenerate(): boolean {
		subjectError = validateSubject(subject);
		if (subjectError) {
			subjectEl?.focus();
			return false;
		}
		return true;
	}

	let panel = $state<ReturnType<typeof GenerationPanel> | null>(null);
	let repo = $state<ArtifactRepo | null>(null);
	let savedId = $state<string | null>(null);
	let refreshKey = $state(0);

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

	function onExit(kind: ExitKind): void {
		if (kind === 'marked-sent') void markFollowupSent(contact.id);
		refreshKey++;
	}

	function onOpen(a: AiArtifact): void {
		void panel?.openArtifact(a);
	}

	const labelClass = 'text-base leading-[1.6] font-semibold';
</script>

<div class="flex flex-col gap-6" data-followup={st.kind}>
	{#if st.kind === 'opted-out'}
		<p class="max-w-reading text-base leading-[1.6] text-foreground" data-followup-opted-out>
			{st.message}
		</p>
	{:else if st.kind === 'profile-incomplete'}
		<Alert variant="info" role={null} data-followup-prerequisite>
			<Info size={20} class="text-secondary" aria-hidden="true" />
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<h3 class="text-body font-semibold text-foreground">
						Before drafting emails, finish your profile
					</h3>
					<p class="text-base leading-[1.6] text-foreground">
						U.S. law requires a mailing address and a way to opt out in commercial email, and your
						license details belong in the disclosure. Missing: {st.missingText}.
					</p>
				</div>
				<a
					href={resolve('/agent/profile/')}
					class={buttonVariants({ variant: 'outline', class: 'min-h-11 self-start' })}
					>Finish your profile</a
				>
			</div>
		</Alert>
	{:else}
		<div class="flex flex-col gap-4">
			<NativeSelect
				id={ids.purpose}
				label="Purpose"
				bind:value={purpose}
				options={PURPOSE_OPTIONS}
				onchange={onPurpose}
			/>
			<div class="grid gap-2">
				<Label for={ids.subject} class={labelClass}>Email subject</Label>
				<Input
					id={ids.subject}
					bind:ref={subjectEl}
					bind:value={subject}
					type="text"
					required
					maxlength={MAX_SUBJECT}
					autocomplete="off"
					class="h-12"
					aria-invalid={subjectError ? 'true' : undefined}
					aria-describedby={subjectError ? ids.subjectError : undefined}
					oninput={() => {
						subjectEdited = true;
						subjectError = null;
					}}
				/>
				{#if subjectError}
					<p id={ids.subjectError} class="flex items-center gap-1 text-label text-destructive">
						<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
						{subjectError}
					</p>
				{/if}
			</div>
			<div class="grid gap-2">
				<Label for={ids.points} class={labelClass}>Points to include (optional)</Label>
				<Textarea
					id={ids.points}
					bind:value={points}
					maxlength={MAX_POINTS}
					aria-describedby={ids.pointsHelp}
					class="min-h-40"
				/>
				<p id={ids.pointsHelp} class="text-label text-muted-foreground">
					A sentence or two, like "mention the open house on Saturday".
				</p>
			</div>
		</div>

		{#if st.usingSampleProfile}
			<p
				class="flex flex-wrap items-center gap-2 text-base leading-[1.6] text-foreground"
				data-followup-sample-profile
			>
				<SampleChip />
				<span
					>Using a sample agent profile for this sample contact. <a
						href={resolve('/agent/profile/')}
						class="text-primary underline">Set up your profile</a
					> to use your own details.</span
				>
			</p>
		{/if}

		<p class="text-label text-muted-foreground" data-followup-sent-note>
			Your signature, mailing address, opt-out line, and disclosure are added in this browser after
			the draft is written. They aren't sent to {providerLabel}.
		</p>

		<GenerationPanel
			bind:this={panel}
			bind:savedId
			feature={FOLLOWUP_FEATURE}
			promptId={FOLLOWUP_PROMPT_ID}
			{inputs}
			title="Follow-up draft"
			headingLevel={3}
			generateLabel="Draft follow-up email"
			containsClientData
			subjectId={contact.id}
			{mailto}
			tokens={st.tokens}
			emailFooter={st.emailFooter}
			exitDisabled={st.exitDisabled}
			{beforeGenerate}
			onExit={(kind) => onExit(kind)}
		/>

		{#if repo}
			<DraftHistory
				feature={FOLLOWUP_FEATURE}
				{repo}
				headingLevel={4}
				subjectId={contact.id}
				{onOpen}
				{refreshKey}
			/>
		{:else}
			<p class="text-label text-muted-foreground">Checking this browser&hellip;</p>
		{/if}
	{/if}
</div>
