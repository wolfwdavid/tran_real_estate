<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Tran Real Estate Tools</title>
</svelte:head>

<h1>{page.status} — {page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
<p>Tran Real Estate Tools could not find that page.</p>
