<script lang="ts">
	// 09-UI-SPEC "DisclosureStatus": the disclosure every studio tool appends, shown before any
	// generating. Three states:
	//   Ready      - secondary-surface, CircleCheck, the composed ad-inline line, Edit in your profile
	//   Incomplete - Phase 8 prerequisite style (4px secondary left rule), the missing fields,
	//                Finish your profile. Writing drafts still works; the exits are gated by the tool.
	//   Sample     - accent-surface, FlaskConical, the Avery Sample line, Set up your profile.
	// usingSample is decided by the caller (the form holds unedited sample input AND the profile is
	// incomplete). The disclosure text always comes from the composer, never from the model.
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Info from '@lucide/svelte/icons/info';
	import { resolve } from '$app/paths';
	import type { ProfileInput } from '@tran/core/agent/types';
	import { composeDisclosure } from '@tran/core/disclosure';
	import { DISCLOSURE_FIELD_LABELS, missingFor, type DisclosureProfile } from '@tran/core/studio';
	import { Alert } from '$lib/components/ui/alert/index.js';
	import { buttonVariants } from '$lib/features/shared/data/platform-ui';
	import { SAMPLE_AGENT_PROFILE, toDisclosureProfile } from '$lib/features/shared/agent-profile';

	let { profile, usingSample }: { profile: ProfileInput | null; usingSample: boolean } = $props();

	// No saved profile yet: every base field is missing (no state, so no brokerage phone rule).
	const NO_PROFILE: DisclosureProfile = {
		fullName: '',
		brokerage: '',
		licenseType: '',
		licenseNumber: '',
		licenseState: ''
	};
	const missing = $derived(
		missingFor(profile === null ? NO_PROFILE : toDisclosureProfile(profile), 'ad-inline')
	);
	const mode = $derived<'sample' | 'ready' | 'incomplete'>(
		usingSample ? 'sample' : profile !== null && missing.length === 0 ? 'ready' : 'incomplete'
	);
	const missingText = $derived(missing.map((f) => DISCLOSURE_FIELD_LABELS[f]).join(', '));
	const disclosure = $derived(
		mode === 'sample'
			? composeDisclosure(SAMPLE_AGENT_PROFILE, { variant: 'ad-inline' }).text
			: mode === 'ready' && profile !== null
				? composeDisclosure(profile, { variant: 'ad-inline' }).text
				: ''
	);
	const profileHref = resolve('/agent/profile/');
</script>

<div class="flex flex-col gap-2" data-disclosure-status={mode}>
	{#if mode === 'ready'}
		<div class="flex items-start gap-3 rounded-lg bg-secondary-surface p-4">
			<CircleCheck size={20} class="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
			<div class="flex min-w-0 flex-col gap-2">
				<h2 class="text-body font-semibold text-foreground">Your disclosure is ready</h2>
				<p class="text-body text-foreground">
					Added to the end of every description, post, and script you copy:
				</p>
				<p
					class="rounded-md bg-surface p-4 text-body [overflow-wrap:anywhere] text-foreground"
					data-disclosure-text
				>
					{disclosure}
				</p>
				<p class="text-body">
					<a
						href={profileHref}
						class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2"
						>Edit in your profile</a
					>
				</p>
			</div>
		</div>
	{:else if mode === 'incomplete'}
		<Alert variant="info" role={null} data-disclosure-incomplete>
			<Info size={20} class="text-secondary" aria-hidden="true" />
			<div class="flex flex-col gap-4">
				<div class="flex flex-col gap-2">
					<h2 class="text-body font-semibold text-foreground">
						Finish your profile to copy studio content
					</h2>
					<p class="text-body text-foreground">
						Your brokerage and license details are added to everything you copy, and some are
						missing. Missing: {missingText}. You can still write drafts now.
					</p>
				</div>
				<a
					href={profileHref}
					class={buttonVariants({ variant: 'outline', class: 'min-h-11 self-start' })}
					>Finish your profile</a
				>
			</div>
		</Alert>
	{:else}
		<div
			class="flex items-start gap-3 rounded-lg border border-border-strong bg-accent-surface p-4"
			data-disclosure-sample
		>
			<FlaskConical size={20} class="mt-0.5 shrink-0 text-foreground" aria-hidden="true" />
			<div class="flex min-w-0 flex-col gap-2">
				<p class="text-body text-foreground">
					Using a sample agent profile with sample facts. <a
						href={profileHref}
						class="font-semibold text-primary underline underline-offset-3 hover:text-primary-hover hover:decoration-2"
						>Set up your profile</a
					> to use your own details.
				</p>
				<p
					class="rounded-md bg-surface p-4 text-body [overflow-wrap:anywhere] text-foreground"
					data-disclosure-text
				>
					{disclosure}
				</p>
			</div>
		</div>
	{/if}
	<p class="text-label text-muted-foreground">
		Check your disclosure against your state's and brokerage's advertising rules. This isn't legal
		advice.
	</p>
</div>
