<script lang="ts">
	// "Your inquiry page" (AGT-02, UI-SPEC "5. Inquiry page section", plan 08-24): the agent saves
	// their Web3Forms access key here and gets the public inquiry link built from the SAVED profile
	// (the same data the home page's Copy inquiry link uses). The key is a profile field, public by
	// design; it never goes near the Phase 3 key store. The link is built only after mount (no URL
	// work during prerender) and carries nothing but the fields share-link.ts maps.
	//
	// Reconciliation: UI-SPEC's brokerage checkbox is gone. State advertising rules require the
	// brokerage on the page, so a missing brokerage is a blocked state instead.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Link from '@lucide/svelte/icons/link';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import { onMount, tick, untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import type { AgentProfile } from '@tran/core/agent/types';
	import { ACCESS_KEY_RE } from '@tran/core/leads/inquiry-params';
	import { announce } from '$lib/components/a11y/announcer.svelte';
	import ExternalLink from '$lib/components/legal/ExternalLink.svelte';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import SectionError from '$lib/features/shared/settings/SectionError.svelte';
	import { buildInquiryUrl } from '$lib/leads/inquiry-url';
	import { saveAccessKey } from '$lib/storage/agent/profile-repo';
	import {
		MAX_SHARE_PROPERTY,
		inquiryConfigFromProfile,
		shareLinkBlockers,
		type ShareLinkBlocker
	} from './share-link';

	interface Props {
		/** The saved profile from the live view (null before one is saved or while loading). */
		profile: AgentProfile | null;
	}

	let { profile }: Props = $props();

	const uid = $props.id();
	const id = (part: string) => `${uid}-${part}`;

	const KEY_ERROR =
		"That doesn't look like a Web3Forms access key. It has 36 characters with dashes, like the one in your Web3Forms email.";
	const COPY_FAILED =
		"Your browser didn't allow copying. The link is selected, so press Ctrl+C or ⌘C.";
	const BLOCKER_COPY: Readonly<Record<ShareLinkBlocker, string>> = {
		name: 'Add your full name in Your details to build your link.',
		brokerage: 'Add your brokerage in Your details to build your link.',
		key: 'Add your Web3Forms access key to build your link.'
	};

	// The key field shows the saved key (public, so there is nothing to hide) until the agent starts
	// typing a replacement; a successful save adopts the stored copy again.
	let keyText = $state('');
	let keyTouched = $state(false);
	$effect(() => {
		const stored = profile?.web3formsAccessKey ?? '';
		untrack(() => {
			if (!keyTouched) keyText = stored;
		});
	});

	let keyError = $state<string | null>(null);
	let keyStatus = $state<string | null>(null);
	let saving = $state(false);
	let failure = $state<{ title: string; body: string } | null>(null);
	let failureSeq = $state(0);
	let keyEl = $state<HTMLInputElement | null>(null);
	let saveEl = $state<HTMLButtonElement | null>(null);

	let property = $state('');

	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const blockers = $derived(shareLinkBlockers(profile));
	const url = $derived.by(() => {
		if (!mounted || !profile || blockers.length > 0) return null;
		const page = new URL(resolve('/agent/inquire/'), location.origin).href;
		return buildInquiryUrl(page, inquiryConfigFromProfile(profile, { property }));
	});

	// Copy link: the status stays until the link changes; on a refused clipboard the field is
	// selected so Ctrl+C / Cmd+C still works (same pattern as the home page's Copy inquiry link).
	let copyStatus = $state<string | null>(null);
	let linkEl = $state<HTMLInputElement | null>(null);
	$effect(() => {
		void url;
		untrack(() => {
			copyStatus = null;
		});
	});

	async function copyLink() {
		if (!url) return;
		try {
			await navigator.clipboard.writeText(url);
			copyStatus = 'Link copied.';
			announce('Link copied.');
		} catch {
			copyStatus = COPY_FAILED;
			await tick();
			linkEl?.focus();
			linkEl?.select();
		}
	}

	async function saveKey(event: SubmitEvent) {
		event.preventDefault();
		if (saving) return;
		failure = null;
		keyStatus = null;
		const key = keyText.trim();
		if (!ACCESS_KEY_RE.test(key)) {
			keyError = KEY_ERROR;
			keyEl?.focus();
			return;
		}
		keyError = null;
		saving = true;
		try {
			await saveAccessKey(key);
			keyTouched = false;
			keyStatus = 'Access key saved.';
			announce('Access key saved.');
		} catch {
			failure = {
				title: "Your key wasn't saved",
				body: 'Your key is still on this page. Try again. If it keeps failing, check Storage in Settings.'
			};
			failureSeq += 1;
		} finally {
			saving = false;
		}
		// The button was disabled while saving; let it re-enable before focus returns to it.
		await tick();
		saveEl?.focus();
	}

	const keyDescribedBy = $derived(
		[id('key-help'), keyError ? id('key-error') : ''].filter(Boolean).join(' ')
	);
	const demoHref = resolve('/agent/inquire/') + '?demo=1';
	const importHref = resolve('/agent/import/') + '#paste';
	const helpClass = 'text-label text-muted-foreground';
