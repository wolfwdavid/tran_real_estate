<script lang="ts">
	// Shared print shell (07-UI-SPEC "PrintReport shell"; INV-06, reused by Phase 9). The toolbar is
	// screen-only (`data-print-hidden`, hidden by the shared print stylesheet and `print:hidden`). The sheet carries
	// the title, the short disclaimer and the sample label at the top, the caller's sections, the
	// Data sources sentence and the closing Important block at the end, all as real text in
	// reading order. The user prints to PDF with the browser; printing only ever starts from the
	// button. No inline style attributes (hash-mode CSP locks style-src-attr).
	import type { Snippet } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import Printer from '@lucide/svelte/icons/printer';
	import { longDate } from '@tran/core/format';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { CHIP_SAMPLE } from '$lib/features/shared/data/copy/provenance';

	const PRINT_HELP =
		"In the print dialog, choose Save as PDF as the destination. This toolbar won't appear on the page.";
	const SAMPLE_SENTENCE =
		'Sample data: the property, the estimates, and the figures in this printout are made up.';

	let {
		title,
		subtitle,
		preparedAt,
		preparedLine,
		sample,
		provenance,
		disclaimer,
		disclaimerFull,
		backHref,
		backLabel,
		onprint,
		brand,
		footerNote,
		children
	}: {
		title: string;
		subtitle?: string;
		preparedAt: Date;
		/** Phase 9: replaces the prepared line (snapshot: "Prepared {date} by {agent}, {brokerage}"). */
		preparedLine?: string;
		sample: boolean;
		provenance: string;
		disclaimer: string;
		disclaimerFull: string;
		/** Already resolved by the caller (resolve() from $app/paths). */
		backHref: string;
		backLabel: string;
		onprint?: () => void;
		brand?: Snippet;
		footerNote?: Snippet;
		children: Snippet;
	} = $props();

	const prepared = $derived(
		preparedLine ?? `Prepared ${longDate(preparedAt)} with Tran Real Estate Tools`
	);

	async function print(): Promise<void> {
		if (onprint) {
			onprint();
			return;
		}
		await document.fonts.ready;
		window.print();
	}
</script>

<div data-print-hidden class="border-b border-border print:hidden">
	<div
		class="mx-auto flex max-w-page flex-col gap-3 px-6 py-4 sm:flex-row sm:flex-wrap sm:items-center"
	>
		<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve() output -->
		<a href={backHref} class="{buttonVariants({ variant: 'outline' })} w-full gap-2 sm:w-auto">
			<ArrowLeft class="size-4" aria-hidden="true" />
			{backLabel}
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<button
			type="button"
			data-print-button
			class="{buttonVariants({ variant: 'default' })} w-full gap-2 sm:w-auto"
			onclick={print}
		>
			<Printer class="size-4" aria-hidden="true" />
			Print or save as PDF
		</button>
		<p class="text-label text-muted-foreground sm:basis-full">{PRINT_HELP}</p>
	</div>
</div>

<article
	aria-labelledby="report-title"
	class="print-sheet mx-auto my-6 max-w-[816px] rounded-lg border border-border bg-card p-6 text-foreground shadow-card md:my-12 md:p-12"
>
	<header class="border-b border-foreground pb-6">
		{#if brand}
			<div class="mb-4 flex items-center gap-3">{@render brand()}</div>
		{/if}
		<h1 id="report-title" class="font-display text-heading font-semibold">{title}</h1>
		{#if subtitle}
			<p class="mt-1 text-base leading-[1.6] text-muted-foreground">{subtitle}</p>
		{/if}
		<p class="mt-2 text-label text-muted-foreground">{prepared}</p>
		<p class="mt-2 text-label font-semibold text-foreground" data-print-disclaimer-short>
			{disclaimer}
		</p>
		{#if sample}
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<span
					data-provenance-chip="sample"
					class="inline-flex items-center gap-1 rounded-full border border-border-strong bg-accent-surface px-2 py-1 text-label font-semibold whitespace-nowrap text-foreground"
				>
					<FlaskConical class="size-3.5" aria-hidden="true" />
					{CHIP_SAMPLE}
				</span>
				<p class="text-label text-foreground">{SAMPLE_SENTENCE}</p>
			</div>
		{/if}
	</header>

	<div class="mt-6 flex flex-col gap-6">
		{@render children()}

		<section aria-labelledby="report-sources" data-print-sources>
			<h2 id="report-sources" class="text-base leading-[1.6] font-semibold">Data sources</h2>
			<p class="mt-2 text-base leading-[1.6]">{provenance}</p>
		</section>

		<section
			aria-labelledby="report-important"
			class="print-disclaimer rounded-md border border-foreground p-4"
			data-print-important
		>
			<h2 id="report-important" class="text-base leading-[1.6] font-semibold">Important</h2>
			<p class="mt-2 text-base leading-[1.6]">{disclaimerFull}</p>
		</section>

		{#if footerNote}
			<div class="text-label text-muted-foreground">{@render footerNote()}</div>
		{/if}
	</div>
</article>
