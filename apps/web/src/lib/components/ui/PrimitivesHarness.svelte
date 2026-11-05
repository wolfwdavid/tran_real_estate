<script lang="ts">
	// Test-only harness for primitives.browser.test.ts (DEBT-06). The 20px container means an
	// inherited font-size can never satisfy the 14px / 16px token assertions by accident.
	import { Alert, AlertDescription, AlertTitle } from './alert';
	import { Badge } from './badge';
	import { Button } from './button';
</script>

<div data-harness style="font-size:20px">
	<p>
		<Badge data-probe="badge">Sample</Badge>
		<Badge variant="positive">Positive</Badge>
		<Badge variant="attention">Attention</Badge>
		<span class="font-semibold" data-sanity>x</span>
	</p>
	<p>
		<Button data-probe="button">Send</Button>
		<Button variant="outline">Outline</Button>
		<Button variant="ghost">Ghost</Button>
		<Button variant="destructive">Delete</Button>
		<Button variant="destructive-outline">Remove</Button>
		<Button variant="link">Learn more</Button>
		<Button size="icon" aria-label="Close">x</Button>
	</p>
	<Alert>
		<AlertTitle>Heads up</AlertTitle>
		<AlertDescription>Sample listings are fictional.</AlertDescription>
	</Alert>
	<Alert variant="destructive">
		<AlertTitle>Something went wrong</AlertTitle>
		<AlertDescription>Try again in a minute.</AlertDescription>
	</Alert>
</div>
