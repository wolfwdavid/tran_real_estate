<script lang="ts">
	// Per-portal waitlist (GTM-02, UI-SPEC WaitlistForm). Open only when the owner's Web3Forms key is
	// built in; otherwise a coming-soon panel with no fields. Submit order: validate, then the
	// honeypot/timing gate, then ONE request to https://api.web3forms.com/submit carrying only the
	// email, the portal and fixed labels. Success lives in memory only: nothing is stored.
	// The email input deliberately has no `name`: a submit before hydration falls back to a native
	// GET to the same page, and without a name the address never lands in the URL or history.
	import { onMount, tick } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import Send from '@lucide/svelte/icons/send';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { FORMS_COPY } from '$lib/content/forms';
	import { submitOwnerForm } from '$lib/leads/owner-forms';
	import ComingSoonPanel from './ComingSoonPanel.svelte';
	import FormError from './FormError.svelte';
	import FormSuccess from './FormSuccess.svelte';
	import {
		PORTAL_NAMES,
		formMode,
		gateSubmit,
		validateEmail,
		waitlistBody,
		type EmailError,
		type Portal
	} from './form-gate';

	interface Props {
		portal: Portal;
		accessKey?: string;
		contactEmail?: string;
	}

	let { portal, accessKey, contactEmail }: Props = $props();

	const copy = FORMS_COPY.waitlist;
	const mode = $derived(formMode(accessKey ?? '', contactEmail ?? ''));
	const portalName = $derived(PORTAL_NAMES[portal]);
	const inputId = $derived(`waitlist-email-${portal}`);
	const privacyId = $derived(`waitlist-privacy-${portal}`);
	const errorId = $derived(`waitlist-error-${portal}`);

	let email = $state('');
	let honeypot = $state(false);
	let fieldError = $state<EmailError | null>(null);
	let tooFast = $state(false);
	let failure = $state<{ title: string; body: string } | null>(null);
	let sending = $state(false);
	let sent = $state(false);
	// Date.now() (not performance.now()) so Playwright's clock controls the timing gate.
	let mountedAt = 0;

	let inputEl = $state<HTMLInputElement | null>(null);
	let buttonEl = $state<HTMLButtonElement | null>(null);
	let successTitle = $state<HTMLParagraphElement | null>(null);

	// Hydration marker: the prerendered form is inert until this is set (specs wait on it).
	let ready = $state(false);

	onMount(() => {
		mountedAt = Date.now();
		ready = true;
	});

	function onblur() {
		// Validate on blur only once something was typed, so tabbing past is not an error.
		if (email.trim() !== '' || fieldError !== null) fieldError = validateEmail(email, true);
	}

	async function showSuccess() {
		sent = true;
		await tick();
		successTitle?.focus();
		announce(copy.successAnnouncement(portal));
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		failure = null;
		tooFast = false;

		fieldError = validateEmail(email, true);
		if (fieldError !== null) {
			inputEl?.focus();
			return;
		}

		const g = gateSubmit({ honeypot, mountedAt, now: Date.now() });
		if (g === 'bot') return showSuccess();
		if (g === 'too-fast') {
			tooFast = true;
			announce(copy.tooFast);
			return;
		}

		sending = true;
		const r = await submitOwnerForm(waitlistBody({ key: accessKey ?? '', portal, email }));
		sending = false;
		if (r.ok) return showSuccess();

		failure = r.kind === 'network' ? copy.networkError : copy.rejectedError;
		announce(`${failure.title}. ${failure.body}`);
		// The button was disabled while sending; let it re-enable before focus returns to it.
		await tick();
		buttonEl?.focus();
	}
</script>

<section id="waitlist" aria-labelledby="waitlist-heading" class="bg-background py-12 md:py-16">
	<div class="mx-auto max-w-page px-6 md:px-8">
		<div class="max-w-reading">
			<p class="text-label font-semibold tracking-[0.06em] text-secondary uppercase">
				{copy.eyebrow}
			</p>
			<h2 id="waitlist-heading" class="mt-2 font-display text-heading font-semibold">
				{copy.heading(portal)}
			</h2>
			<p class="mt-4 text-muted-foreground">{copy.paragraph(portal)}</p>

			<div class="mt-6">
				{#if mode !== 'open'}
					<ComingSoonPanel
						title={copy.comingSoonTitle}
						body={mode === 'coming-soon-contact' ? copy.comingSoonContactBody : copy.comingSoonBody}
						contactEmail={mode === 'coming-soon-contact' ? contactEmail : undefined}
						subject={copy.mailSubject(portalName)}
						linkText={copy.comingSoonLink}
					/>
				{:else if sent}
					<FormSuccess
						title={copy.successTitle(portal)}
						body={copy.successBody}
						bind:titleEl={successTitle}
					/>
				{:else}
					<form
						novalidate
						onsubmit={submit}
						data-ready={ready ? '' : undefined}
						aria-busy={sending}
						aria-label={copy.heading(portal)}
						class="grid max-w-[480px] gap-2"
					>
						{#if failure}
							<FormError
								title={failure.title}
								body={failure.body}
								{contactEmail}
								subject={copy.mailSubject(portalName)}
							/>
						{/if}
						{#if tooFast}
							<p data-too-fast class="flex items-start gap-2 text-foreground">
								<CircleAlert
									size={20}
									class="mt-0.5 shrink-0 text-destructive"
									aria-hidden="true"
								/>
								<span>{copy.tooFast}</span>
							</p>
						{/if}
						<label for={inputId} class="font-semibold">{copy.label}</label>
						<div class="flex flex-col gap-2 sm:flex-row">
							<input
								id={inputId}
								bind:this={inputEl}
								bind:value={email}
								{onblur}
								type="email"
								autocomplete="email"
								inputmode="email"
								autocapitalize="off"
								spellcheck="false"
								maxlength={254}
								disabled={sending}
								aria-invalid={fieldError !== null ? 'true' : undefined}
								aria-describedby={`${privacyId} ${errorId}`}
								class="h-12 w-full min-w-0 flex-1 rounded-md border border-input bg-card px-4 text-body text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-destructive"
							/>
							<Button type="submit" bind:ref={buttonEl} disabled={sending} class="w-full sm:w-auto">
								<span class="grid">
									<span
										class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
										class:invisible={sending}
									>
										<Send size={16} aria-hidden="true" />{copy.button}
									</span>
									<span
										class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
										class:invisible={!sending}
									>
										<LoaderCircle
											size={16}
											class="motion-safe:animate-spin"
											aria-hidden="true"
										/>{copy.sending}
									</span>
								</span>
							</Button>
						</div>
						<p id={privacyId} class="text-label text-muted-foreground">{copy.privacy(portal)}</p>
						<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
							{#if fieldError !== null}
								<CircleAlert size={16} class="shrink-0" aria-hidden="true" />{copy.validation[
									fieldError
								]}
							{/if}
						</p>
						<!-- Spam trap: display:none via a class (CSP forbids inline styles), so it is out of the
						     tab order and the accessibility tree. A checked box sends nothing. -->
						<div class="hp">
							<label>
								Leave this unchecked
								<input
									type="checkbox"
									name="botcheck"
									tabindex="-1"
									autocomplete="off"
									bind:checked={honeypot}
								/>
							</label>
						</div>
					</form>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.hp {
		display: none;
	}
</style>
