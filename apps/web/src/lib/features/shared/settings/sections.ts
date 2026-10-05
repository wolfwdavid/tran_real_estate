export interface SettingsSection {
	/** Anchor id (`#id`) and the prefix of the section heading id (`{id}-heading`). */
	readonly id: string;
	readonly label: string;
	/** The phase that renders this section. */
	readonly owner: 3 | 4 | 5 | 10;
	/** True once the owning phase ships the section. Unavailable slots are not rendered. */
	readonly available: boolean;
}

// Fixed cross-phase order (05-CONTEXT Amendments 2026-10-04). Later phases flip `available` and
// map a component in the Settings page; never reorder, rename or remove an entry.
export const SETTINGS_SECTIONS: readonly SettingsSection[] = Object.freeze([
	{ id: 'api-keys', label: 'API keys', owner: 3, available: true },
	{ id: 'rentcast-usage', label: 'RentCast usage', owner: 4, available: true },
	{ id: 'ai-drafting', label: 'AI drafting', owner: 5, available: true },
	{ id: 'key-security', label: 'Key security', owner: 3, available: true },
	{ id: 'backup', label: 'Backup and restore', owner: 3, available: true },
	{ id: 'storage', label: 'Storage', owner: 3, available: true },
	{ id: 'install', label: 'Install the app', owner: 3, available: true },
	{ id: 'getting-started', label: 'Getting started', owner: 10, available: false }
] as const satisfies readonly SettingsSection[]);

/** The sections rendered today, in registry order. */
export const availableSections = (): SettingsSection[] =>
	SETTINGS_SECTIONS.filter((s) => s.available);
