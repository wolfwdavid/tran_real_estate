<script lang="ts">
	import { resolve } from '$app/paths';
	import ButtonLink from '$lib/components/ui/ButtonLink.svelte';

	type Portal = 'renter' | 'investor' | 'agent';

	let { portal }: { portal: Portal } = $props();

	const copy: Record<
		Portal,
		{
			title: string;
			body: string;
			link: string;
			href: string;
			docTitle: string;
			description: string;
		}
	> = {
		renter: {
			title: 'Renter portal',
			body: "The renter tools are being built: saved searches, rent comparisons, and inquiry drafts. Until they're ready, read what this portal will do.",
			link: 'Read about the renter portal',
			href: resolve('/for-renters/'),
			docTitle: 'Renter portal — Tran Real Estate Tools',
			description:
				'The renter portal of Tran Real Estate Tools is being built. Read what it will do: saved searches, rent comparisons, and inquiry drafts.'
		},
		investor: {
			title: 'Investor portal',
			body: "The investor tools are being built: a deal analyzer, buy-box searches, and market dashboards. Until they're ready, read what this portal will do.",
			link: 'Read about the investor portal',
			href: resolve('/for-investors/'),
			docTitle: 'Investor portal — Tran Real Estate Tools',
			description:
				'The investor portal of Tran Real Estate Tools is being built. Read what it will do: a deal analyzer, buy-box searches, and market dashboards.'
		},
		agent: {
			title: 'Agent portal',
			body: "The agent tools are being built: a lead pipeline, follow-ups, and a content studio. Until they're ready, read what this portal will do.",
			link: 'Read about the agent portal',
			href: resolve('/for-agents/'),
			docTitle: 'Agent portal — Tran Real Estate Tools',
			description:
				'The agent portal of Tran Real Estate Tools is being built. Read what it will do: a lead pipeline, follow-ups, and a content studio.'
		}
	};

	const c = $derived(copy[portal]);
</script>

<svelte:head>
	<title>{c.docTitle}</title>
	<meta name="description" content={c.description} />
</svelte:head>

<div class="mx-auto max-w-page px-6 py-12 md:px-8 md:py-16">
	<div class="max-w-reading">
		<h1 class="font-display text-display font-semibold">{c.title}</h1>
		<p class="mt-4 text-body text-muted-foreground">{c.body}</p>
		<div class="mt-8">
			<ButtonLink href={c.href} variant="secondary" arrow>{c.link}</ButtonLink>
		</div>
	</div>
</div>
