<script lang="ts">
	import { resolve } from '$app/paths';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import { RadioGroup, announce } from './platform-ui';
	import {
		NO_KEY_LINE,
		SOURCE_LEGEND,
		SOURCE_OPTIONS,
		noKeyLink,
		sourceAnnouncement,
		type DataSource
	} from './copy/source';

	// "Data source" in the RentCast usage section (04-UI-SPEC DataSourceChoice). Without a usable key
	// it is a status line with a link; with one, a radio group that applies immediately (no Save),
	// then announces. Props-driven: `onChange` persists and broadcasts; switching never spends a call.

	interface Props {
		keyState: 'none' | 'locked' | 'available';
		value: DataSource;
		onChange: (v: DataSource) => Promise<void>;
	}

	let { keyState, value, onChange }: Props = $props();

	const uid = $props.id();
	let selected = $state<DataSource>('rentcast');
	let busy = $state(false);

	// Follow the caller's value (including changes from another tab) whenever no switch is in flight.
	$effect.pre(() => {
		const v = value;
		if (!busy) selected = v;
	});

	const linkClass =
		'inline-flex min-h-11 items-center text-body text-primary underline underline-offset-3 hover:text-primary-hover';

	function onValueChange(next: string): void {
		if (next !== 'rentcast' && next !== 'sample') return;
		if (next === value) return;
		busy = true;
		void onChange(next)
			.then(() => announce(sourceAnnouncement(next)))
			.catch(() => {
				selected = value;
			})
			.finally(() => {
				busy = false;
			});
	}
</script>

{#if keyState === 'available'}
	<fieldset class="grid gap-2">
		<legend class="mb-2 text-body font-semibold text-foreground">{SOURCE_LEGEND}</legend>
		<RadioGroup.Root bind:value={selected} {onValueChange} class="grid gap-2" aria-busy={busy}>
			{#each SOURCE_OPTIONS as option (option.value)}
				<label
					class="flex min-h-11 cursor-pointer touch-manipulation items-start gap-3 py-2 has-disabled:cursor-not-allowed"
				>
					<RadioGroup.Item
						value={option.value}
						disabled={busy}
						aria-labelledby="{uid}-{option.value}-title"
						aria-describedby="{uid}-{option.value}-description"
						class="mt-0.5"
					/>
					<span class="grid gap-1">
						<span id="{uid}-{option.value}-title" class="text-body font-semibold text-foreground">
							{option.title}
						</span>
						<span id="{uid}-{option.value}-description" class="text-body text-muted-foreground">
							{option.description}
						</span>
					</span>
				</label>
			{/each}
		</RadioGroup.Root>
	</fieldset>
{:else}
	{@const link = noKeyLink(keyState)}
	<p class="flex flex-wrap items-center gap-x-2 text-body text-foreground">
		<FlaskConical
			size={20}
			data-icon="flask-conical"
			aria-hidden="true"
			class="shrink-0 text-foreground"
		/>
		<span>{NO_KEY_LINE}</span>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() plus a same-page fragment -->
		<a href={`${resolve('/settings/')}${link.hash}`} class={linkClass}>{link.text}</a>
	</p>
{/if}
