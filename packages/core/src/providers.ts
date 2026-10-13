// The single provider registry: labels, hosts, "Get a key" links and auth headers for every
// bring-your-own-key provider. Phases 3-5 (vault, key cards, data and AI adapters) read from here.
//
// Invariants:
// - Every `host` must stay inside the CSP connect-src allowlist (apps/web/src/lib/csp-policy.js and
//   scripts/assert-csp.mjs). scripts/provider-hosts.test.ts fails if they drift apart.
// - Keys travel ONLY in the `auth.header` request header. Never put a key in a URL query parameter,
//   a log line, an error message, or a backup file.

export const PROVIDER_IDS = Object.freeze([
	'rentcast',
	'anthropic',
	'openai',
	'gemini',
	'openrouter'
] as const);

export type ProviderId = (typeof PROVIDER_IDS)[number];

export interface ProviderInfo {
	readonly id: ProviderId;
	/** UI name, e.g. "Google Gemini". */
	readonly label: string;
	/** Bare host shown in <code>; must be in the CSP connect-src allowlist. */
	readonly host: string;
	/** Target of the "Get a {label} key" link. */
	readonly keyUrl: string;
	/** Provider note paragraph (RentCast and Gemini only). */
	readonly note?: string;
	/** Contract for Phases 4/5: the key is sent ONLY in this request header. */
	readonly auth: { readonly kind: 'header'; readonly header: string };
}

function provider(info: ProviderInfo): ProviderInfo {
	Object.freeze(info.auth);
	return Object.freeze(info);
}

export const PROVIDERS: readonly ProviderInfo[] = Object.freeze([
	provider({
		id: 'rentcast',
		label: 'RentCast',
		host: 'api.rentcast.io',
		keyUrl: 'https://app.rentcast.io/app/api',
		note: 'The free RentCast plan includes 50 requests a month. If you add a card to your RentCast account, requests over the limit are billed by RentCast.',
		auth: { kind: 'header', header: 'X-Api-Key' }
	}),
	provider({
		id: 'anthropic',
		label: 'Anthropic',
		host: 'api.anthropic.com',
		keyUrl: 'https://platform.claude.com/settings/keys',
		auth: { kind: 'header', header: 'x-api-key' }
	}),
	provider({
		id: 'openai',
		label: 'OpenAI',
		host: 'api.openai.com',
		keyUrl: 'https://platform.openai.com/api-keys',
		auth: { kind: 'header', header: 'Authorization' }
	}),
	provider({
		id: 'gemini',
		label: 'Google Gemini',
		host: 'generativelanguage.googleapis.com',
		keyUrl: 'https://aistudio.google.com/apikey',
		note: "On Google's free tier, Google may use what you send to improve its products. Use a paid-tier key before drafting with client or lead details.",
		auth: { kind: 'header', header: 'x-goog-api-key' }
	}),
	provider({
		id: 'openrouter',
		label: 'OpenRouter',
		host: 'openrouter.ai',
		keyUrl: 'https://openrouter.ai/settings/keys',
		auth: { kind: 'header', header: 'Authorization' }
	})
]);

export function providerById(id: ProviderId): ProviderInfo | undefined {
	return PROVIDERS.find((p) => p.id === id);
}
