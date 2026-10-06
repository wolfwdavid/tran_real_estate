<script lang="ts">
	// The public inquiry form (AGT-02). Runs in a lead's browser: no storage, vault, AI or data
	// imports. Submit order: validate, then the honeypot/timing gate, then (unless demo) the single
	// Web3Forms request. Every value renders as text; nothing typed here is stored by Tran.
	import { onMount, tick } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import Send from '@lucide/svelte/icons/send';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import { Alert, AlertDescription, AlertTitle } from '$lib/components/ui/alert/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { submitInquiry } from '$lib/leads/web3forms-sink';
	import {
		evaluateGate,
		MAX_INQUIRY_MESSAGE,
		validateInquiry,
		type InquiryField
	} from './inquiry-gate';

	interface Props {
		agentName: string;
		/** The agent's public Web3Forms access key; null in demo mode (nothing is ever sent). */
		accessKey: string | null;
		initialProperty?: string;
	}

	let { agentName, accessKey, initialProperty = '' }: Props = $props();

	const TOO_FAST =
		"Your message hasn't been sent yet. Take a moment to check your details, then press Send message again.";

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	// svelte-ignore state_referenced_locally
	let property = $state(initialProperty);
	let message = $state('');
	let consent = $state(false);
	let honeypot = $state(false);

	let errors = $state<Partial<Record<InquiryField, string>>>({});
	let tooFast = $state(false);
	let failure = $state<{ title: string; body: string } | null>(null);
	let sending = $state(false);
	let sent = $state(false);
	let startedAt = 0;

	let nameEl = $state<HTMLInputElement | null>(null);
	let emailEl = $state<HTMLInputElement | null>(null);
	let messageEl = $state<HTMLTextAreaElement | null>(null);
	let consentEl = $state<HTMLInputElement | null>(null);
	let sendEl = $state<HTMLButtonElement | null>(null);
	let successHeading = $state<HTMLHeadingElement | null>(null);

	onMount(() => {
		startedAt = performance.now();
	});

	const errId = (f: InquiryField) => `inquiry-${f}-error`;
	const describedBy = (f: InquiryField, extra?: string) =>
		[errors[f] ? errId(f) : '', extra ?? ''].filter(Boolean).join(' ') || undefined;

	function focusField(f: InquiryField) {
		const el = { name: nameEl, email: emailEl, message: messageEl, consent: consentEl }[f];
		el?.focus();
	}

	async function showSuccess() {
		sent = true;
		await tick();
		successHeading?.focus();
		announce('Message sent.');
	}

	async function onsubmit(event: SubmitEvent) {
		event.preventDefault();
		if (sending) return;
		failure = null;
		tooFast = false;

		const v = validateInquiry({ name, email, message, consent }, agentName);
		errors = v.errors;
		if (v.firstInvalid !== null) {
			focusField(v.firstInvalid);
			return;
		}

		const gate = evaluateGate({
			honeypotChecked: honeypot,
			elapsedMs: performance.now() - startedAt
		});
		if (gate === 'drop-silently') return showSuccess();
		if (gate === 'too-fast') {
			tooFast = true;
			announce(TOO_FAST);
			return;
		}
		if (accessKey === null) return showSuccess();

		sending = true;
		const result = await submitInquiry({
			key: accessKey,
			agentName,
			name: name.trim(),
			email: email.trim(),
			phone: phone.trim() === '' ? undefined : phone.trim(),
			property: property.trim() === '' ? undefined : property.trim(),
			message,
			submittedAt: new Date().toISOString()
		});
		sending = false;
		if (result.ok) return showSuccess();

		failure =
			result.kind === 'network'
				? {
						title: "Your message wasn't sent",
						body: 'Check your internet connection, then press Send message again. What you typed is still here.'
					}
				: {
						title: "This form can't send messages right now",
						body: `Nothing was sent. Please contact ${agentName} another way. What you typed is still here, so you can copy it.`
					};
		announce(`${failure.title}. ${failure.body}`);
		sendEl?.focus();
	}

	async function sendAnother() {
		name = '';
		email = '';
		phone = '';
		property = initialProperty;
		message = '';
		consent = false;
		honeypot = false;
		errors = {};
		tooFast = false;
		failure = null;
		sent = false;
		startedAt = performance.now();
		await tick();
		nameEl?.focus();
	}
</script>