</script>

<section
	id="inquiry-page"
	aria-labelledby={id('title')}
	class="min-w-0 scroll-mt-6 rounded-lg border border-border bg-card p-6 shadow-card"
>
	<h2 id={id('title')} class="font-display text-heading font-semibold">Your inquiry page</h2>
	<p class="mt-4 text-body text-muted-foreground">
		Share a link to a simple contact form. When someone sends it, Web3Forms emails the message to
		you. Tran doesn't receive or store it. Then paste that email into Import leads.
	</p>

	<form novalidate onsubmit={saveKey} aria-busy={saving} class="mt-6 grid gap-2">
		<Label for={id('key')}>Web3Forms access key</Label>
		<p id={id('key-help')} class={helpClass}>
			Web3Forms keys are meant to be public. Yours appears in your link and only lets people send
			you form emails. Leads go to the email address you used to create the key.
			<ExternalLink href="https://web3forms.com">Get a free Web3Forms key</ExternalLink>
		</p>
		<Input
			id={id('key')}
			bind:ref={keyEl}
			type="text"
			autocomplete="off"
			spellcheck="false"
			maxlength={36}
			class="tabular-nums"
			bind:value={keyText}
			oninput={() => (keyTouched = true)}
			aria-invalid={keyError ? 'true' : undefined}
			aria-describedby={keyDescribedBy}
		/>
		{#if keyError}
			<p id={id('key-error')} class="flex items-center gap-1 text-label text-destructive">
				<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{keyError}
			</p>
		{/if}
		<div class="mt-2 flex flex-wrap items-center gap-4">
			<Button type="submit" variant="outline" bind:ref={saveEl} disabled={saving} class="gap-2">
				{#if saving}
					<LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
				{/if}
				{saving ? 'Saving…' : 'Save key'}
			</Button>
			{#if keyStatus}
				<p data-key-status class="text-label text-muted-foreground">{keyStatus}</p>
			{/if}
		</div>
		{#if failure}
			{#key failureSeq}
				<SectionError title={failure.title} body={failure.body} class="mt-2" />
			{/key}
		{/if}
	</form>

	<div class="mt-4 grid gap-2">
		<p class={helpClass}>
			Leave captcha off in Web3Forms. Tran's page can't load third-party captcha scripts, so it uses
			a hidden spam trap and a short time check, and Web3Forms filters spam on its side.
		</p>
		<p class={helpClass}>
			If you start getting spam, create a new key in Web3Forms, save it here, and share your new
			link. Delete the old key in Web3Forms so old links stop sending.
		</p>
	</div>

	<div class="mt-6 grid gap-2">
		<Label for={id('property')}>Property (optional)</Label>
		<p id={id('property-help')} class={helpClass}>Use this for a link about one listing.</p>
		<Input
			id={id('property')}
			type="text"
			maxlength={MAX_SHARE_PROPERTY}
			bind:value={property}
			aria-describedby={id('property-help')}
		/>
	</div>

	{#if url}
		<div class="mt-6 grid gap-2">
			<Label for={id('link')}>Your link</Label>
			<Input
				id={id('link')}
				bind:ref={linkEl}
				type="text"
				readonly
				value={url}
				class="tabular-nums"
				aria-describedby={id('limit')}
			/>
			<div class="mt-2 flex flex-wrap items-center gap-4">
				<Button type="button" onclick={copyLink} class="gap-2">
					<Link size={16} aria-hidden="true" />Copy link
				</Button>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- built by buildInquiryUrl from resolve() plus the query -->
				<a href={url} class={buttonVariants({ variant: 'outline' })}>Open your inquiry page</a>
			</div>
			{#if copyStatus}
				<p data-copy-status class="text-label text-foreground">{copyStatus}</p>
			{/if}
		</div>
	{:else}
		<div data-share-blocked class="mt-6 grid gap-2">
			<ul class="grid gap-1 text-body text-foreground">
				{#each blockers as blocker (blocker)}
					<li class="flex items-start gap-2">
						<CircleAlert class="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						{BLOCKER_COPY[blocker]}
					</li>
				{/each}
			</ul>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus the demo query -->
			<a
				href={demoHref}
				class="inline-flex min-h-11 items-center text-body text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>Preview the page with sample details</a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{/if}

	<p id={id('limit')} class="mt-6 {helpClass}">
		Web3Forms' free plan has a monthly limit on submissions. Check your usage in your Web3Forms
		account.
	</p>

	<ol class="mt-4 grid list-decimal gap-2 pl-6 text-body text-foreground">
		<li>Open your inquiry page and send yourself a test message.</li>
		<li>Find the email from Web3Forms (check spam the first time).</li>
		<li>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() plus a fragment -->
			Paste it into
			<a
				href={importHref}
				class="font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
				>Import leads</a
			>
			to add the lead.
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</li>
	</ol>
</section>
