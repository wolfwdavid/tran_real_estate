// Saved-deal record contract (INV-02). A deal stores the analyzer INPUTS plus where each fetched
// field came from; outputs (NOI, cap rate, cash flow, ...) are always recomputed with the pure
// analyzer, never stored (07-RESEARCH anti-pattern: inputs are the source of truth).
//
// The zod/mini schemas validate every repo write and every backup import of Phase 7 tables.
import * as z from 'zod/mini';
import type { Syncable } from '@tran/core';
import type { DealInputs } from '@tran/core/finance';

export type FieldSourceKey =
	'rent' | 'price' | 'address' | 'propertyType' | 'bedrooms' | 'bathrooms' | 'squareFeet';

export interface FieldSource {
	source: 'rentcast' | 'sample' | 'listing' | 'edited';
	fetchedAt?: number;
	rangeLowCents?: number;
	rangeHighCents?: number;
	comps?: number;
	listingId?: string;
}

export type DealSources = Partial<Record<FieldSourceKey, FieldSource>>;

export type PropertyType =
	'single-family' | 'condo' | 'townhouse' | 'multi-family' | 'manufactured';

export const PROPERTY_TYPES: readonly PropertyType[] = Object.freeze([
	'single-family',
	'condo',
	'townhouse',
	'multi-family',
	'manufactured'
]);

export interface DealData {
	name: string;
	address: string;
	propertyType: PropertyType | null;
	bedrooms: number | null;
	bathrooms: number | null;
	squareFeet: number | null;
	inputs: DealInputs;
	sources: DealSources;
}

/** A stored deal: Phase 3 Syncable fields (deletedAt omitted on live rows) + the deal data. */
export interface DealRecord extends Syncable, DealData {
	analyzerVersion: number;
}

// ------------------------------------------------------------------ schemas

const cents = z.number().check(z.int(), z.gte(0));
const bps = z.number().check(z.int(), z.gte(0), z.lte(10_000));
const isoDate = z.iso.datetime();
const count = z.nullable(z.number().check(z.gte(0), z.lte(1_000_000)));

const expenseKind = z.enum([
	'vacancy',
	'management',
	'maintenance',
	'capex',
	'tax',
	'insurance',
	'hoa',
	'utilities',
	'custom'
]);

const expenseLine = z.union([
	z.object({
		id: z.string().check(z.minLength(1)),
		kind: expenseKind,
		name: z.string().check(z.maxLength(200)),
		unit: z.literal('pct'),
		bps: z.nullable(bps)
	}),
	z.object({
		id: z.string().check(z.minLength(1)),
		kind: expenseKind,
		name: z.string().check(z.maxLength(200)),
		unit: z.literal('usd'),
		cents: z.nullable(cents)
	})
]);

export const dealInputsSchema = z.object({
	priceCents: cents,
	closing: z.union([
		z.object({ unit: z.literal('pct'), bps }),
		z.object({ unit: z.literal('usd'), cents })
	]),
	repairsCents: cents,
	financing: z.union([
		z.object({
			kind: z.literal('mortgage'),
			downBps: bps,
			annualRatePct: z.nullable(z.number().check(z.gte(0), z.lte(25))),
			termYears: z.number().check(z.int(), z.gte(1), z.lte(40))
		}),
		z.object({ kind: z.literal('cash') })
	]),
	rentCents: cents,
	otherIncomeCents: cents,
	expenses: z.array(expenseLine).check(z.maxLength(50))
});

const fieldSource = z.object({
	source: z.enum(['rentcast', 'sample', 'listing', 'edited']),
	fetchedAt: z.optional(z.number().check(z.int(), z.gte(0))),
	rangeLowCents: z.optional(cents),
	rangeHighCents: z.optional(cents),
	comps: z.optional(z.number().check(z.int(), z.gte(0))),
	listingId: z.optional(z.string().check(z.maxLength(200)))
});

const dealSources = z.object({
	rent: z.optional(fieldSource),
	price: z.optional(fieldSource),
	address: z.optional(fieldSource),
	propertyType: z.optional(fieldSource),
	bedrooms: z.optional(fieldSource),
	bathrooms: z.optional(fieldSource),
	squareFeet: z.optional(fieldSource)
});

const syncableShape = {
	id: z.string().check(z.uuid()),
	ownerId: z.literal('local'),
	createdAt: isoDate,
	updatedAt: isoDate,
	// Omitted on live rows; never null (the Phase 3 backup validator rejects null).
	deletedAt: z.optional(isoDate),
	schemaVersion: z.number().check(z.int(), z.positive())
};

export const dealDataSchema = z.object({
	name: z.string().check(z.maxLength(200)),
	address: z.string().check(z.maxLength(300)),
	propertyType: z.nullable(z.enum(PROPERTY_TYPES as [PropertyType, ...PropertyType[]])),
	bedrooms: count,
	bathrooms: count,
	squareFeet: count,
	inputs: dealInputsSchema,
	sources: dealSources
});

export const dealRecordSchema = z.object({
	...syncableShape,
	...dealDataSchema.def.shape,
	analyzerVersion: z.number().check(z.int(), z.positive())
});

/**
 * Permissive Syncable schema for the analyzer draft and buy-box rows: required Syncable fields,
 * any extra fields kept. Their exact shape belongs to the plans that write them.
 */
export const looseRecordSchema = z.looseObject(syncableShape);
