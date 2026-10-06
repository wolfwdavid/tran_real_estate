// Agent profile repository (AGT-01): one singleton row in the agentProfile table.
//
// The domain record (@tran/core/agent/types AgentProfile) has the literal id 'profile'; the stored
// row is keyed by PROFILE_ROW_ID (a fixed uuid) so the Phase 3 backup envelope accepts it. This
// module is the only place that maps between the two.
//
// Callers pass plain data (`$state.snapshot(form)`), never a Svelte proxy. The record is rebuilt
// field by field here anyway, so nothing but known fields reaches IndexedDB. Browser callers only
// (onMount / event handlers).
import { newSyncable } from '@tran/core';
import { agentProfileSchema } from '@tran/core/agent/schemas';
import {
	EMPTY_PROFILE_INPUT,
	type AgentProfile,
	type ProfileInput,
	type StoredLogo
} from '@tran/core/agent/types';
import { ACCESS_KEY_RE } from '@tran/core/leads/inquiry-params';
import { cleanText } from '@tran/core/leads/normalize';
import { getDb } from '$lib/storage/db';
import { META } from '$lib/storage/meta';
import {
	AGENT_RECORD_SCHEMA_VERSION,
	PROFILE_ROW_ID,
	agentProfileTable,
	type AgentProfileRow
} from './tables';

const toDomain = (row: AgentProfileRow): AgentProfile => ({ ...row, id: 'profile' });
const toRow = (p: AgentProfile): AgentProfileRow => ({ ...p, id: PROFILE_ROW_ID });

function copyLogo(l: StoredLogo | null): StoredLogo | null {
	return l
		? { base64: l.base64, mime: l.mime, width: l.width, height: l.height, bytes: l.bytes }
		: null;
}

/** A clean, plain copy of the editable fields (text cleaned, hex colors and the key trimmed). */
function cleanInput(i: ProfileInput): ProfileInput {
	return {
		id: 'profile',
		name: cleanText(i.name),
		brokerage: cleanText(i.brokerage),
		teamName: cleanText(i.teamName),
		licenseType: i.licenseType,
		licenseNumber: cleanText(i.licenseNumber),
		licenseState: cleanText(i.licenseState).toUpperCase(),
		brokerageLicenseNumber: cleanText(i.brokerageLicenseNumber),
		brokeragePhone: cleanText(i.brokeragePhone),
		phone: cleanText(i.phone),
		email: cleanText(i.email),
		website: cleanText(i.website),
		iabsUrl: cleanText(i.iabsUrl),
		postal: {
			street: cleanText(i.postal.street),
			line2: cleanText(i.postal.line2),
			city: cleanText(i.postal.city),
			state: cleanText(i.postal.state).toUpperCase(),
			zip: cleanText(i.postal.zip)
		},
		brandPrimary: i.brandPrimary.trim(),
		brandAccent: i.brandAccent.trim(),
		logo: copyLogo(i.logo),
		web3formsAccessKey: i.web3formsAccessKey.trim().toLowerCase()
	};
}

/** The saved profile, or null before the agent has saved one. */
export async function getProfile(): Promise<AgentProfile | null> {
	const row = await agentProfileTable(getDb()).get(PROFILE_ROW_ID);
	return row && row.deletedAt === undefined ? toDomain(row) : null;
}

async function upsert(
	build: (existing: AgentProfile | null) => ProfileInput,
	now: string
): Promise<AgentProfile> {
	const db = getDb();
	return db.transaction('rw', [agentProfileTable(db), db.meta], async () => {
		const row = await agentProfileTable(db).get(PROFILE_ROW_ID);
		const existing = row && row.deletedAt === undefined ? toDomain(row) : null;
		const base = existing
			? {
					ownerId: existing.ownerId,
					createdAt: existing.createdAt,
					updatedAt: now,
					schemaVersion: existing.schemaVersion
				}
			: newSyncable({
					id: PROFILE_ROW_ID,
					now: new Date(now),
					schemaVersion: AGENT_RECORD_SCHEMA_VERSION
				});
		const profile: AgentProfile = {
			ownerId: base.ownerId,
			createdAt: base.createdAt,
			updatedAt: base.updatedAt,
			schemaVersion: base.schemaVersion,
			...cleanInput(build(existing))
		};
		if (!agentProfileSchema.safeParse(profile).success) throw new Error('profile-invalid');
		await agentProfileTable(db).put(toRow(profile));
		if (!(await db.meta.get(META.firstRecordAt))) {
			await db.meta.put({ key: META.firstRecordAt, value: now });
		}
		return profile;
	});
}

/** Upserts the singleton profile. Rejects with Error('profile-invalid') on an invalid field. */
export function saveProfile(
	input: ProfileInput,
	now: string = new Date().toISOString()
): Promise<AgentProfile> {
	return upsert(() => input, now);
}

/**
 * Stores the Web3Forms access key (lowercased). Creates the profile from EMPTY_PROFILE_INPUT when
 * none exists. Rejects with Error('access-key-invalid') unless the key is a Web3Forms uuid.
 */
export async function saveAccessKey(
	key: string,
	now: string = new Date().toISOString()
): Promise<AgentProfile> {
	const k = key.trim().toLowerCase();
	if (!ACCESS_KEY_RE.test(k)) throw new Error('access-key-invalid');
	return upsert(
		(existing) => ({ ...(existing ?? EMPTY_PROFILE_INPUT), web3formsAccessKey: k }),
		now
	);
}
