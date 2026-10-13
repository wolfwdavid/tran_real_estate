import { TOOLS } from '$lib/content/tools';
import { renderOgCard } from '$lib/seo/og-card.server';

// Share card, rendered once at build time (no dynamic [slug] route: every route is prerendered).
// Copied into a plain Uint8Array: the Node Buffer type is not a BodyInit under TS 6 DOM types.
export const prerender = true;

export const GET = () =>
	new Response(new Uint8Array(renderOgCard(TOOLS['affordability'].og).asPng()), {
		headers: { 'content-type': 'image/png' }
	});
