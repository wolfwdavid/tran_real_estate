<script lang="ts">
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import { Alert } from '$lib/components/ui/alert/index.js';

	// Static honesty statement (UI-SPEC HonestyCallout). Not a status message, so no role="alert".
</script>

<Alert variant="info" role={null}>
	<ShieldCheck size={20} class="text-secondary" aria-hidden="true" />
	<div>
		<h3 class="text-body font-semibold">What a passphrase does, and what it doesn't</h3>
		<ul class="mt-2 list-disc space-y-2 pl-5 text-body text-foreground">
			<li>
				It encrypts your remembered keys on this device, so someone who copies this browser's stored
				data can't read them without the passphrase.
			</li>
			<li>
				It doesn't protect keys while they're unlocked. A malicious browser extension or script
				running on this page could still read them.
			</li>
			<li>
				Tran can't recover a forgotten passphrase. You'd forget your keys and paste them in again.
			</li>
		</ul>
	</div>
</Alert>
