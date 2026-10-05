export const PORTALS = Object.freeze(['renter', 'investor', 'agent'] as const);

export type Portal = (typeof PORTALS)[number];

export function isPortal(value: string): value is Portal {
	return (PORTALS as readonly string[]).includes(value);
}

export * from './providers';
export * from './syncable';
export * from './reminder';
export * from './backup/index';
