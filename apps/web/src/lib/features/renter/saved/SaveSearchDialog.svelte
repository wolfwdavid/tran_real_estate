<script lang="ts">
	// UI-SPEC "Save search dialog" (RENT-04): save, rename, or the 10-search limit explanation.
	// Caller-owned open state; the Name input takes initial focus (limit mode: Close). Saving never
	// spends: the caller writes storage only.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Button, Input, Label } from '$lib/features/shared/data/platform-ui';

	export type SaveDialogMode = 'save' | 'rename' | 'limit';

	interface Props {
		open?: boolean;
		mode: SaveDialogMode;
		/** Prefilled name (defaultSearchName, or the current name when renaming). */
		initialName: string;
		/** Persist the name; the dialog closes when it resolves true (false keeps it open). */
		onSubmit: (name: string) => Promise<boolean>;
		onCloseAutoFocus?: (e: Event) => void;
	}

	let { open = $bindable(false), mode, initialName, onSubmit, onCloseAutoFocus }: Props = $props();

	const uid = $props.id();
	const inputId = `${uid}-name`;
	const helpId = `${uid}-help`;
	const errorId = `${uid}-error`;

	let name = $state('');
	let error = $state<string | null>(null);
	let pending = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);
	let closeEl = $state<HTMLElement | null>(null);

	// Reset the field each time the dialog opens.
	$effect(() => {
		if (!open) return;
		name = initialName;
		error = null;
		pending = false;
	});

	const title = $derived(
		mode === 'limit'
			? 'You have 10 saved searches'
			: mode === 'rename'
				? 'Rename this search'
				: 'Save this search'
	);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (pending) return;
		if (name.trim() === '') {
			error = 'Give this search a name.';
			inputEl?.focus();
			return;
		}
		pending = true;
		try {
			if (await onSubmit(name)) open = false;
		} finally {
			pending = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		onOpenAutoFocus={(e) => {
			e.preventDefault();
			if (mode === 'limit') closeEl?.focus();
			else inputEl?.focus();
		}}
		{onCloseAutoFocus}
	>
		<Dialog.Title>{title}</Dialog.Title>
		{#if mode === 'limit'}
			<Dialog.Description class="text-base leading-[1.6] text-foreground">
				That's the most Tran keeps, so daily checks fit inside your monthly calls. Delete a saved
				search to save this one.
			</Dialog.Description>
			<Dialog.Footer>
				<Button bind:ref={closeEl} variant="outline" class="min-h-11" onclick={() => (open = false)}
					>Close</Button
				>
			</Dialog.Footer>
		{:else}
			{#if mode === 'save'}
				<Dialog.Description class="text-base leading-[1.6] text-foreground">
					Tran checks saved searches when you open it, at most once a day each. Each check uses 1
					RentCast call, or none with sample data, and checks stop at your monthly cap.
				</Dialog.Description>
			{/if}
			<form class="grid gap-4" novalidate onsubmit={submit}>
				<div class="grid gap-2">
					<Label for={inputId} class="text-base leading-[1.6] font-semibold">Name</Label>
					<Input
						id={inputId}
						bind:ref={inputEl}
						bind:value={name}
						type="text"
						maxlength={60}
						autocomplete="off"
						class="h-12"
						aria-invalid={error ? 'true' : undefined}
						aria-describedby={error ? `${errorId} ${helpId}` : helpId}
						oninput={() => (error = null)}
					/>
					<p id={helpId} class="text-label text-muted-foreground">Shown in your saved searches.</p>
					{#if error}
						<p id={errorId} class="flex items-center gap-1 text-label text-destructive">
							<CircleAlert class="size-4 shrink-0" aria-hidden="true" />
							{error}
						</p>
					{/if}
				</div>
				<Dialog.Footer>
					<Button variant="outline" class="min-h-11" onclick={() => (open = false)}>Cancel</Button>
					<Button type="submit" class="min-h-11" disabled={pending}>
						{mode === 'rename' ? 'Save name' : 'Save search'}
					</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