{#snippet fieldError(f: InquiryField)}
	{#if errors[f]}
		<p id={errId(f)} class="flex items-center gap-1 text-label text-destructive">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{errors[f]}
		</p>
	{/if}
{/snippet}

{#if sent}
	<section
		data-inquiry-success
		class="grid gap-4 rounded-lg bg-secondary-surface p-6"
		aria-labelledby="inquiry-sent-title"
	>
		<CircleCheck class="size-6 text-secondary" aria-hidden="true" />
		<h2
			id="inquiry-sent-title"
			bind:this={successHeading}
			tabindex="-1"
			class="font-display text-heading font-semibold"
		>
			Message sent
		</h2>
		<p>
			{#if accessKey === null}
				Sample page: nothing was sent. On a real agent's page, this message would be emailed to
				them.
			{:else}
				{agentName} will get your message by email. If you don't hear back in a couple of business days,
				reach out to {agentName} another way.
			{/if}
		</p>
		<div>
			<Button variant="ghost" type="button" onclick={sendAnother}>Send another message</Button>
		</div>
	</section>
{:else}
	<form
		novalidate
		{onsubmit}
		aria-busy={sending}
		aria-label="Inquiry"
		class="relative grid gap-6 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6"
	>
		<div class="grid gap-2">
			<Label for="inquiry-name">Your name</Label>
			<Input
				id="inquiry-name"
				bind:ref={nameEl}
				bind:value={name}
				autocomplete="name"
				required
				maxlength={80}
				aria-invalid={errors.name ? 'true' : undefined}
				aria-describedby={describedBy('name')}
			/>
			{@render fieldError('name')}
		</div>

		<div class="grid gap-2">
			<Label for="inquiry-email">Email</Label>
			<Input
				id="inquiry-email"
				type="email"
				bind:ref={emailEl}
				bind:value={email}
				autocomplete="email"
				required
				maxlength={254}
				aria-invalid={errors.email ? 'true' : undefined}
				aria-describedby={describedBy('email')}
			/>
			{@render fieldError('email')}
		</div>

		<div class="grid gap-2">
			<Label for="inquiry-phone">Phone (optional)</Label>
			<Input id="inquiry-phone" type="tel" bind:value={phone} autocomplete="tel" maxlength={30} />
		</div>

		<div class="grid gap-2">
			<Label for="inquiry-property">Property you're asking about (optional)</Label>
			<Input id="inquiry-property" bind:value={property} maxlength={120} />
		</div>

		<div class="grid gap-2">
			<Label for="inquiry-message">Message</Label>
			<Textarea
				id="inquiry-message"
				bind:ref={messageEl}
				bind:value={message}
				required
				class="min-h-40"
				aria-invalid={errors.message ? 'true' : undefined}
				aria-describedby={describedBy('message', 'inquiry-message-count')}
			/>
			<p id="inquiry-message-count" aria-live="off" class="text-label text-muted-foreground">
				{message.length.toLocaleString('en-US')} of {MAX_INQUIRY_MESSAGE.toLocaleString('en-US')}
			</p>
			{@render fieldError('message')}
		</div>

		<div class="grid gap-2">
			<label class="flex min-h-11 cursor-pointer items-center gap-3">
				<input
					id="inquiry-consent"
					type="checkbox"
					bind:this={consentEl}
					bind:checked={consent}
					required
					class="size-5 shrink-0 accent-primary"
					aria-invalid={errors.consent ? 'true' : undefined}
					aria-describedby={describedBy('consent')}
				/>
				<span>I agree to be contacted about my inquiry.</span>
			</label>
			{@render fieldError('consent')}
		</div>

		<!-- Spam trap: off-screen, out of the tab order and the accessibility tree. -->
		<div class="absolute top-0 -left-[9999px]" aria-hidden="true">
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

		<p class="flex items-start gap-2 text-label text-muted-foreground">
			<ShieldCheck class="mt-0.5 size-4 shrink-0 text-secondary" aria-hidden="true" />
			<span>
				Your message is emailed to {agentName} by Web3Forms, a form service. Tran Real Estate Tools doesn't
				store it.
				<a href="https://web3forms.com/privacy" rel="noreferrer" class="text-foreground underline"
					>Web3Forms' privacy policy</a
				> applies.
			</span>
		</p>

		{#if tooFast}
			<p data-inquiry-too-fast class="flex items-start gap-2 text-label text-foreground">
				<Hourglass class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
				<span>{TOO_FAST}</span>
			</p>
		{/if}

		{#if failure}
			<Alert variant="destructive" role={null} data-inquiry-failure>
				<CircleAlert class="size-5 text-destructive" aria-hidden="true" />
				<AlertTitle>{failure.title}</AlertTitle>
				<AlertDescription>{failure.body}</AlertDescription>
			</Alert>
		{/if}

		<div>
			<Button type="submit" bind:ref={sendEl} disabled={sending} class="w-full gap-2 sm:w-auto">
				<Send class="size-4" aria-hidden="true" />
				{sending ? 'Sending…' : 'Send message'}
			</Button>
		</div>
	</form>
{/if}
