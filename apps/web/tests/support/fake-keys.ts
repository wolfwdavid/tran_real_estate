// Planted provider keys for unit and E2E tests. They match the shapes of real keys so key-shape
// scanners and redaction checks fire, but they are assembled at runtime: no literal in this file
// matches a key pattern, so gitleaks and the pre-commit hook stay quiet.
export const FAKE_PROVIDERS = ['rentcast', 'anthropic', 'openai', 'gemini', 'openrouter'] as const;

export type FakeProvider = (typeof FAKE_PROVIDERS)[number];

export function fakeKey(provider: FakeProvider, seed = 'A'): string {
	switch (provider) {
		case 'anthropic':
			return ['sk', 'ant', 'api03', seed.repeat(40)].join('-');
		case 'openai':
			return ['sk', 'proj', seed.repeat(40)].join('-');
		case 'openrouter':
			return ['sk', 'or', 'v1', seed.toLowerCase().repeat(40)].join('-');
		case 'gemini':
			return 'AI' + 'za' + seed.repeat(35);
		case 'rentcast':
			// RentCast's key format is undocumented; covered by the exact-value check only.
			return 'rc' + seed.toLowerCase().repeat(30);
	}
}
