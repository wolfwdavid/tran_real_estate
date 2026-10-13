import { robotsTxt } from '$lib/seo/sitemap';
import { SITE_URL } from '$lib/site';

export const prerender = true;

export function GET() {
	return new Response(robotsTxt(SITE_URL), { headers: { 'content-type': 'text/plain' } });
}
